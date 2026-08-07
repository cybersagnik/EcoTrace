export type RecommendationPriority = "critical" | "high" | "medium";

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact_kg: number;
  region: string;
  priority: RecommendationPriority;
  action_label: string;
}
