import express from 'express';
import { supabaseAdmin } from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Admin: Get all users
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, picture, role, created_at, last_login')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin: Update user role (promote to faculty)
router.patch('/:userId/role', requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['scholar', 'faculty', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent changing own role
    if (userId === req.user.id) {
      return res.status(403).json({ error: 'Cannot change your own role' });
    }

    // Get user email first
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update role in user_roles table (creates if not exists)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert(
        { email: targetUser.email, role, updated_at: new Date().toISOString() },
        { onConflict: 'email' }
      );

    if (roleError) throw roleError;

    // Sync role back to users table for consistency
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select('id, email, name, picture, role')
      .single();

    if (error) throw error;

    res.json({ user, message: 'User role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Admin: Set role by email (useful for pre-assigning roles)
router.post('/roles/email', requireRole('admin'), async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    if (!['scholar', 'faculty', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent changing own role via email
    if (email === req.user.email) {
      return res.status(403).json({ error: 'Cannot change your own role' });
    }

    // Upsert role in user_roles table
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert(
        { email, role, updated_at: new Date().toISOString() },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (roleError) throw roleError;

    // If user exists, sync role to users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      await supabaseAdmin
        .from('users')
        .update({ role })
        .eq('email', email);
    }

    res.json({ 
      email: roleData.email, 
      role: roleData.role, 
      message: 'Role assigned successfully',
      note: existingUser ? 'User exists - role updated immediately' : 'Role will be applied when user logs in'
    });
  } catch (error) {
    console.error('Set role by email error:', error);
    res.status(500).json({ error: 'Failed to set role' });
  }
});

// Admin: Get all role assignments
router.get('/roles', requireRole('admin'), async (req, res) => {
  try {
    const { data: roles, error } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Get faculties (available to all authenticated users)
router.get('/faculties', async (req, res) => {
  try {
    const { data: faculties, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, picture')
      .eq('role', 'faculty')
      .order('name');

    if (error) throw error;

    res.json({ faculties });
  } catch (error) {
    console.error('Get faculties error:', error);
    res.status(500).json({ error: 'Failed to fetch faculties' });
  }
});

export default router;

