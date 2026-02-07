// utils/gracefulShutdown.js
const mongoose = require('mongoose');

const gracefulShutdown = (server, redisClient) => {
  const shutdown = async (signal) => {
    console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);
    
    try {
      // 1. Stop accepting new connections
      console.log('🛑 Closing HTTP server...');
      await new Promise((resolve) => {
        server.close(() => {
          console.log('✅ HTTP server closed');
          resolve();
        });
      });

      // 2. Close Redis connection
      console.log('🔌 Closing Redis connection...');
      if (redisClient && typeof redisClient.disconnect === 'function') {
        await redisClient.disconnect();
        console.log('✅ Redis connection closed');
      } else {
        console.log('⚠️  Redis client not available for disconnection');
      }

      // 3. Close MongoDB connection
      console.log('🗄️  Closing MongoDB connection...');
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
        console.log('✅ MongoDB connection closed');
      } else {
        console.log('⚠️  MongoDB already disconnected');
      }

      console.log('👋 All connections closed. Goodbye!');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle different termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
};

module.exports = gracefulShutdown;  // Ensure this is exported