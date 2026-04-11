import { useQuery } from "@tanstack/react-query";
import {
  getRfqDistributionHistory,
  getRfqRecommendedVendors,
  type RfqDistributionStatus,
  type RfqRecommendedVendor,
} from "@/lib/rfq-workflow-api";

export const rfqWorkflowQueryKeys = {
  all: ["rfq-workflow"] as const,
  recommendedVendors: (rfqId: string) => ["rfq-workflow", "recommended-vendors", rfqId] as const,
  distributions: (rfqId: string) => ["rfq-workflow", "distributions", rfqId] as const,
};

export function useRfqRecommendedVendors(rfqId: string | null) {
  return useQuery<RfqRecommendedVendor[]>({
    queryKey: rfqId ? rfqWorkflowQueryKeys.recommendedVendors(rfqId) : ["rfq-workflow", "recommended-vendors", "none"],
    enabled: Boolean(rfqId),
    queryFn: async () => {
      if (!rfqId) {
        return [];
      }

      return getRfqRecommendedVendors(rfqId);
    },
  });
}

export function useRfqDistributionHistory(rfqId: string | null) {
  return useQuery<RfqDistributionStatus[]>({
    queryKey: rfqId ? rfqWorkflowQueryKeys.distributions(rfqId) : ["rfq-workflow", "distributions", "none"],
    enabled: Boolean(rfqId),
    queryFn: async () => {
      if (!rfqId) {
        return [];
      }

      return getRfqDistributionHistory(rfqId);
    },
  });
}
