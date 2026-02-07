// server.js
require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");
const redisClient = require("./config/redis");
const gracefulShutdown = require("./utils/gracefulShutdown");

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Initialize Redis
    await redisClient.initialize();

    const PORT = process.env.PORT || 4000;
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost:27017'}`);
      console.log(`🔗 Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
    });

  

    // Setup graceful shutdown
    gracefulShutdown(server, redisClient);

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
