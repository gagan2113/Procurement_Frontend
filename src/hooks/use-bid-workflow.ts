import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bidWorkflowQueryKeys,
  evaluateBidForRfq,
  getLiveBidSnapshot,
  selectBidWinner,
  submitBidForRfq,
  type BidSnapshot,
  type SubmitBidInput,
} from "@/lib/bid-workflow-api";

export function useBidLiveSnapshot(rfqId: string | null, pollingEnabled = true) {
  return useQuery<BidSnapshot>({
    queryKey: rfqId ? bidWorkflowQueryKeys.live(rfqId) : ["bid-workflow", "live", "none"],
    enabled: Boolean(rfqId),
    queryFn: async () => {
      if (!rfqId) {
        throw new Error("RFQ ID is required");
      }

      const result = await getLiveBidSnapshot(rfqId);
      return result.snapshot;
    },
    refetchInterval: pollingEnabled && rfqId ? 10000 : false,
    refetchIntervalInBackground: pollingEnabled,
  });
}

interface SubmitBidMutationInput {
  rfqId: string;
  payload?: SubmitBidInput;
}

export function useSubmitBidMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rfqId, payload }: SubmitBidMutationInput) => submitBidForRfq(rfqId, payload),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(bidWorkflowQueryKeys.live(variables.rfqId), result.snapshot);
    },
  });
}

interface EvaluateBidMutationInput {
  rfqId: string;
}

export function useEvaluateBidMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rfqId }: EvaluateBidMutationInput) => evaluateBidForRfq(rfqId),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(bidWorkflowQueryKeys.live(variables.rfqId), result.snapshot);
    },
  });
}

interface SelectBidWinnerMutationInput {
  rfqId: string;
  vendorId: string;
}

export function useSelectBidWinnerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rfqId, vendorId }: SelectBidWinnerMutationInput) => selectBidWinner(rfqId, vendorId),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(bidWorkflowQueryKeys.live(variables.rfqId), result.snapshot);
    },
  });
}
