const jwt = require('jsonwebtoken');
const config = require('../config');
const Conversation = require('../db/mongo/models/Conversation');
const Message = require('../db/mongo/models/Message');

/**
 * Initializes and manages WebSocket connections and event handlers
 * @param {import('socket.io').Server} io - Socket.io server instance
 */
function initializeSocketHandlers(io) {
  // Authentication middleware for WebSocket handshakes
  io.use((socket, next) => {
    try {
      let token = socket.handshake.auth ? socket.handshake.auth.token : null;

      // Also check headers cookies if auth token not in handshake auth object
      if (!token && socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, pair) => {
          const [key, val] = pair.trim().split('=');
          acc[key] = val;
          return acc;
        }, {});
        token = cookies[config.jwt.cookieName];
      }

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret);
      socket.user = {
        id: decoded.userId || decoded.id,
        email: decoded.email,
        newUser: decoded.newUser === true || decoded.new_user === true,
      };

      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.user.id} (Socket: ${socket.id})`);

    // Event: Join user's personal notification room
    socket.on('join_user', () => {
      if (socket.user && socket.user.id) {
        socket.join(String(socket.user.id));
      }
    });

    // Event: Join a specific 1-on-1 conversation room
    socket.on('join_room', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) {
          if (callback) callback({ success: false, error: 'conversationId is required' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          if (callback) callback({ success: false, error: 'Conversation not found' });
          return;
        }

        if (!conversation.participants.includes(socket.user.id)) {
          if (callback) callback({ success: false, error: 'Access denied: Not a participant' });
          return;
        }

        socket.join(String(conversationId));
        console.log(`[Socket] User ${socket.user.id} joined room ${conversationId}`);

        if (callback) callback({ success: true, conversationId });
        socket.emit('room_joined', { conversationId });
      } catch (error) {
        console.error('[Socket] join_room error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Event: Leave a conversation room
    socket.on('leave_room', ({ conversationId }) => {
      if (conversationId) {
        socket.leave(String(conversationId));
        console.log(`[Socket] User ${socket.user.id} left room ${conversationId}`);
      }
    });

    // Event: Send a real-time text message
    socket.on('send_message', async ({ conversationId, recipientId, content }, callback) => {
      try {
        // Enforce soft gatekeeper: new users with incomplete profiles cannot send messages
        if (socket.user.newUser) {
          const errPayload = {
            code: 'PROFILE_INCOMPLETE',
            message: 'You must complete your profile before sending messages',
          };
          socket.emit('error', errPayload);
          if (callback) callback({ success: false, ...errPayload });
          return;
        }

        if (!conversationId || !content || typeof content !== 'string' || content.trim().length === 0) {
          if (callback) callback({ success: false, error: 'Invalid message payload' });
          return;
        }

        const trimmedContent = content.trim();
        if (trimmedContent.length > 2000) {
          if (callback) callback({ success: false, error: 'Message content exceeds 2000 characters' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          if (callback) callback({ success: false, error: 'Conversation not found' });
          return;
        }

        if (!conversation.participants.includes(socket.user.id)) {
          if (callback) callback({ success: false, error: 'Access denied: Not a participant' });
          return;
        }

        const targetRecipientId =
          recipientId || conversation.participants.find((p) => p !== socket.user.id);

        // Persist message in MongoDB
        const message = await Message.create({
          conversationId: conversation._id,
          senderId: socket.user.id,
          recipientId: targetRecipientId,
          content: trimmedContent,
        });

        // Update conversation's lastMessage
        conversation.lastMessage = {
          text: trimmedContent,
          senderId: socket.user.id,
          sentAt: message.createdAt,
        };
        await conversation.save();

        const messagePayload = {
          id: message._id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          recipientId: message.recipientId,
          content: message.content,
          read: message.read,
          createdAt: message.createdAt,
        };

        // Broadcast to all sockets in the conversation room
        io.to(String(conversationId)).emit('receive_message', messagePayload);

        // Also notify recipient's personal user room for instant cross-tab notification & unread badges
        if (targetRecipientId) {
          io.to(String(targetRecipientId)).emit('receive_message', messagePayload);
        }

        if (callback) callback({ success: true, message: messagePayload });
      } catch (error) {
        console.error('[Socket] send_message error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.user.id} (${socket.id})`);
    });
  });
}

module.exports = { initializeSocketHandlers };
