/**
 * Soft Gatekeeper Middleware:
 * Allows read-only access (browsing profiles, viewing discover feed, fetching own status)
 * for users with `newUser === true`, but strictly blocks write actions (initiating conversations,
 * sending messages, updating profile) until the profile is completed.
 */
function onboardingGateMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: User context missing',
    });
  }

  // Fully onboarded users pass through immediately
  if (!req.user.newUser) {
    return next();
  }

  // Paths allowed for users who have newUser === true:
  // 1. Fetching own user details
  // 2. Submitting the onboarding form (complete-profile)
  // 3. Read-only profile viewing
  // 4. Read-only discover feed
  const path = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
  const method = req.method.toUpperCase();

  const isAllowed =
    (method === 'GET' && path === '/api/users/me') ||
    (method === 'POST' && path === '/api/users/complete-profile') ||
    (method === 'GET' && path === '/api/users/discover') ||
    (method === 'GET' && path.startsWith('/api/users/profile/')) ||
    path.startsWith('/api/auth/');

  if (isAllowed) {
    return next();
  }

  // Block all write actions and messaging
  return res.status(403).json({
    success: false,
    code: 'PROFILE_INCOMPLETE',
    message: 'You must complete your profile (name, username, bio) before performing this action',
  });
}

module.exports = { onboardingGateMiddleware };
