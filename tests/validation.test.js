const {
  validateCompleteProfile,
  validateInitiateConversation,
  validateSendMessage,
} = require('../src/middleware/validationMiddleware');

describe('Input Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('validateCompleteProfile', () => {
    test('rejects empty or missing name with 400', () => {
      req.body = { name: '', username: 'alex99' };
      validateCompleteProfile(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects invalid username (too short or special characters) with 400', () => {
      req.body = { name: 'Alex', username: 'a!' };
      validateCompleteProfile(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);

      req.body = { name: 'Alex', username: 'ab' }; // less than 3 chars
      validateCompleteProfile(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects bio exceeding 500 characters with 400', () => {
      req.body = { name: 'Alex', username: 'alex99', bio: 'a'.repeat(501) };
      validateCompleteProfile(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('accepts valid name, username, and bio and trims input', () => {
      req.body = { name: '  Alex Smith  ', username: '  Alex_99  ', bio: ' Software engineer. ' };
      validateCompleteProfile(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.name).toBe('Alex Smith');
      expect(req.body.username).toBe('alex_99');
      expect(req.body.bio).toBe('Software engineer.');
    });
  });

  describe('validateInitiateConversation', () => {
    test('rejects missing or invalid UUID recipientId with 400', () => {
      req.body = { recipientId: 'not-a-uuid' };
      validateInitiateConversation(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('accepts valid UUID recipientId', () => {
      req.body = { recipientId: '123e4567-e89b-12d3-a456-426614174000' };
      validateInitiateConversation(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateSendMessage', () => {
    test('rejects empty or whitespace content with 400', () => {
      req.body = { content: '   ' };
      validateSendMessage(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects content exceeding 2000 characters with 400', () => {
      req.body = { content: 'a'.repeat(2001) };
      validateSendMessage(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('accepts valid content and trims input', () => {
      req.body = { content: '  Hello world!  ' };
      validateSendMessage(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.content).toBe('Hello world!');
    });
  });
});
