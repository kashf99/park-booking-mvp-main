const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const redisClient = require("./config/redis");
const { startEmailWorker } = require('./workers/emailWorker');
const bullBoardAdapter = require('./config/bullBoard');
// Route imports
const attractionRoutes = require("./routes/attraction.routes");
const bookingRoutes = require("./routes/booking.routes");

const app = express();

// ============================
// SECURITY MIDDLEWARE
// ============================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// ============================
// CORS CONFIGURATION
// ============================
app.use(
  cors({
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",")
      : ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-API-Key",
    ],
    exposedHeaders: ["X-Response-Time"],
  })
);

// ============================
// RESPONSE TIME HEADER
// ============================
// ❌ Don't set headers after 'finish' event (headers already sent).
// ✅ Instead, compute duration and store it *before* headers are sent.
app.use((req, res, next) => {
  const start = Date.now();

  // Compute duration right before sending response
  const originalSend = res.send;
  res.send = function (...args) {
    const duration = Date.now() - start;
    if (!res.headersSent) {
      res.setHeader("X-Response-Time", `${duration}ms`);
    }
    return originalSend.apply(res, args);
  };

  next();
});

// ============================
// BODY PARSING
// ============================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================
// LOGGING
// ============================
if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan(":method :url :status :response-time ms - :res[content-length]")
  );
}


// Start the email worker
// startEmailWorker();

// Bull Board UI
app.use('/admin/queues', bullBoardAdapter.getRouter());

// ============================
// HEALTH CHECK
// ============================
app.get("/health", async (req, res) => {
  const healthCheck = {
    timestamp: new Date().toISOString(),
    service: "Park Booking API",
    version: "1.0.0",
    status: "healthy",
    uptime: process.uptime(),
    checks: {
      mongodb: { status: "unknown", latency: 0 },
      redis: { status: "unknown", latency: 0 },
      memory: { status: "healthy", usage: process.memoryUsage() },
    },
  };

  try {
    // MongoDB status
    const mongoStart = Date.now();
    const mongoState = mongoose.connection.readyState;
    const mongoLatency = Date.now() - mongoStart;

    healthCheck.checks.mongodb.latency = mongoLatency;
    healthCheck.checks.mongodb.status =
      mongoState === 1 ? "healthy" : "unhealthy";
    healthCheck.checks.mongodb.readyState = mongoState;
    if (mongoState !== 1) healthCheck.status = "degraded";

    // Redis status
    const redisStart = Date.now();
    const redisHealth = await redisClient.healthCheck();
    const redisLatency = Date.now() - redisStart;

    healthCheck.checks.redis.latency = redisLatency;
    healthCheck.checks.redis.status = redisHealth.healthy
      ? "healthy"
      : "unhealthy";
    healthCheck.checks.redis.details = redisHealth;
    if (!redisHealth.healthy) healthCheck.status = "degraded";

    // Memory usage
    const memoryUsage = process.memoryUsage();
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (memoryPercent > 90) {
      healthCheck.checks.memory.status = "warning";
      healthCheck.status = "degraded";
    }

    // Status code logic
    const statusCode =
      healthCheck.status === "healthy" ? 200 : healthCheck.status === "degraded" ? 200 : 503;

    return res.status(statusCode).json(healthCheck);
  } catch (error) {
    console.error("Health check failed:", error);
    healthCheck.status = "unhealthy";
    healthCheck.error = error.message;
    return res.status(503).json(healthCheck);
  }
});

// ============================
// ROOT ROUTE
// ============================
app.get("/", (req, res) => {
  res.json({
    message: "Park Booking API 🚀",
    version: "1.0.0",
    status: "operational",
    documentation: "https://github.com/your-repo/docs",
    endpoints: {
      attractions: "/api/attractions",
      bookings: "/api/bookings",
      health: "/health",
      metrics: "/metrics",
    },
    uptime: process.uptime(),
  });
});

// ============================
// METRICS
// ============================
app.get("/metrics", (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    process: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
    },
    connections: {
      mongodb: mongoose.connection.readyState,
      redis: redisClient.getStatus(),
    },
  };
  res.json(metrics);
});

// ============================
// API ROUTES
// ============================
app.use("/api/attractions", attractionRoutes);
app.use("/api/bookings", bookingRoutes);

// ============================
// 404 HANDLER
// ============================
app.use((req, res) => {
  if (res.headersSent) return;
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: "Not Found",
    timestamp: new Date().toISOString(),
    suggestions: ["/api/attractions", "/api/bookings", "/health"],
  });
});

// ============================
// GLOBAL ERROR HANDLER (FIXED)
// ============================
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // ✅ Prevent double responses
  if (res.headersSent) {
    console.warn("⚠️  Headers already sent, skipping duplicate response.");
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  const errorResponse = {
    success: false,
    message:
      isProduction && statusCode === 500
        ? "Internal Server Error"
        : err.message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  };

  if (!isProduction) {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details;
  }

  if (err.name === "ValidationError") {
    errorResponse.validationErrors = err.errors;
  }

  return res.status(statusCode).json(errorResponse);
});

module.exports = app;
