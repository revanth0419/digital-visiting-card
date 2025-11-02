/**
 * Simple client-side rate limiting using localStorage
 * Note: This is a client-side protection and can be bypassed by clearing localStorage
 * For production, implement server-side rate limiting via edge functions
 */

interface RateLimitConfig {
  key: string;
  maxAttempts: number;
  windowMs: number;
}

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  checkLimit(): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const stored = localStorage.getItem(this.config.key);
    
    let record: RateLimitRecord = stored 
      ? JSON.parse(stored)
      : { attempts: 0, resetAt: now + this.config.windowMs };

    // Reset if window expired
    if (now >= record.resetAt) {
      record = { attempts: 0, resetAt: now + this.config.windowMs };
    }

    // Check if limit exceeded
    if (record.attempts >= this.config.maxAttempts) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }

  recordAttempt(): void {
    const now = Date.now();
    const stored = localStorage.getItem(this.config.key);
    
    let record: RateLimitRecord = stored 
      ? JSON.parse(stored)
      : { attempts: 0, resetAt: now + this.config.windowMs };

    // Reset if window expired
    if (now >= record.resetAt) {
      record = { attempts: 1, resetAt: now + this.config.windowMs };
    } else {
      record.attempts += 1;
    }

    localStorage.setItem(this.config.key, JSON.stringify(record));
  }
}

// Pre-configured rate limiters
export const uploadRateLimiter = new RateLimiter({
  key: 'upload_rate_limit',
  maxAttempts: 10,
  windowMs: 60000, // 10 uploads per minute
});

export const profileViewRateLimiter = new RateLimiter({
  key: 'profile_view_rate_limit',
  maxAttempts: 30,
  windowMs: 60000, // 30 profile views per minute
});
