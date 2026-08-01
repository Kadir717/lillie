/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * ── Why in-memory (no Redis) ──────────────────────────────────────
 * Redis would add infrastructure and operational cost before LILLIE
 * needs it. A per-instance in-memory limiter is free, dependency-free,
 * and works on both the Node.js and Edge runtimes.
 *
 * ── Known limitation ──────────────────────────────────────────────
 * State lives inside ONE server instance / edge isolate. On a
 * multi-instance deployment (e.g. several Vercel serverless functions
 * or edge regions), each instance keeps its own counter, so this is
 * BEST-EFFORT protection, not a hard global quota. It still stops
 * accidental hammering and naive abuse from a single client.
 *
 * ── Future upgrade path ───────────────────────────────────────────
 * If true distributed rate limiting becomes necessary (paywall abuse,
 * brute-force protection at scale), swap this class for a Redis /
 * Upstash-backed limiter with the SAME `check()` interface — the
 * middleware code does not need to change.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Requests still permitted in the current window (when allowed). */
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

interface Bucket {
  timestamps: number[];
}

export class InMemoryRateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    /** Maximum number of requests allowed inside `windowMs`. */
    public readonly maxRequests: number,
    /** Window length in milliseconds. */
    public readonly windowMs: number
  ) {}

  /**
   * Records a request for `key` and returns whether it is allowed.
   * Keys should be coarse-grained per client (e.g. IP address) — never
   * per-request values like tokens or full URLs, or the map leaks memory.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();

    // Prevent unbounded growth: occasionally drop stale buckets.
    if (this.buckets.size > 10_000) {
      this.sweep(now);
    }

    const bucket = this.buckets.get(key) ?? { timestamps: [] };

    // Keep only timestamps still inside the sliding window.
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < this.windowMs);

    if (bucket.timestamps.length >= this.maxRequests) {
      // Oldest timestamp + window = when the client may retry.
      const resetAt = bucket.timestamps[0] + this.windowMs;
      this.buckets.set(key, bucket);
      return { allowed: false, remaining: 0, resetAt };
    }

    bucket.timestamps.push(now);
    this.buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: this.maxRequests - bucket.timestamps.length,
      resetAt: now + this.windowMs,
    };
  }

  /** Removes buckets that have not been touched within 2 windows. */
  private sweep(now: number): void {
    for (const [key, bucket] of this.buckets) {
      const last = bucket.timestamps[bucket.timestamps.length - 1];
      if (now - last > this.windowMs * 2) {
        this.buckets.delete(key);
      }
    }
  }
}
