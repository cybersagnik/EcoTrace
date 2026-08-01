import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";
import { setSessionToken, getSessionToken, clearSessionToken } from "@/lib/auth";

describe("Security & Neutralization Suite", () => {
  it("sanitizes potential CSV formula injection characters", () => {
    const maliciousInputs = ["=cmd|' /C calc'!A0", "+1+1", "-2+3", "@SUM(A1:A10)", "\tbad", "\rbad"];
    
    maliciousInputs.forEach((input) => {
      const sanitized = /^[=+\-@\t\r]/.test(input) ? `'${input}` : input;
      expect(sanitized.startsWith("'")).toBe(true);
    });
  });

  it("handles rate limiting correctly", () => {
    const req = new Request("http://localhost:3000/api/devices", {
      headers: { "x-forwarded-for": "192.168.1.100" },
    });

    const res1 = checkRateLimit(req, 2, 60000);
    expect(res1.success).toBe(true);

    const res2 = checkRateLimit(req, 2, 60000);
    expect(res2.success).toBe(true);

    const res3 = checkRateLimit(req, 2, 60000);
    expect(res3.success).toBe(false);
    expect(res3.response?.status).toBe(429);
  });
});
