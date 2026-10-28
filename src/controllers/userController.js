const { query } = require('../db/postgres');
const cacheService = require('../db/redis/cacheService');
const { generateToken, setAuthCookie } = require('../middleware/authMiddleware');

/**
 * Returns currently authenticated user details
 */
async function getMe(req, res, next) {
  try {
    const userResult = await query(
      'SELECT id, email, name, username, bio, new_user, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = userResult.rows[0];
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        bio: user.bio,
        newUser: user.new_user,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submits onboarding profile details, flipping new_user to FALSE
 */
async function completeProfile(req, res, next) {
  const { name, username, bio } = req.body;
  const userId = req.user.id;

  try {
    // 1. Check if username is already taken by another user
    const existingUsername = await query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username, userId]
    );

    if (existingUsername.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Username is already taken. Please choose another username.',
      });
    }

    // 2. Update user row and flip new_user to false
    const updateResult = await query(
      `UPDATE users
       SET name = $1, username = $2, bio = $3, new_user = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, email, name, username, bio, new_user, created_at, updated_at`,
      [name, username, bio, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const updatedUser = updateResult.rows[0];

    // 3. Re-issue updated JWT session with newUser = false
    const token = generateToken(updatedUser);
    setAuthCookie(res, token);

    // 4. Invalidate related Redis caches
    await cacheService.del(`user:profile:${userId}`);
    await cacheService.delPattern('discover:page:*');

    return res.json({
      success: true,
      message: 'Profile completed successfully',
      token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        username: updatedUser.username,
        bio: updatedUser.bio,
        newUser: updatedUser.new_user,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates an existing user's profile details
 */
async function updateProfile(req, res, next) {
  const { name, bio } = req.body;
  const userId = req.user.id;

  try {
    const updateResult = await query(
      `UPDATE users
       SET name = COALESCE($1, name), bio = COALESCE($2, bio), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, email, name, username, bio, new_user, created_at, updated_at`,
      [name, bio, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = updateResult.rows[0];

    // Invalidate caches
    await cacheService.del(`user:profile:${userId}`);
    await cacheService.delPattern('discover:page:*');

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        bio: user.bio,
        newUser: user.new_user,
        updatedAt: user.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetches a public profile by user ID with Redis cache-aside
 */
async function getUserProfile(req, res, next) {
  const { userId } = req.params;

  try {
    const cacheKey = `user:profile:${userId}`;
    const cachedProfile = await cacheService.get(cacheKey);

    if (cachedProfile) {
      return res.json({
        success: true,
        source: 'cache',
        profile: cachedProfile,
      });
    }

    const userResult = await query(
      'SELECT id, name, username, bio, created_at FROM users WHERE id = $1 AND new_user = FALSE',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found or profile setup is incomplete',
      });
    }

    const profile = userResult.rows[0];

    // Cache profile for 15 minutes (900 seconds)
    await cacheService.set(cacheKey, profile, 900);

    return res.json({
      success: true,
      source: 'database',
      profile,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetches cursor-paginated profiles for the Discover People page with Redis cache-aside
 */
async function getDiscoverUsers(req, res, next) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
  const cursor = req.query.cursor ? req.query.cursor.trim() : null;
  const currentUserId = req.user ? req.user.id : null;

  try {
    const cacheKey = `discover:page:${cursor || 'initial'}:${limit}`;
    const cachedData = await cacheService.get(cacheKey);

    if (cachedData) {
      return res.json({
        success: true,
        source: 'cache',
        ...cachedData,
      });
    }

    let queryText = `
      SELECT id, name, username, bio, created_at
      FROM users
      WHERE new_user = FALSE
    `;
    const params = [];

    // Exclude current user from their own discovery feed
    if (currentUserId) {
      params.push(currentUserId);
      queryText += ` AND id != $${params.length}`;
    }

    // Cursor pagination using created_at timestamp
    if (cursor) {
      params.push(cursor);
      queryText += ` AND created_at < $${params.length}::timestamptz`;
    }

    params.push(limit);
    queryText += ` ORDER BY created_at DESC LIMIT $${params.length};`;

    const result = await query(queryText, params);
    const users = result.rows;

    const nextCursor =
      users.length === limit ? users[users.length - 1].created_at.toISOString() : null;

    const responsePayload = {
      users,
      nextCursor,
      count: users.length,
      limit,
    };

    // Cache for 5 minutes (300 seconds)
    await cacheService.set(cacheKey, responsePayload, 300);

    return res.json({
      success: true,
      source: 'database',
      ...responsePayload,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMe,
  completeProfile,
  updateProfile,
  getUserProfile,
  getDiscoverUsers,
};
