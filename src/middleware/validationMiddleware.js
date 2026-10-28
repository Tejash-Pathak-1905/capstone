const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

function validateCompleteProfile(req, res, next) {
  const { name, username, bio } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Name is required and cannot be empty',
    });
  }

  if (name.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Name cannot exceed 100 characters',
    });
  }

  if (!username || typeof username !== 'string' || !USERNAME_REGEX.test(username.trim())) {
    return res.status(400).json({
      success: false,
      error: 'Username must be between 3 and 30 characters and contain only letters, numbers, and underscores',
    });
  }

  if (bio !== undefined && bio !== null) {
    if (typeof bio !== 'string' || bio.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Bio must be a string up to 500 characters',
      });
    }
  }

  req.body.name = name.trim();
  req.body.username = username.trim().toLowerCase();
  req.body.bio = (bio || '').trim();

  next();
}

function validateInitiateConversation(req, res, next) {
  const { recipientId } = req.body;

  if (!recipientId || typeof recipientId !== 'string' || !UUID_REGEX.test(recipientId)) {
    return res.status(400).json({
      success: false,
      error: 'Valid recipient UUID is required',
    });
  }

  next();
}

function validateSendMessage(req, res, next) {
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message content cannot be empty',
    });
  }

  if (content.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Message content cannot exceed 2000 characters',
    });
  }

  req.body.content = content.trim();
  next();
}

module.exports = {
  validateCompleteProfile,
  validateInitiateConversation,
  validateSendMessage,
};
