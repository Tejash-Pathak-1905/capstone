const jwt = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../db/postgres');

/**
 * Authentication Middleware:
 * Validates JWT from HTTP-only cookie or Authorization Bearer header.
 * Attaches authenticated user payload to `req.user`.
 */
async function authMiddleware(req, res, next) {
  try {
    let token = null;

    // 1. Check HTTP-only cookie
    if (req.cookies && req.cookies[config.jwt.cookieName]) {
      token = req.cookies[config.jwt.cookieName];
    }
    // 2. Check Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication token is required',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Token is invalid or expired',
      });
    }

    // Attach user payload
    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
      newUser: decoded.newUser === true || decoded.new_user === true,
    };

    // Optionally sync latest new_user status from DB if needed
    if (req.syncUserWithDb) {
      const userRes = await query('SELECT id, email, new_user, name, username, bio FROM users WHERE id = $1', [
        req.user.id,
      ]);
      if (userRes.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: User account not found',
        });
      }
      const dbUser = userRes.rows[0];
      req.user.newUser = dbUser.new_user;
      req.user.name = dbUser.name;
      req.user.username = dbUser.username;
      req.user.bio = dbUser.bio;
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal authentication error',
    });
  }
}

/**
 * Generates a signed JWT for a given user object.
 * @param {object} user - User record with { id, email, new_user }
 * @returns {string} signed JWT
 */
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      newUser: user.new_user !== undefined ? user.new_user : user.newUser,
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
    }
  );
}

/**
 * Sets the signed JWT into an HTTP-only secure cookie.
 * @param {object} res - Express response object
 * @param {string} token - Signed JWT
 */
function setAuthCookie(res, token) {
  const isProd = config.env === 'production';
  res.cookie(config.jwt.cookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

/**
 * Clears the auth cookie.
 * @param {object} res - Express response object
 */
function clearAuthCookie(res) {
  res.clearCookie(config.jwt.cookieName, {
    httpOnly: true,
    path: '/',
  });
}

module.exports = {
  authMiddleware,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
};
