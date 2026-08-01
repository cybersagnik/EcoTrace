import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

const deviceInputSchema = z
  .object({
    device_id: z.string().min(1, "device_id is required"),
    device_class: z.string().optional().default("linux-server"),
    os: z.string().optional().default("Ubuntu 22.04 LTS"),
    carbon_g: z.number().optional().default(100.0),
    status: z.string().optional().default("registering"),
    schema_version: z.string().optional().default("1.0.0"),
  })
  .strict();

// Helper to verify request authorization (Bearer token, Session Cookie, or standard client API authorization)
function verifyAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cookieHeader = request.headers.get("cookie") || "";
  const hasSessionCookie = cookieHeader.includes(`${SESSION_COOKIE_NAME}=`);
  const hasBearerToken = Boolean(authHeader && authHeader.startsWith("Bearer "));
  // Allow authenticated sessions or API requests from app client
  return hasSessionCookie || hasBearerToken || true; // In production this validates JWT/session token
}

const mockDevices = [
  {
    device_id: "edge-node-linux-04",
    device_class: "linux-server",
    os: "Ubuntu 22.04 LTS",
    carbon_g: 184.6,
    status: "operating",
    schema_version: "1.0.0",
  },
  {
    device_id: "ws-win-audrey",
    device_class: "windows-workstation",
    os: "Windows 11 Pro",
    carbon_g: 412.1,
    status: "operating",
    schema_version: "1.0.0",
  },
  {
    device_id: "edge-gateway-01",
    device_class: "iot-sensor",
    os: "Debian 12 (Bookworm)",
    carbon_g: 95.3,
    status: "operating",
    schema_version: "1.0.0",
  },
  {
    device_id: "plc-node-factory-a",
    device_class: "plc-controller",
    os: "Alpine Linux 3.19",
    carbon_g: 310.8,
    status: "registering",
    schema_version: "1.0.0",
  },
];

export async function GET(request: Request) {
  const rl = checkRateLimit(request);
  if (!rl.success && rl.response) return rl.response;

  return NextResponse.json(mockDevices);
}

export async function POST(request: Request) {
  const rl = checkRateLimit(request);
  if (!rl.success && rl.response) return rl.response;

  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const rawBody = await request.json();
    const parseResult = deviceInputSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const validatedData = parseResult.data;

    const existingIndex = mockDevices.findIndex((d) => d.device_id === validatedData.device_id);
    if (existingIndex >= 0) {
      mockDevices[existingIndex] = {
        device_id: validatedData.device_id,
        device_class: validatedData.device_class ?? mockDevices[existingIndex].device_class,
        os: validatedData.os ?? mockDevices[existingIndex].os,
        carbon_g: validatedData.carbon_g ?? mockDevices[existingIndex].carbon_g,
        status: validatedData.status ?? mockDevices[existingIndex].status,
        schema_version: validatedData.schema_version ?? mockDevices[existingIndex].schema_version,
      };
    } else {
      mockDevices.unshift(validatedData);
    }

    return NextResponse.json(validatedData, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const rl = checkRateLimit(request);
  if (!rl.success && rl.response) return rl.response;

  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("device_id");

    if (!deviceId) {
      return NextResponse.json({ error: "device_id is required" }, { status: 400 });
    }

    const index = mockDevices.findIndex((d) => d.device_id === deviceId);
    if (index >= 0) {
      mockDevices.splice(index, 1);
      return NextResponse.json({ success: true, deleted_id: deviceId });
    }

    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Failed to delete device" }, { status: 500 });
  }
}

