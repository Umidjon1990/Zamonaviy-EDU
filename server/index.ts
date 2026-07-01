import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { registerRoutes } from "./routes";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startTelegramBot, startScheduledNotifications } from "./telegram-bot";

// Auto-fix database schema on startup
async function fixDatabaseSchema() {
  if (!process.env.DATABASE_URL) return;
  
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    
    // Make subject_id nullable in groups and users tables
    await client.query(`
      ALTER TABLE groups ALTER COLUMN subject_id DROP NOT NULL;
    `).catch(() => {});
    
    await client.query(`
      ALTER TABLE users ALTER COLUMN subject_id DROP NOT NULL;
    `).catch(() => {});

    // Ensure all required columns exist on users table
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT;`).catch(() => {});
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[];`).catch(() => {});
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;`).catch(() => {});
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_amount INTEGER DEFAULT 0;`).catch(() => {});
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS staff_id TEXT;`).catch(() => {});
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_id TEXT;`).catch(() => {});

    // Ensure level column in groups table
    await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'Beginner';`).catch(() => {});

    // Ensure teacher_earning in payments table
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS teacher_earning INTEGER DEFAULT 0;`).catch(() => {});

    // Ensure telegram_chat_id on students table
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;`).catch(() => {});

    // Ensure teacher_id on expenses table
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS teacher_id TEXT;`).catch(() => {});

    // Ensure student_name on payments table
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS student_name TEXT;`).catch(() => {});

    // Create cash_receipts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cash_receipts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        submitted_by VARCHAR NOT NULL,
        submitted_at TIMESTAMP DEFAULT NOW() NOT NULL,
        note TEXT,
        payment_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        accepted_by VARCHAR,
        accepted_at TIMESTAMP,
        rejected_by VARCHAR,
        rejected_at TIMESTAMP,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `).catch(() => {});

    // Create cash_receipt_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cash_receipt_logs (
        id SERIAL PRIMARY KEY,
        cash_receipt_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        acted_by VARCHAR NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `).catch(() => {});

    // Create student_activity_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_activity_logs (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        student_id INTEGER NOT NULL,
        student_name TEXT NOT NULL,
        group_id INTEGER,
        group_name TEXT,
        from_group_id INTEGER,
        from_group_name TEXT,
        to_group_id INTEGER,
        to_group_name TEXT,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `).catch(() => {});
    
    console.log("Database schema check completed");
  } catch (error) {
    console.log("Database schema check skipped:", (error as Error).message);
  } finally {
    await client.end();
  }
}

const app = express();
const httpServer = createServer(app);

// Trust proxy for Railway/production environments
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Validate required environment variables for security
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET environment variable is required for secure session management");
  process.exit(1);
}

// Session configuration
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // har so'rovda session muddatini yangilash
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 kun
    },
  })
);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    tenantId?: number;
    role?: string;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Fix database schema before starting
  await fixDatabaseSchema();
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    console.error("Error:", err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startTelegramBot();
      startScheduledNotifications();
    },
  );
})();
