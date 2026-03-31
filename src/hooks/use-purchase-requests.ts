import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreatePurchaseRequestInput,
  type PurchaseRequest,
  type PurchaseRequestListData,
  type UpdatePurchaseRequestInput,
  createPurchaseRequest,
  getPurchaseRequestById,
  listPurchaseRequests,
  updatePurchaseRequest,
} from "@/lib/purchase-request-api";

interface PurchaseRequestListParams {
  skip?: number;
  limit?: number;
}

export const purchaseRequestQueryKeys = {
  all: ["purchase-requests"] as const,
  list: (skip: number, limit: number) => ["purchase-requests", "list", skip, limit] as const,
  detail: (prId: string) => ["purchase-requests", "detail", prId] as const,
};

export function usePurchaseRequestList(params: PurchaseRequestListParams = {}) {
  const skip = params.skip ?? 0;
  const limit = params.limit ?? 50;

  return useQuery<PurchaseRequestListData>({
    queryKey: purchaseRequestQueryKeys.list(skip, limit),
    queryFn: async () => {
      const response = await listPurchaseRequests({ skip, limit });
      return response.data;
    },
  });
}

export function usePurchaseRequestDetail(prId: string | null) {
  return useQuery<PurchaseRequest>({
    queryKey: prId ? purchaseRequestQueryKeys.detail(prId) : ["purchase-requests", "detail", "none"],
    enabled: Boolean(prId),
    queryFn: async () => {
      if (!prId) {
        throw new Error("Purchase request id is required");
      }

      const response = await getPurchaseRequestById(prId);
      return response.data;
    },
  });
}

export function useCreatePurchaseRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePurchaseRequestInput) => createPurchaseRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseRequestQueryKeys.all });
    },
  });
}

interface UpdatePurchaseRequestMutationInput {
  prId: string;
  payload: UpdatePurchaseRequestInput;
}

export function useUpdatePurchaseRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prId, payload }: UpdatePurchaseRequestMutationInput) => updatePurchaseRequest(prId, payload),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(purchaseRequestQueryKeys.detail(variables.prId), response.data);
      queryClient.invalidateQueries({ queryKey: purchaseRequestQueryKeys.all });
    },
  });
}
