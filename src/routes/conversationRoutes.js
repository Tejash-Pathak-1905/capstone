const express = require('express');
const conversationController = require('../controllers/conversationController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { onboardingGateMiddleware } = require('../middleware/onboardingGateMiddleware');
const {
  validateInitiateConversation,
  validateSendMessage,
} = require('../middleware/validationMiddleware');

const router = express.Router();

// Both authentication and completed onboarding are strictly required
router.use(authMiddleware);
router.use(onboardingGateMiddleware);

// POST /api/conversations/initiate - Gets or creates 1-on-1 conversation
router.post('/initiate', validateInitiateConversation, conversationController.initiateConversation);

// GET /api/conversations - Lists all conversations for current user
router.get('/', conversationController.getUserConversations);

// GET /api/conversations/:id/messages - Fetches past messages
router.get('/:id/messages', conversationController.getConversationMessages);

// POST /api/conversations/:id/messages - REST fallback for sending messages
router.post('/:id/messages', validateSendMessage, conversationController.sendMessageHttp);

module.exports = router;
