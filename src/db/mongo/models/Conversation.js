const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [String],
      required: true,
      validate: [
        (val) => Array.isArray(val) && val.length === 2,
        'A 1-on-1 conversation must have exactly 2 participants',
      ],
    },
    participantHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastMessage: {
      text: { type: String, default: '' },
      senderId: { type: String }, // PostgreSQL UUID
      sentAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ updatedAt: -1 });

/**
 * Generates an idempotent sorted hash for two participant UUIDs
 * @param {string} userAId - PostgreSQL UUID
 * @param {string} userBId - PostgreSQL UUID
 * @returns {string} sorted compound key "UUID_A:UUID_B"
 */
ConversationSchema.statics.generateParticipantHash = function (userAId, userBId) {
  return [String(userAId), String(userBId)].sort().join(':');
};

/**
 * Idempotently retrieves an existing conversation between two users or creates a new one.
 * @param {string} userAId
 * @param {string} userBId
 * @returns {Promise<Document>}
 */
ConversationSchema.statics.getOrCreateConversation = async function (userAId, userBId) {
  if (!userAId || !userBId) {
    throw new Error('Both user IDs are required to initiate a conversation');
  }
  if (userAId === userBId) {
    throw new Error('Cannot initiate a conversation with oneself');
  }

  const hash = this.generateParticipantHash(userAId, userBId);
  const sortedParticipants = [String(userAId), String(userBId)].sort();

  let conversation = await this.findOne({ participantHash: hash });
  if (!conversation) {
    conversation = await this.create({
      participants: sortedParticipants,
      participantHash: hash,
      lastMessage: { text: '', senderId: null, sentAt: new Date() },
    });
  }
  return conversation;
};

module.exports = mongoose.model('Conversation', ConversationSchema);
