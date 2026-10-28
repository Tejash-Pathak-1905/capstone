const mongoose = require('mongoose');
const config = require('../../config');

let isConnected = false;

async function connectMongo() {
  if (isConnected) return mongoose.connection;

  try {
    const conn = await mongoose.connect(config.mongodb.uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('[MongoDB] Connected successfully to:', config.mongodb.uri);
    return conn;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error.message);
    throw error;
  }
}

async function checkMongoHealth() {
  return mongoose.connection.readyState === 1;
}

async function closeMongo() {
  if (isConnected || mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    isConnected = false;
  }
}

module.exports = {
  connectMongo,
  checkMongoHealth,
  closeMongo,
  mongoose,
};
