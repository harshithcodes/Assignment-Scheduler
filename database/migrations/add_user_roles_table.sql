-- Create separate user_roles table for role management
-- Run this in your Supabase SQL Editor

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'scholar' CHECK (role IN ('scholar', 'faculty', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Create trigger to update updated_at
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view roles
CREATE POLICY "Roles are viewable by authenticated users"
    ON user_roles FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can insert roles
CREATE POLICY "Only admins can insert roles"
    ON user_roles FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Only admins can update roles
CREATE POLICY "Only admins can update roles"
    ON user_roles FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Only admins can delete roles
CREATE POLICY "Only admins can delete roles"
    ON user_roles FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Function to sync role from user_roles to users table
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Update users table with new role from user_roles
    UPDATE users 
    SET role = NEW.role
    WHERE email = NEW.email;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically sync role changes from user_roles to users
CREATE TRIGGER sync_user_role_on_insert_update
    AFTER INSERT OR UPDATE OF role ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_role();

-- Migrate existing user roles to user_roles table (if users table has role data)
-- This will copy existing role assignments
INSERT INTO user_roles (email, role, created_at)
SELECT email, role, created_at
FROM users
WHERE email IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- Function to ensure users table role stays in sync (reverse sync)
CREATE OR REPLACE FUNCTION sync_role_to_user_roles()
RETURNS TRIGGER AS $$
BEGIN
    -- When users table role is updated, sync to user_roles
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        INSERT INTO user_roles (email, role)
        VALUES (NEW.email, NEW.role)
        ON CONFLICT (email) 
        DO UPDATE SET role = NEW.role, updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on users table to keep user_roles in sync
CREATE TRIGGER sync_role_to_user_roles_on_update
    AFTER UPDATE OF role ON users
    FOR EACH ROW
    EXECUTE FUNCTION sync_role_to_user_roles();

-- Comments for documentation
COMMENT ON TABLE user_roles IS 'Stores user role assignments based on email addresses';
COMMENT ON COLUMN user_roles.email IS 'User email address - unique identifier';
COMMENT ON COLUMN user_roles.role IS 'User role: scholar (default), faculty, admin';

-- Function to get user role by email (defaults to scholar if not found)
CREATE OR REPLACE FUNCTION get_user_role(user_email VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    SELECT role INTO user_role
    FROM user_roles
    WHERE email = user_email;
    
    -- If no role found, return default 'scholar'
    IF user_role IS NULL THEN
        RETURN 'scholar';
    END IF;
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql;

-- Function to set user role (creates if not exists, updates if exists)
CREATE OR REPLACE FUNCTION set_user_role(user_email VARCHAR, new_role VARCHAR)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_roles (email, role)
    VALUES (user_email, new_role)
    ON CONFLICT (email)
    DO UPDATE SET role = new_role, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'User roles table created successfully!';
    RAISE NOTICE 'Existing roles have been migrated from users table.';
    RAISE NOTICE 'New users will automatically get "scholar" role.';
END $$;

