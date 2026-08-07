import { apiClient } from "./client";
import { ENDPOINTS } from "@/constants/endpoints";

export interface QueuedNotification {
  id: number;
  device_id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  status: "queued" | "delivered" | "seen" | "expired";
  created_at: string;
  delivered_at?: string | null;
  seen_at?: string | null;
}

export interface SendNotificationInput {
  device_id: string;
  title?: string;
  message: string;
  severity?: "info" | "warning" | "error";
}

export interface SendNotificationResult {
  queued: boolean;
  notification: QueuedNotification;
}

// Sends an optimize-style notification to a single device over the control
// plane. The device agent polls /api/control/notifications and renders it as
// a toast/balloon. Duplicate sends for the same device+day are rejected with
// HTTP 409 (deduplicated).
export function sendOptimizeNotification(
  deviceId: string,
  message: string
): Promise<SendNotificationResult> {
  return apiClient.post<SendNotificationResult>(ENDPOINTS.notifications, {
    device_id: deviceId,
    title: "Optimize Your Workstation",
    message,
    severity: "info",
  });
}
