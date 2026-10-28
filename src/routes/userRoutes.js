const express = require('express');
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { onboardingGateMiddleware } = require('../middleware/onboardingGateMiddleware');
const { validateCompleteProfile } = require('../middleware/validationMiddleware');

const router = express.Router();

// Apply authentication middleware to all user routes
router.use(authMiddleware);

// Apply soft gatekeeper middleware
router.use(onboardingGateMiddleware);

// GET /api/users/me - Returns current user profile and newUser flag
router.get('/me', userController.getMe);

// POST /api/users/complete-profile - Submits onboarding details (name, username, bio)
router.post('/complete-profile', validateCompleteProfile, userController.completeProfile);

// PUT /api/users/profile - Updates name and bio for onboarded user
router.put('/profile', userController.updateProfile);

// GET /api/users/profile/:userId - Fetches public profile with Redis caching
router.get('/profile/:userId', userController.getUserProfile);

// GET /api/users/discover - Fetches cursor-paginated people with Redis caching
router.get('/discover', userController.getDiscoverUsers);

module.exports = router;
