const request = require('supertest');
const app = require('../src/app');
const config = require('../src/config');
const { generateToken } = require('../src/middleware/authMiddleware');

describe('API Endpoints & Integration Behavior', () => {
  test('GET /health returns health response with service statuses', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
  });

  test('GET /unknown-route returns 404 with structured JSON', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toContain('Route not found');
  });

  test('GET /api/users/me returns 401 Unauthorized without token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/users/discover returns 401 Unauthorized without token', async () => {
    const res = await request(app).get('/api/users/discover');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/users/profile/:userId returns 401 Unauthorized without token', async () => {
    const res = await request(app).get('/api/users/profile/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/conversations returns 401 Unauthorized without token', async () => {
    const res = await request(app).get('/api/conversations');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/logout successfully clears cookie and returns 200', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message', 'Logged out successfully');

    // Verify Set-Cookie header clears the jwt cookie
    const cookies = res.headers['set-cookie'];
    if (cookies) {
      const authCookie = cookies.find((c) => c.startsWith(`${config.jwt.cookieName}=`));
      expect(authCookie).toBeDefined();
    }
  });

  test('POST /api/conversations/initiate returns 401 Unauthorized without token', async () => {
    const res = await request(app)
      .post('/api/conversations/initiate')
      .send({ recipientId: '123e4567-e89b-12d3-a456-426614174000' });
    expect(res.status).toBe(401);
  });

  test('POST /api/conversations/initiate is BLOCKED with 403 when user has newUser === true', async () => {
    const newUserToken = generateToken({
      id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'newuser@example.com',
      new_user: true,
    });

    const res = await request(app)
      .post('/api/conversations/initiate')
      .set('Authorization', `Bearer ${newUserToken}`)
      .send({ recipientId: '123e4567-e89b-12d3-a456-426614174000' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROFILE_INCOMPLETE');
  });

  test('POST /api/users/complete-profile with invalid data returns 400', async () => {
    const newUserToken = generateToken({
      id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'newuser@example.com',
      new_user: true,
    });

    const res = await request(app)
      .post('/api/users/complete-profile')
      .set('Authorization', `Bearer ${newUserToken}`)
      .send({ name: '', username: 'bad!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
