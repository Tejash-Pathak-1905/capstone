const { OAuth2Client } = require('google-auth-library');
const config = require('../config');
const { query } = require('../db/postgres');
const { generateToken, setAuthCookie, clearAuthCookie } = require('../middleware/authMiddleware');

const oauth2Client = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.callbackUrl
);

/**
 * Initiates Google OAuth redirect URL
 */
function getGoogleAuthUrl(req, res) {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });

  if (req.query.format === 'json') {
    return res.json({ success: true, url });
  }

  return res.redirect(url);
}

/**
 * Handles Google OAuth redirect callback
 */
async function handleGoogleCallback(req, res, next) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Authorization code is missing from Google callback',
    });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Verify and decode ID token
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name || payload.email.split('@')[0];

    // Check if user exists in PostgreSQL
    let userResult = await query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user;

    if (userResult.rows.length === 0) {
      // First-time user: insert with new_user = TRUE
      const insertResult = await query(
        `INSERT INTO users (google_id, email, name, new_user)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, google_id, email, name, username, bio, new_user, created_at`,
        [googleId, email, name]
      );
      user = insertResult.rows[0];
    } else {
      user = userResult.rows[0];
    }

    // Generate JWT and set secure cookie
    const token = generateToken(user);
    setAuthCookie(res, token);

    // Redirect to frontend based on onboarding status
    const targetPath = user.new_user ? '/onboarding' : '/profile';
    return res.redirect(`${config.clientUrl}${targetPath}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return res.redirect(`${config.clientUrl}/login?error=oauth_failed`);
  }
}

/**
 * Direct ID token exchange for Single Page Application clients or mock testing
 */
async function exchangeGoogleToken(req, res, next) {
  const { idToken, code, mockUser } = req.body;

  try {
    let googleId, email, name;

    // Support mock authentication for local development or testing when Google credentials are mock
    if (config.env !== 'production' && mockUser) {
      googleId = mockUser.googleId || `mock_google_${Date.now()}`;
      email = (mockUser.email || `mock_${Date.now()}@example.com`).toLowerCase();
      name = mockUser.name || 'Mock User';
    } else if (idToken) {
      const ticket = await oauth2Client.verifyIdToken({
        idToken,
        audience: config.google.clientId,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email.toLowerCase();
      name = payload.name;
    } else if (code) {
      const { tokens } = await oauth2Client.getToken(code);
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.google.clientId,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email.toLowerCase();
      name = payload.name;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either idToken, authorization code, or mockUser must be provided',
      });
    }

    // Lookup or insert user in PostgreSQL
    let userResult = await query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user;

    if (userResult.rows.length === 0) {
      const insertResult = await query(
        `INSERT INTO users (google_id, email, name, new_user)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, google_id, email, name, username, bio, new_user, created_at`,
        [googleId, email, name]
      );
      user = insertResult.rows[0];
    } else {
      user = userResult.rows[0];
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        bio: user.bio,
        newUser: user.new_user,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Logs out the user by clearing the session cookie
 */
function logout(req, res) {
  clearAuthCookie(res);
  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
}

/**
 * Returns current authenticated user session status
 */
async function getAuthStatus(req, res, next) {
  try {
    const userRes = await query(
      'SELECT id, email, name, username, bio, new_user, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = userRes.rows[0];
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        bio: user.bio,
        newUser: user.new_user,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getGoogleAuthUrl,
  handleGoogleCallback,
  exchangeGoogleToken,
  logout,
  getAuthStatus,
};
