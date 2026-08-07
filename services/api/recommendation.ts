import { apiClient } from "./client";
import { ENDPOINTS } from "@/constants/endpoints";
import { Recommendation } from "@/types/recommendation";

export interface RecommendationResponse {
  recommendations: Recommendation[];
  total_potential_savings_kg: number;
  last_computed: string;
}

export function getRecommendations(): Promise<RecommendationResponse> {
  return apiClient.get<RecommendationResponse>(ENDPOINTS.recommendation);
}
