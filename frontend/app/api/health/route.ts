import { NextResponse } from "next/server";

// Real (not mocked) — trivial liveness check for this Next.js instance,
// mirrors the platform's Self-Observability chapter in spirit at the
// frontend's scale.
export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
