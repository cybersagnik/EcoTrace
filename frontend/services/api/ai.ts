import { apiClient } from "./client";
import { ENDPOINTS } from "@/constants/endpoints";

export interface AiStatus {
  configured: boolean;
  model: string;
  interval_ms: number;
  scheduled_enabled: boolean;
  last_run_at: string | null;
  last_run_success: boolean | null;
  last_run_error: string | null;
  last_insight_count: number;
  active_insights: number;
}

export interface QaAiFinding {
  issue: string;
  severity: "critical" | "warning" | "info";
  evidence?: string;
  recommendation: string;
  confidence?: number | null;
}

export interface AnalyzeQaInput {
  /** Aggregated structured summary of the QA dataset (rows/issues/score/sourceInfo). */
  structured: Record<string, unknown> | null;
}

export function getAiStatus(): Promise<AiStatus> {
  return apiClient.get<AiStatus>(ENDPOINTS.aiStatus);
}

export function triggerAiAnalysis(): Promise<{ skipped: boolean; inserted?: number; error?: string }> {
  return apiClient.post<{ skipped: boolean; inserted?: number; error?: string }>(
    ENDPOINTS.aiAnalyze
  );
}

export function analyzeQa(input: AnalyzeQaInput): Promise<{ findings: QaAiFinding[] }> {
  return apiClient.post<{ findings: QaAiFinding[] }>(ENDPOINTS.aiAnalyzeQa, input);
}