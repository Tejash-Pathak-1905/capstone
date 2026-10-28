jest.mock('../src/db/postgres');
jest.mock('../src/db/redis/cacheService');

const { query } = require('../src/db/postgres');
const cacheService = require('../src/db/redis/cacheService');
const {
  getMe,
  completeProfile,
  getUserProfile,
  getDiscoverUsers,
  updateProfile,
} = require('../src/controllers/userController');

describe('User Controller Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'user@example.com',
        newUser: false,
      },
      params: {},
      query: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('getMe', () => {
    test('returns authenticated user profile data successfully', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            id: req.user.id,
            email: 'user@example.com',
            name: 'Alex Rivera',
            username: 'alex99',
            bio: 'Software engineer',
            new_user: false,
            created_at: '2026-10-28T10:00:00Z',
            updated_at: '2026-10-28T10:00:00Z',
          },
        ],
      });

      await getMe(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: expect.objectContaining({
            id: req.user.id,
            username: 'alex99',
            newUser: false,
          }),
        })
      );
    });

    test('returns 404 when user is not found in database', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await getMe(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'User not found',
        })
      );
    });

    test('calls next(error) when database query fails', async () => {
      const dbError = new Error('Database connection failed');
      query.mockRejectedValueOnce(dbError);

      await getMe(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('completeProfile', () => {
    test('returns 409 Conflict when username is already taken by another user', async () => {
      req.body = {
        name: 'Alex Rivera',
        username: 'existing_username',
        bio: 'Hello world',
      };

      // Mock username collision lookup
      query.mockResolvedValueOnce({
        rows: [{ id: '999e4567-e89b-12d3-a456-426614174999' }],
      });

      await completeProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('already taken'),
        })
      );
    });

    test('completes profile, flips new_user to false, and purges Redis cache keys', async () => {
      req.body = {
        name: 'Alex Rivera',
        username: 'alex_unique',
        bio: 'Coding and coffee',
      };

      // 1. Username is unique
      query.mockResolvedValueOnce({ rows: [] });

      // 2. Update user query
      query.mockResolvedValueOnce({
        rows: [
          {
            id: req.user.id,
            email: req.user.email,
            name: req.body.name,
            username: req.body.username,
            bio: req.body.bio,
            new_user: false,
            created_at: '2026-10-28T10:00:00Z',
            updated_at: '2026-10-28T10:05:00Z',
          },
        ],
      });

      cacheService.del = jest.fn().mockResolvedValue(true);
      cacheService.delPattern = jest.fn().mockResolvedValue(1);

      await completeProfile(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Profile completed successfully',
          token: expect.any(String),
          user: expect.objectContaining({
            newUser: false,
            username: 'alex_unique',
          }),
        })
      );

      // Verify Redis eviction
      expect(cacheService.del).toHaveBeenCalledWith(`user:profile:${req.user.id}`);
      expect(cacheService.delPattern).toHaveBeenCalledWith('discover:page:*');
    });
  });

  describe('getUserProfile', () => {
    test('returns profile from Redis cache on cache hit without querying database', async () => {
      const targetUserId = 'target-user-uuid';
      req.params = { userId: targetUserId };

      const cachedProfile = {
        id: targetUserId,
        name: 'Taylor Swift',
        username: 'taylor13',
        bio: 'Singer-songwriter',
      };

      cacheService.get = jest.fn().mockResolvedValueOnce(cachedProfile);

      await getUserProfile(req, res, next);

      expect(cacheService.get).toHaveBeenCalledWith(`user:profile:${targetUserId}`);
      expect(query).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        source: 'cache',
        profile: cachedProfile,
      });
    });

    test('on cache miss, queries database, populates Redis cache, and returns profile', async () => {
      const targetUserId = 'target-user-uuid';
      req.params = { userId: targetUserId };

      cacheService.get = jest.fn().mockResolvedValueOnce(null);
      cacheService.set = jest.fn().mockResolvedValueOnce(true);

      query.mockResolvedValueOnce({
        rows: [
          {
            id: targetUserId,
            name: 'Morgan Freeman',
            username: 'morgan_f',
            bio: 'Narrator',
            created_at: '2026-10-28T10:00:00Z',
          },
        ],
      });

      await getUserProfile(req, res, next);

      expect(query).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith(
        `user:profile:${targetUserId}`,
        expect.objectContaining({ username: 'morgan_f' }),
        900
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          source: 'database',
          profile: expect.objectContaining({ username: 'morgan_f' }),
        })
      );
    });

    test('returns 404 when target profile is not found in database', async () => {
      req.params = { userId: 'non-existent-user' };

      cacheService.get = jest.fn().mockResolvedValueOnce(null);
      query.mockResolvedValueOnce({ rows: [] });

      await getUserProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('User profile not found'),
        })
      );
    });
  });

  describe('getDiscoverUsers', () => {
    test('returns discover feed from cache when present', async () => {
      req.query = { limit: '15' };

      const cachedFeed = {
        users: [{ id: 'u1', username: 'alice' }],
        nextCursor: '2026-10-28T09:00:00Z',
      };

      cacheService.get = jest.fn().mockResolvedValueOnce(cachedFeed);

      await getDiscoverUsers(req, res, next);

      expect(cacheService.get).toHaveBeenCalledWith('discover:page:initial:15');
      expect(query).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          source: 'cache',
          users: cachedFeed.users,
          nextCursor: cachedFeed.nextCursor,
        })
      );
    });

    test('on cache miss, queries database excluding current user and new_user=TRUE', async () => {
      req.query = { limit: '15' };

      cacheService.get = jest.fn().mockResolvedValueOnce(null);
      cacheService.set = jest.fn().mockResolvedValueOnce(true);

      const dbUsers = [
        {
          id: 'user-2',
          name: 'Bob',
          username: 'bob2',
          bio: 'Dev',
          created_at: '2026-10-28T08:00:00Z',
        },
      ];

      query.mockResolvedValueOnce({ rows: dbUsers });

      await getDiscoverUsers(req, res, next);

      expect(query).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          source: 'database',
          count: 1,
          users: dbUsers,
        })
      );
    });
  });

  describe('updateProfile', () => {
    test('updates name and bio, invalidates Redis caches, and returns updated user', async () => {
      req.body = {
        name: 'Alex Updated',
        bio: 'Updated bio description',
      };

      query.mockResolvedValueOnce({
        rows: [
          {
            id: req.user.id,
            email: req.user.email,
            name: req.body.name,
            username: 'alex99',
            bio: req.body.bio,
            new_user: false,
            created_at: '2026-10-28T10:00:00Z',
            updated_at: '2026-10-28T10:15:00Z',
          },
        ],
      });

      cacheService.del = jest.fn().mockResolvedValue(true);
      cacheService.delPattern = jest.fn().mockResolvedValue(1);

      await updateProfile(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: expect.objectContaining({
            name: 'Alex Updated',
            bio: 'Updated bio description',
          }),
        })
      );

      expect(cacheService.del).toHaveBeenCalledWith(`user:profile:${req.user.id}`);
      expect(cacheService.delPattern).toHaveBeenCalledWith('discover:page:*');
    });
  });
});
