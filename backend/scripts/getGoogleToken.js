/**
 * Helper script to get Google OAuth Refresh Token
 * Run this once to generate your GOOGLE_REFRESH_TOKEN
 * 
 * Usage:
 * 1. Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in your .env
 * 2. Run: node scripts/getGoogleToken.js
 * 3. Follow the instructions
 * 4. Copy the refresh_token to your .env file
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:5000/api/auth/google/callback'
);

// Scopes needed for Google Calendar and Meet
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar',
];

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent', // Force to get refresh token
});

console.log('\n========================================');
console.log('🔐 Google Calendar API Token Generator');
console.log('========================================\n');

console.log('Step 1: Authorize this app by visiting this URL:\n');
console.log(authUrl);
console.log('\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Step 2: After authorization, you will be redirected.\nPaste the FULL redirect URL here: ', async (redirectUrl) => {
  try {
    // Extract code from URL
    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');

    if (!code) {
      console.error('\n❌ Error: No authorization code found in URL');
      console.log('Make sure you pasted the complete redirect URL\n');
      rl.close();
      return;
    }

    console.log('\n⏳ Exchanging code for tokens...\n');

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    console.log('========================================');
    console.log('✅ SUCCESS! Copy these tokens:');
    console.log('========================================\n');

    console.log('Add these to your backend/.env file:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nOptional (for reference):');
    console.log(`# Access Token (expires): ${tokens.access_token}`);
    console.log(`# Expires at: ${new Date(tokens.expiry_date).toLocaleString()}`);

    console.log('\n========================================');
    console.log('📝 Next Steps:');
    console.log('========================================');
    console.log('1. Copy the GOOGLE_REFRESH_TOKEN above');
    console.log('2. Add it to backend/.env');
    console.log('3. Restart your backend server');
    console.log('4. Book a slot to test real Google Meet creation!');
    console.log('\n✨ Your app will now create real Google Meet rooms!\n');

  } catch (error) {
    console.error('\n❌ Error getting tokens:', error.message);
    console.log('\nTroubleshooting:');
    console.log('- Make sure your Google Client ID and Secret are correct');
    console.log('- Check that the redirect URI matches in Google Cloud Console');
    console.log('- Try generating a new authorization URL\n');
  } finally {
    rl.close();
  }
});

