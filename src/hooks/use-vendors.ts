import { useQuery } from "@tanstack/react-query";
import { getVendorProfile, listVendors, type VendorListData, type VendorProfileData } from "@/lib/vendor-service";

export const vendorQueryKeys = {
  all: ["vendors"] as const,
  list: ["vendors", "list"] as const,
  detail: (vendorId: string) => ["vendors", "detail", vendorId] as const,
};

export function useVendorList() {
  return useQuery<VendorListData>({
    queryKey: vendorQueryKeys.list,
    queryFn: listVendors,
  });
}

export function useVendorDetail(vendorId: string | null) {
  return useQuery<VendorProfileData>({
    queryKey: vendorId ? vendorQueryKeys.detail(vendorId) : ["vendors", "detail", "none"],
    enabled: Boolean(vendorId),
    queryFn: async () => {
      if (!vendorId) {
        throw new Error("Vendor id is required");
      }

      return getVendorProfile(vendorId);
    },
  });
}
