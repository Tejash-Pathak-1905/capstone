const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/auth/google - Initiates Google OAuth redirect
router.get('/google', authController.getGoogleAuthUrl);

// GET /api/auth/google/callback - Handles Google OAuth callback
router.get('/google/callback', authController.handleGoogleCallback);

// POST /api/auth/google/token - Direct ID token exchange for SPA or testing
router.post('/google/token', authController.exchangeGoogleToken);

// POST /api/auth/logout - Clears session cookie
router.post('/logout', authController.logout);

// GET /api/auth/status - Returns current session state
router.get('/status', authMiddleware, authController.getAuthStatus);

module.exports = router;
