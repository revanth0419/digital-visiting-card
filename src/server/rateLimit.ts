import type { NextFunction, Request, Response } from "express";

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  name: string;
  max: number;
  windowMs: number;
  keyFn?: (req: Request) => string;
};

const getClientIp = (req: Request) => {
  const xff = req.headers["x-forwarded-for"];
  const ipFromHeader = Array.isArray(xff) ? xff[0] : xff;
  const ip = (ipFromHeader || req.socket.remoteAddress || req.ip || "unknown").toString();
  // Normalize IPv6-mapped IPv4 (::ffff:127.0.0.1)
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
};

/**
 * Minimal in-memory server-side rate limiting.
 * Note: per-instance (not distributed). Still prevents simple abuse and removes client-only enforcement.
 */
export const createRateLimitMiddleware = (options: RateLimitOptions) => {
  const buckets = new Map<string, RateLimitRecord>();

  const keyFn =
    options.keyFn ?? ((req: Request) => `ip:${getClientIp(req)}`);

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${options.name}:${keyFn(req)}`;

    const existing = buckets.get(key);
    const record: RateLimitRecord =
      existing && now < existing.resetAt
        ? existing
        : { count: 0, resetAt: now + options.windowMs };

    if (record.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfterSeconds,
      });
    }

    record.count += 1;
    buckets.set(key, record);

    // Cheap opportunistic cleanup (keeps memory bounded in most real usage)
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (now >= v.resetAt) buckets.delete(k);
      }
    }

    next();
  };
};
