import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bidWorkflowQueryKeys,
  evaluateBidForRfq,
  getLiveBidSnapshot,
  listBidSubmissions,
  manualOverrideBidForRfq,
  sendBidForApproval,
  selectBidWinner,
  type BidSubmissionsResult,
  type ManualOverrideInput,
  type SendForApprovalInput,
  type BidSnapshot,
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

export function useBidSubmissions(rfqId: string | null) {
  return useQuery<BidSubmissionsResult>({
    queryKey: rfqId ? bidWorkflowQueryKeys.submissions(rfqId) : ["bid-workflow", "submissions", "none"],
    enabled: Boolean(rfqId),
    queryFn: async () => {
      if (!rfqId) {
        throw new Error("RFQ ID is required");
      }

      return listBidSubmissions(rfqId);
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
      queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.submissions(variables.rfqId) });
    },
  });
}

interface ManualOverrideMutationInput {
  rfqId: string;
  payload: ManualOverrideInput;
}

export function useManualOverrideBidMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rfqId, payload }: ManualOverrideMutationInput) => manualOverrideBidForRfq(rfqId, payload),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(bidWorkflowQueryKeys.live(variables.rfqId), result.snapshot);
      queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.submissions(variables.rfqId) });
    },
  });
}

interface SendForApprovalMutationInput {
  rfqId: string;
  payload?: SendForApprovalInput;
}

export function useSendForApprovalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rfqId, payload }: SendForApprovalMutationInput) => sendBidForApproval(rfqId, payload),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(bidWorkflowQueryKeys.live(variables.rfqId), result.snapshot);
      queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.submissions(variables.rfqId) });
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
      queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.submissions(variables.rfqId) });
    },
  });
}
