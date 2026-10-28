const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { initializeSocketHandlers } = require('../src/sockets/socketHandler');
const Conversation = require('../src/db/mongo/models/Conversation');
const Message = require('../src/db/mongo/models/Message');

jest.mock('../src/db/mongo/models/Conversation');
jest.mock('../src/db/mongo/models/Message');

describe('Socket.io Real-Time WebSocket Handlers', () => {
  let io, middlewareFn, connectionHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    io = {
      use: jest.fn((fn) => {
        middlewareFn = fn;
      }),
      on: jest.fn((event, fn) => {
        if (event === 'connection') {
          connectionHandler = fn;
        }
      }),
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    };

    initializeSocketHandlers(io);
  });

  describe('WebSocket Handshake Authentication Middleware', () => {
    test('rejects handshake when token is missing from auth object and cookies', () => {
      const socket = {
        handshake: {
          auth: {},
          headers: {},
        },
      };
      const next = jest.fn();

      middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toContain('Token required');
    });

    test('rejects handshake when token is invalid or expired', () => {
      const socket = {
        handshake: {
          auth: { token: 'invalid.jwt.token' },
          headers: {},
        },
      };
      const next = jest.fn();

      middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toContain('Invalid or expired token');
    });

    test('accepts handshake when valid token is in auth object and attaches socket.user', () => {
      const userPayload = {
        userId: '123e4567-e89b-12d3-a456-426614174001',
        email: 'alex@example.com',
        newUser: false,
      };
      const token = jwt.sign(userPayload, config.jwt.secret);

      const socket = {
        handshake: {
          auth: { token },
          headers: {},
        },
      };
      const next = jest.fn();

      middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.user).toEqual({
        id: userPayload.userId,
        email: userPayload.email,
        newUser: false,
      });
    });

    test('accepts handshake when valid token is provided via cookie header', () => {
      const userPayload = {
        userId: '123e4567-e89b-12d3-a456-426614174001',
        email: 'alex@example.com',
        newUser: true,
      };
      const token = jwt.sign(userPayload, config.jwt.secret);

      const socket = {
        handshake: {
          auth: {},
          headers: {
            cookie: `other=123; ${config.jwt.cookieName}=${token}; test=abc`,
          },
        },
      };
      const next = jest.fn();

      middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.user.newUser).toBe(true);
    });
  });

  describe('Socket Events (join_room, leave_room, send_message)', () => {
    let socket, eventListeners;

    beforeEach(() => {
      eventListeners = {};
      socket = {
        id: 'socket-test-123',
        user: {
          id: '123e4567-e89b-12d3-a456-426614174001',
          email: 'alex@example.com',
          newUser: false,
        },
        join: jest.fn(),
        leave: jest.fn(),
        emit: jest.fn(),
        on: jest.fn((event, handler) => {
          eventListeners[event] = handler;
        }),
      };

      connectionHandler(socket);
    });

    test('join_room joins room and confirms when user is participant', async () => {
      const conversationId = '65a000000000000000000001';
      Conversation.findById.mockResolvedValueOnce({
        _id: conversationId,
        participants: [socket.user.id, 'recipient-uuid'],
      });

      const callback = jest.fn();
      await eventListeners.join_room({ conversationId }, callback);

      expect(socket.join).toHaveBeenCalledWith(conversationId);
      expect(socket.emit).toHaveBeenCalledWith('room_joined', { conversationId });
      expect(callback).toHaveBeenCalledWith({ success: true, conversationId });
    });

    test('join_room denies access when user is not a participant', async () => {
      const conversationId = '65a000000000000000000001';
      Conversation.findById.mockResolvedValueOnce({
        _id: conversationId,
        participants: ['other-user-1', 'other-user-2'],
      });

      const callback = jest.fn();
      await eventListeners.join_room({ conversationId }, callback);

      expect(socket.join).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Not a participant'),
        })
      );
    });

    test('send_message is BLOCKED by soft gatekeeper when socket.user.newUser is true', async () => {
      socket.user.newUser = true;
      const callback = jest.fn();

      await eventListeners.send_message(
        {
          conversationId: 'conv-123',
          content: 'Hello world',
        },
        callback
      );

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          code: 'PROFILE_INCOMPLETE',
        })
      );
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'PROFILE_INCOMPLETE',
        })
      );
      expect(Message.create).not.toHaveBeenCalled();
    });

    test('send_message persists message and broadcasts receive_message to the conversation room', async () => {
      const conversationId = '65a000000000000000000001';
      const recipientId = 'recipient-uuid';
      const content = 'Hello there!';

      const mockConversation = {
        _id: conversationId,
        participants: [socket.user.id, recipientId],
        save: jest.fn().mockResolvedValue(true),
      };
      Conversation.findById.mockResolvedValueOnce(mockConversation);
      Conversation.findByIdAndUpdate = jest.fn().mockResolvedValue(true);

      const mockCreatedMessage = {
        _id: 'msg-999',
        conversationId,
        senderId: socket.user.id,
        recipientId,
        content,
        createdAt: new Date(),
      };
      Message.create.mockResolvedValueOnce(mockCreatedMessage);

      const callback = jest.fn();
      await eventListeners.send_message(
        { conversationId, recipientId, content },
        callback
      );

      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId,
          senderId: socket.user.id,
          content,
        })
      );
      expect(io.to).toHaveBeenCalledWith(conversationId);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.objectContaining({ content }),
        })
      );
    });

    test('leave_room leaves the conversation room', () => {
      eventListeners.leave_room({ conversationId: 'conv-123' });
      expect(socket.leave).toHaveBeenCalledWith('conv-123');
    });
  });
});
