const cacheService = require('../src/db/redis/cacheService');

describe('CacheService & Invalidation Logic', () => {
  beforeEach(async () => {
    // Clear in-memory fallback store between tests
    cacheService.clearMemoryFallback();
  });

  test('set and get store and retrieve values accurately', async () => {
    const key = 'test:item:1';
    const data = { id: 1, name: 'Alex' };

    await cacheService.set(key, data, 60);
    const retrieved = await cacheService.get(key);

    expect(retrieved).toEqual(data);
  });

  test('get returns null for non-existent keys', async () => {
    const retrieved = await cacheService.get('non:existent:key');
    expect(retrieved).toBeNull();
  });

  test('del successfully removes a cached entry', async () => {
    const key = 'user:profile:123';
    await cacheService.set(key, { name: 'Jordan' }, 60);

    const beforeDel = await cacheService.get(key);
    expect(beforeDel).not.toBeNull();

    await cacheService.del(key);
    const afterDel = await cacheService.get(key);
    expect(afterDel).toBeNull();
  });

  test('delPattern evicts all keys matching a wildcard pattern', async () => {
    await cacheService.set('discover:page:1:15', [{ id: 1 }], 60);
    await cacheService.set('discover:page:2:15', [{ id: 2 }], 60);
    await cacheService.set('user:profile:1', { name: 'Taylor' }, 60);

    await cacheService.delPattern('discover:page:*');

    expect(await cacheService.get('discover:page:1:15')).toBeNull();
    expect(await cacheService.get('discover:page:2:15')).toBeNull();
    // Non-matching key must remain intact
    expect(await cacheService.get('user:profile:1')).not.toBeNull();
  });

  test('expired entries in memory cache return null', async () => {
    const key = 'short:lived:key';
    // Set expiry in the past
    cacheService.memoryCache.set(key, {
      value: { temp: true },
      expiry: Date.now() - 1000,
    });

    const result = await cacheService.get(key);
    expect(result).toBeNull();
    expect(cacheService.memoryCache.has(key)).toBe(false);
  });

  test('caches and invalidates user profile keys according to cache-aside pattern', async () => {
    const userId = 'user-uuid-123';
    const profileKey = `user:profile:${userId}`;
    const profile = { id: userId, username: 'testuser', bio: 'Hello world' };

    await cacheService.set(profileKey, profile, 900);
    const cached = await cacheService.get(profileKey);
    expect(cached).toEqual(profile);

    await cacheService.del(profileKey);
    const afterInvalidation = await cacheService.get(profileKey);
    expect(afterInvalidation).toBeNull();
  });

  test('caches and purges discover feed pages using pattern invalidation', async () => {
    const feed = [{ id: 'user-1' }, { id: 'user-2' }];
    const discoverKey = 'discover:page:initial:15';

    await cacheService.set(discoverKey, feed, 300);
    const cachedFeed = await cacheService.get(discoverKey);
    expect(cachedFeed).toEqual(feed);

    await cacheService.delPattern('discover:page:*');
    const afterPurge = await cacheService.get(discoverKey);
    expect(afterPurge).toBeNull();
  });
});
