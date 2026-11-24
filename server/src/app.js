import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { sanitizeInput, csrfGuard } from "./middleware/security.js";
import { errorHandler, AppError } from "./utils/errors.js";
import { buildRouter } from "./routes/index.js";

export function createApp() {
  const app = express();
  if (env.isProd) app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(compression());
  if (!env.isProd) app.use(morgan("dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(sanitizeInput);
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  // The payment webhook is called by the provider (no cookie, no custom header); it is verified by signature instead.
  app.use("/api", (req, res, next) =>
    req.path.startsWith("/payments/webhook")
      ? next()
      : csrfGuard(req, res, next),
  );
  app.use("/api", buildRouter());
  app.use("/api", (_req, _res, next) => next(new AppError(404, "Not found")));
  app.use(errorHandler);
  return app;
}
