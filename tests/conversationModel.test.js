const Conversation = require('../src/db/mongo/models/Conversation');

describe('Conversation Model & Idempotency', () => {
  test('generateParticipantHash returns sorted compound hash regardless of parameter order', () => {
    const userA = 'aaa-111';
    const userB = 'zzz-999';

    const hash1 = Conversation.generateParticipantHash(userA, userB);
    const hash2 = Conversation.generateParticipantHash(userB, userA);

    expect(hash1).toBe('aaa-111:zzz-999');
    expect(hash2).toBe('aaa-111:zzz-999');
    expect(hash1).toBe(hash2);
  });

  test('getOrCreateConversation throws error if participant is missing or user chats with self', async () => {
    await expect(Conversation.getOrCreateConversation('u1', null)).rejects.toThrow(
      'Both user IDs are required to initiate a conversation'
    );

    await expect(Conversation.getOrCreateConversation('u1', 'u1')).rejects.toThrow(
      'Cannot initiate a conversation with oneself'
    );
  });
});
