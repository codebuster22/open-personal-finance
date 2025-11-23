import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import oauthRoutes from "./routes/oauth";
import gmailRoutes from "./routes/gmail";
import subscriptionRoutes from "./routes/subscriptions";
import { errorHandler } from "./middleware/errorHandler";
import { testDatabaseConnection, initializeDatabase } from "./config/initDatabase";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const DEBUG = process.env.DEBUG === "true" || process.env.NODE_ENV === "development";

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Log request
  console.log(`[${timestamp}] ${req.method} ${req.path}`);

  if (DEBUG) {
    console.log(`  Headers:`, JSON.stringify(req.headers, null, 2));
    if (req.body && Object.keys(req.body).length > 0) {
      // Don't log sensitive fields
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.password) sanitizedBody.password = "[REDACTED]";
      if (sanitizedBody.clientSecret) sanitizedBody.clientSecret = "[REDACTED]";
      if (sanitizedBody.client_secret) sanitizedBody.client_secret = "[REDACTED]";
      console.log(`  Body:`, JSON.stringify(sanitizedBody, null, 2));
    }
  }

  // Log response
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? "\x1b[31m" : "\x1b[32m";
    const resetColor = "\x1b[0m";
    console.log(`[${timestamp}] ${statusColor}${res.statusCode}${resetColor} ${req.method} ${req.path} - ${duration}ms`);
  });

  next();
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/oauth", oauthRoutes);
app.use("/api/gmail", gmailRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    // Test database connection
    await testDatabaseConnection();

    // Initialize database tables
    await initializeDatabase();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`✓ Backend server running on port ${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`✓ Debug mode: ${DEBUG ? "ENABLED" : "DISABLED"}`);
      console.log(`✓ Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
      console.log(`✓ Anthropic API: ${process.env.ANTHROPIC_API_KEY ? "CONFIGURED" : "NOT CONFIGURED (keyword-only mode)"}`);
      console.log(`${"=".repeat(60)}\n`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export default app;
