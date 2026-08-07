import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

const API_BASE_URL = process.env.BACKEND_API_URL || "http://api:3003";

async function proxyToBackend(
  request: Request,
  path: string,
): Promise<NextResponse> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader.includes(`${SESSION_COOKIE_NAME}=`)) {
    const match = cookieHeader.match(
      new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`),
    );
    if (match) {
      headers.set(
        "Authorization",
        `Bearer ${decodeURIComponent(match[1])}`,
      );
    }
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(url, init);
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Backend unreachable", detail: String(err) },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  return proxyToBackend(request, "/api/analytics");
}
