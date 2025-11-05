-- Assignment Scheduler Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    picture TEXT,
    google_id VARCHAR(255) UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'scholar' CHECK (role IN ('scholar', 'faculty', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Slots table
CREATE TABLE IF NOT EXISTS slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scholar_id UUID REFERENCES users(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'cancelled', 'completed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_slots_faculty_id ON slots(faculty_id);
CREATE INDEX IF NOT EXISTS idx_slots_scholar_id ON slots(scholar_id);
CREATE INDEX IF NOT EXISTS idx_slots_date ON slots(date);
CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status);
CREATE INDEX IF NOT EXISTS idx_slots_date_status ON slots(date, status);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_slots_updated_at
    BEFORE UPDATE ON slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- All authenticated users can read all users (for listing faculties, etc.)
CREATE POLICY "Users are viewable by authenticated users"
    ON users FOR SELECT
    TO authenticated
    USING (true);

-- Users can update their own record (except role)
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Slots table policies
-- All authenticated users can view available slots
CREATE POLICY "Available slots are viewable by everyone"
    ON slots FOR SELECT
    TO authenticated
    USING (true);

-- Faculty can create slots
CREATE POLICY "Faculty can create slots"
    ON slots FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('faculty', 'admin')
        )
    );

-- Faculty can update their own slots
CREATE POLICY "Faculty can update own slots"
    ON slots FOR UPDATE
    TO authenticated
    USING (
        faculty_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Faculty can delete their own unbooked slots
CREATE POLICY "Faculty can delete own unbooked slots"
    ON slots FOR DELETE
    TO authenticated
    USING (
        faculty_id = auth.uid() AND status = 'available'
    );

-- Insert default admin user (update with your email)
-- You'll need to log in once with this email to create the user, then run this update
-- Or manually add this user in Supabase dashboard after first login
-- Example:
-- INSERT INTO users (email, name, role, google_id)
-- VALUES ('admin@yourdomain.com', 'Admin User', 'admin', 'temp_google_id')
-- ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- Function to prevent users from changing their own role
CREATE OR REPLACE FUNCTION prevent_self_role_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role != NEW.role AND OLD.id = auth.uid() THEN
        RAISE EXCEPTION 'Users cannot change their own role';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_self_role_change
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_self_role_change();

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores user information with Google OAuth authentication';
COMMENT ON TABLE slots IS 'Stores time slots created by faculty for assignment demos';
COMMENT ON COLUMN users.role IS 'User role: scholar (default for all Gmail users), faculty (added by admin), admin (hardcoded)';
COMMENT ON COLUMN slots.status IS 'Slot status: available, booked, cancelled, completed';

