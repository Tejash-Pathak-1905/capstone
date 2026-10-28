const { onboardingGateMiddleware } = require('../src/middleware/onboardingGateMiddleware');

describe('Onboarding Gatekeeper Middleware (Soft Gatekeeper)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: null,
      method: 'GET',
      path: '/api/users/me',
      baseUrl: '',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('calls next() without restriction if user has completed onboarding (newUser === false)', () => {
    req.user = { id: 'u1', newUser: false };
    req.method = 'POST';
    req.path = '/api/conversations/initiate';

    onboardingGateMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('allows GET /api/users/me when newUser === true', () => {
    req.user = { id: 'u1', newUser: true };
    req.method = 'GET';
    req.path = '/api/users/me';

    onboardingGateMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('allows POST /api/users/complete-profile when newUser === true', () => {
    req.user = { id: 'u1', newUser: true };
    req.method = 'POST';
    req.path = '/api/users/complete-profile';

    onboardingGateMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('allows GET /api/users/discover (read-only) when newUser === true', () => {
    req.user = { id: 'u1', newUser: true };
    req.method = 'GET';
    req.path = '/api/users/discover';

    onboardingGateMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('allows GET /api/users/profile/:userId (read-only) when newUser === true', () => {
    req.user = { id: 'u1', newUser: true };
    req.method = 'GET';
    req.path = '/api/users/profile/123e4567-e89b-12d3-a456-426614174000';

    onboardingGateMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('BLOCKS POST /api/conversations/initiate with 403 PROFILE_INCOMPLETE when newUser === true', () => {
    req.user = { id: 'u1', newUser: true };
    req.method = 'POST';
    req.path = '/api/conversations/initiate';

    onboardingGateMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'PROFILE_INCOMPLETE',
      })
    );
  });

  test('BLOCKS POST /api/conversations/:id/messages with 403 when newUser === true', () => {
    req.user = { id: 'u1', newUser: true };
    req.method = 'POST';
    req.path = '/api/conversations/65a123/messages';

    onboardingGateMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PROFILE_INCOMPLETE',
      })
    );
  });
});
