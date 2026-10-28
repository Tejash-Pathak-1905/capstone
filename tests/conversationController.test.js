jest.mock('../src/db/postgres');
jest.mock('../src/db/mongo/models/Conversation');
jest.mock('../src/db/mongo/models/Message');

const { query } = require('../src/db/postgres');
const Conversation = require('../src/db/mongo/models/Conversation');
const Message = require('../src/db/mongo/models/Message');
const {
  initiateConversation,
  getUserConversations,
  getConversationMessages,
  sendMessageHttp,
} = require('../src/controllers/conversationController');

describe('Conversation Controller Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'sender@example.com',
        newUser: false,
      },
      params: {},
      query: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('initiateConversation', () => {
    test('returns 400 when attempting to start a conversation with self', async () => {
      req.body = { recipientId: req.user.id };

      await initiateConversation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Cannot initiate a conversation with yourself',
        })
      );
    });

    test('returns 404 when recipient user does not exist in PostgreSQL', async () => {
      req.body = { recipientId: '123e4567-e89b-12d3-a456-426614174999' };
      query.mockResolvedValueOnce({ rows: [] });

      await initiateConversation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Recipient user not found',
        })
      );
    });

    test('successfully initiates or returns existing conversation idempotently', async () => {
      const recipientId = '123e4567-e89b-12d3-a456-426614174002';
      req.body = { recipientId };

      query.mockResolvedValueOnce({
        rows: [
          {
            id: recipientId,
            name: 'Jordan Lee',
            username: 'jordan_l',
            bio: 'Tech enthusiast',
          },
        ],
      });

      const mockConversation = {
        _id: '65a000000000000000000001',
        participants: [req.user.id, recipientId],
        lastMessage: { text: '', senderId: null },
        createdAt: '2026-10-28T10:00:00Z',
        updatedAt: '2026-10-28T10:00:00Z',
      };

      Conversation.getOrCreateConversation.mockResolvedValueOnce(mockConversation);

      await initiateConversation(req, res, next);

      expect(Conversation.getOrCreateConversation).toHaveBeenCalledWith(
        req.user.id,
        recipientId
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          conversationId: mockConversation._id,
          recipient: expect.objectContaining({
            id: recipientId,
            username: 'jordan_l',
          }),
        })
      );
    });
  });

  describe('getUserConversations', () => {
    test('returns empty list if user has no active conversations', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValueOnce([]),
      };
      Conversation.find.mockReturnValueOnce(mockQuery);

      await getUserConversations(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        conversations: [],
      });
    });

    test('enriches conversations with recipient metadata from PostgreSQL', async () => {
      const recipientId = '123e4567-e89b-12d3-a456-426614174002';
      const mockConversations = [
        {
          _id: 'conv-1',
          participants: [req.user.id, recipientId],
          lastMessage: { text: 'Hey there!' },
          updatedAt: '2026-10-28T10:00:00Z',
        },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValueOnce(mockConversations),
      };
      Conversation.find.mockReturnValueOnce(mockQuery);

      query.mockResolvedValueOnce({
        rows: [
          {
            id: recipientId,
            name: 'Jordan Lee',
            username: 'jordan_l',
            bio: 'Tech enthusiast',
          },
        ],
      });

      await getUserConversations(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          conversations: expect.arrayContaining([
            expect.objectContaining({
              id: 'conv-1',
              recipient: expect.objectContaining({
                id: recipientId,
                name: 'Jordan Lee',
              }),
            }),
          ]),
        })
      );
    });
  });

  describe('getConversationMessages', () => {
    test('returns 404 when conversation is not found in MongoDB', async () => {
      req.params = { id: 'nonexistent-conv' };
      Conversation.findById.mockResolvedValueOnce(null);

      await getConversationMessages(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Conversation not found',
        })
      );
    });

    test('returns 403 when user is not a participant in the conversation', async () => {
      req.params = { id: 'conv-private' };
      Conversation.findById.mockResolvedValueOnce({
        _id: 'conv-private',
        participants: ['other-user-1', 'other-user-2'],
      });

      await getConversationMessages(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/not a participant/i),
        })
      );
    });

    test('returns chronological messages when user is authorized participant', async () => {
      req.params = { id: 'conv-123' };
      Conversation.findById.mockResolvedValueOnce({
        _id: 'conv-123',
        participants: [req.user.id, 'recipient-uuid'],
      });

      const mockMessages = [
        {
          _id: 'msg-1',
          conversationId: 'conv-123',
          senderId: req.user.id,
          recipientId: 'recipient-uuid',
          content: 'Hello!',
          read: false,
          createdAt: new Date('2026-10-28T10:00:00Z'),
        },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValueOnce(mockMessages),
      };
      Message.find.mockReturnValueOnce(mockQuery);

      await getConversationMessages(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          conversationId: 'conv-123',
          messages: expect.arrayContaining([
            expect.objectContaining({ content: 'Hello!' }),
          ]),
        })
      );
    });
  });

  describe('sendMessageHttp', () => {
    test('returns 404 when sending message to nonexistent conversation', async () => {
      req.params = { id: 'conv-missing' };
      req.body = { content: 'Hello' };
      Conversation.findById.mockResolvedValueOnce(null);

      await sendMessageHttp(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 403 when sender is not in conversation participants', async () => {
      req.params = { id: 'conv-blocked' };
      req.body = { content: 'Hello' };
      Conversation.findById.mockResolvedValueOnce({
        _id: 'conv-blocked',
        participants: ['u2', 'u3'],
      });

      await sendMessageHttp(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('creates message, updates conversation lastMessage, and returns 201', async () => {
      req.params = { id: 'conv-valid' };
      req.body = { content: 'Great to meet you!' };

      const mockConversation = {
        _id: 'conv-valid',
        participants: [req.user.id, 'u2'],
        lastMessage: {},
        save: jest.fn().mockResolvedValue(true),
      };
      Conversation.findById.mockResolvedValueOnce(mockConversation);

      const mockCreatedMessage = {
        _id: 'msg-new',
        conversationId: 'conv-valid',
        senderId: req.user.id,
        recipientId: 'u2',
        content: req.body.content,
        read: false,
        createdAt: new Date(),
      };
      Message.create.mockResolvedValueOnce(mockCreatedMessage);

      await sendMessageHttp(req, res, next);

      expect(Message.create).toHaveBeenCalled();
      expect(mockConversation.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.objectContaining({
            content: 'Great to meet you!',
          }),
        })
      );
    });
  });
});
