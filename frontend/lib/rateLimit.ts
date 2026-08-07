import { NextResponse } from "next/server";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const ipMap = new Map<string, RateLimitStore>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipMap.entries()) {
      if (now > data.resetTime) {
        ipMap.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
}

export function checkRateLimit(
  req: Request,
  limit: number = 100,
  windowMs: number = 60 * 1000
): { success: boolean; response?: NextResponse } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const now = Date.now();
  const currentStore = ipMap.get(ip);

  if (!currentStore || now > currentStore.resetTime) {
    ipMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { success: true };
  }

  if (currentStore.count >= limit) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((currentStore.resetTime - now) / 1000).toString(),
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      ),
    };
  }

  currentStore.count += 1;
  return { success: true };
}
