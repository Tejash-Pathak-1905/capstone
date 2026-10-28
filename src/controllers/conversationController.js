const Conversation = require('../db/mongo/models/Conversation');
const Message = require('../db/mongo/models/Message');
const { query } = require('../db/postgres');

/**
 * Idempotently initiates or retrieves a 1-on-1 conversation
 */
async function initiateConversation(req, res, next) {
  const { recipientId } = req.body;
  const senderId = req.user.id;

  if (senderId === recipientId) {
    return res.status(400).json({
      success: false,
      error: 'Cannot initiate a conversation with yourself',
    });
  }

  try {
    // 1. Verify recipient exists in PostgreSQL
    const recipientRes = await query(
      'SELECT id, name, username, bio, new_user FROM users WHERE id = $1',
      [recipientId]
    );

    if (recipientRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipient user not found',
      });
    }

    const recipient = recipientRes.rows[0];

    // 2. Retrieve or create conversation in MongoDB
    const conversation = await Conversation.getOrCreateConversation(senderId, recipientId);

    return res.json({
      success: true,
      conversationId: conversation._id,
      conversation: {
        id: conversation._id,
        participants: conversation.participants,
        lastMessage: conversation.lastMessage,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      recipient: {
        id: recipient.id,
        name: recipient.name,
        username: recipient.username,
        bio: recipient.bio,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves all conversations for the authenticated user with recipient metadata
 */
async function getUserConversations(req, res, next) {
  const userId = req.user.id;

  try {
    const conversations = await Conversation.find({ participants: userId })
      .sort({ updatedAt: -1 })
      .lean();

    if (conversations.length === 0) {
      return res.json({
        success: true,
        conversations: [],
      });
    }

    // Extract other participant IDs to fetch profile data in batch
    const recipientIds = conversations.map((conv) =>
      conv.participants.find((p) => p !== userId)
    ).filter(Boolean);

    let recipientMap = new Map();
    if (recipientIds.length > 0) {
      const placeholders = recipientIds.map((_, i) => `$${i + 1}`).join(',');
      const usersRes = await query(
        `SELECT id, name, username, bio FROM users WHERE id IN (${placeholders})`,
        recipientIds
      );
      usersRes.rows.forEach((u) => recipientMap.set(u.id, u));
    }

    const enrichedConversations = conversations.map((conv) => {
      const recipientId = conv.participants.find((p) => p !== userId);
      return {
        id: conv._id,
        participants: conv.participants,
        lastMessage: conv.lastMessage,
        recipient: recipientMap.get(recipientId) || { id: recipientId, name: 'Unknown User' },
        updatedAt: conv.updatedAt,
      };
    });

    return res.json({
      success: true,
      conversations: enrichedConversations,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves chronological message history for a specific conversation
 */
async function getConversationMessages(req, res, next) {
  const { id } = req.params;
  const userId = req.user.id;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const before = req.query.before ? new Date(req.query.before) : null;

  try {
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    // Verify requesting user is one of the participants
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not a participant in this conversation',
      });
    }

    const messageQuery = { conversationId: conversation._id };
    if (before && !isNaN(before.getTime())) {
      messageQuery.createdAt = { $lt: before };
    }

    const messages = await Message.find(messageQuery)
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      conversationId: conversation._id,
      messages: messages.map((m) => ({
        id: m._id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        recipientId: m.recipientId,
        content: m.content,
        read: m.read,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Sends a message via REST endpoint (useful as HTTP fallback or in testing)
 */
async function sendMessageHttp(req, res, next) {
  const { id } = req.params;
  const { content } = req.body;
  const senderId = req.user.id;

  try {
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    if (!conversation.participants.includes(senderId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not a participant in this conversation',
      });
    }

    const recipientId = conversation.participants.find((p) => p !== senderId);

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      recipientId,
      content,
    });

    conversation.lastMessage = {
      text: content,
      senderId,
      sentAt: message.createdAt,
    };
    await conversation.save();

    return res.status(201).json({
      success: true,
      message: {
        id: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        recipientId: message.recipientId,
        content: message.content,
        read: message.read,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  initiateConversation,
  getUserConversations,
  getConversationMessages,
  sendMessageHttp,
};
