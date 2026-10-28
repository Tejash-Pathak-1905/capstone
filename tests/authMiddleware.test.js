const jwt = require('jsonwebtoken');
const config = require('../src/config');
const {
  authMiddleware,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
} = require('../src/middleware/authMiddleware');

describe('Auth Middleware & Token Utilities', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      cookies: {},
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('generateToken creates a valid signed JWT containing userId, email, and newUser', () => {
    const user = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'alex@example.com',
      new_user: true,
    };

    const token = generateToken(user);
    expect(typeof token).toBe('string');

    const decoded = jwt.verify(token, config.jwt.secret);
    expect(decoded.userId).toBe(user.id);
    expect(decoded.email).toBe(user.email);
    expect(decoded.newUser).toBe(true);
  });

  test('authMiddleware rejects requests with missing token (returns 401)', async () => {
    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Authentication token is required'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('authMiddleware rejects invalid/tampered tokens (returns 401)', async () => {
    req.headers.authorization = 'Bearer invalid.tampered.token';

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Token is invalid or expired'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('authMiddleware successfully verifies valid token from cookie', async () => {
    const user = { id: 'user-uuid-1', email: 'test@example.com', new_user: false };
    const token = generateToken(user);

    req.cookies[config.jwt.cookieName] = token;

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('user-uuid-1');
    expect(req.user.email).toBe('test@example.com');
    expect(req.user.newUser).toBe(false);
  });

  test('authMiddleware successfully verifies valid token from Authorization header', async () => {
    const user = { id: 'user-uuid-2', email: 'header@example.com', new_user: true };
    const token = generateToken(user);

    req.headers.authorization = `Bearer ${token}`;

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('user-uuid-2');
    expect(req.user.newUser).toBe(true);
  });

  test('setAuthCookie and clearAuthCookie set and clear cookies properly', () => {
    setAuthCookie(res, 'sample.jwt.token');
    expect(res.cookie).toHaveBeenCalledWith(
      config.jwt.cookieName,
      'sample.jwt.token',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      })
    );

    clearAuthCookie(res);
    expect(res.clearCookie).toHaveBeenCalledWith(
      config.jwt.cookieName,
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      })
    );
  });
});
