import express from 'express';
import jwt from 'jsonwebtoken';
import googleClient from '../config/google.js';
import { supabaseAdmin } from '../config/database.js';

const router = express.Router();

// Google OAuth login
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // Get role from user_roles table (defaults to 'scholar' if not found)
    let { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('email', email)
      .single();

    // If no role exists, default to 'scholar' and create entry
    let userRole = 'scholar';
    if (roleData) {
      userRole = roleData.role;
    } else {
      // Create default scholar role for new user
      await supabaseAdmin
        .from('user_roles')
        .insert([{ email, role: 'scholar' }])
        .select();
    }

    // Check if user exists
    let { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // If user doesn't exist, create new user
    if (!user) {
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            email,
            name,
            picture,
            google_id: googleId,
            role: userRole // Use role from user_roles table
          }
        ])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      user = newUser;
    } else {
      // Update user info and sync role from user_roles table
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          name,
          picture,
          google_id: googleId,
          role: userRole, // Sync role from user_roles table
          last_login: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      user = updatedUser;
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, picture, role, created_at')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});

export default router;

