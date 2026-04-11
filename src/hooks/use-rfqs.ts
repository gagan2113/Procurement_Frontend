import { useQuery } from "@tanstack/react-query";
import { getRfqDetail, listRfqs, type RfqDetailData, type RfqListData } from "@/lib/rfq-workflow-api";

interface UseRfqListParams {
  status?: string;
  search?: string;
}

export const rfqQueryKeys = {
  all: ["rfqs"] as const,
  list: (status: string, search: string) => ["rfqs", "list", status, search] as const,
  detail: (rfqId: string) => ["rfqs", "detail", rfqId] as const,
};

export function useRfqList(params: UseRfqListParams = {}) {
  const status = params.status?.trim() ?? "";
  const search = params.search?.trim() ?? "";

  return useQuery<RfqListData>({
    queryKey: rfqQueryKeys.list(status, search),
    queryFn: async () => listRfqs({
      status: status || undefined,
      search: search || undefined,
    }),
  });
}

export function useRfqDetail(rfqId: string | null) {
  return useQuery<RfqDetailData>({
    queryKey: rfqId ? rfqQueryKeys.detail(rfqId) : ["rfqs", "detail", "none"],
    enabled: Boolean(rfqId),
    queryFn: async () => {
      if (!rfqId) {
        throw new Error("RFQ ID is required");
      }

      return getRfqDetail(rfqId);
    },
  });
}
