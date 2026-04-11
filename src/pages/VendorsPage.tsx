import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getVendorApiErrorMessage, type VendorListItem } from "@/lib/vendor-service";
import { useVendorList } from "@/hooks/use-vendors";
import { Star, Search, Sparkles, MapPin, Mail, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function getContactPreview(contactInfo: unknown) {
  if (typeof contactInfo === "string" && contactInfo.trim()) {
    return contactInfo;
  }

  if (contactInfo && typeof contactInfo === "object") {
    const record = contactInfo as Record<string, unknown>;
    const preferredKeys = ["email", "primary_email", "phone", "primary_phone", "contact"];

    for (const key of preferredKeys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }

    const firstString = Object.values(record).find((value) => typeof value === "string" && value.trim());
    if (typeof firstString === "string") {
      return firstString;
    }
  }

  return "Contact info unavailable";
}

function getSearchText(vendor: VendorListItem) {
  const contact = getContactPreview(vendor.contact_info);
  return [vendor.vendor_name, vendor.vendor_id, vendor.category, vendor.location, contact]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

export default function VendorsPage() {
  const vendorListQuery = useVendorList();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const vendorItems = useMemo(() => vendorListQuery.data?.items ?? [], [vendorListQuery.data?.items]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    vendorItems.forEach((vendor) => {
      if (vendor.category) {
        categorySet.add(vendor.category);
      }
    });

    return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
  }, [vendorItems]);

  const filtered = vendorItems.filter((vendor) => {
    const matchSearch = getSearchText(vendor).includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || vendor.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Vendor Discovery" description="Find and evaluate vendors for your procurement needs" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vendors..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {vendorListQuery.isLoading && (
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading vendors...
        </div>
      )}

      {vendorListQuery.isError && (
        <div className="rounded-xl border border-destructive/30 bg-card p-6 card-shadow space-y-3">
          <p className="text-sm text-destructive">{getVendorApiErrorMessage(vendorListQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => vendorListQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!vendorListQuery.isLoading && !vendorListQuery.isError && filtered.length === 0 && (
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground">
          No vendors found for the current filters.
        </div>
      )}

      {!vendorListQuery.isLoading && !vendorListQuery.isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((vendor) => {
            const vendorName = vendor.vendor_name || "Unnamed Vendor";
            const category = vendor.category || "Uncategorized";
            const rating = vendor.rating !== null ? vendor.rating.toFixed(1) : "N/A";
            const performancePct = vendor.performance_pct !== null ? `${vendor.performance_pct}%` : "N/A";
            const location = vendor.location || "Location unavailable";
            const contact = getContactPreview(vendor.contact_info);
            const totalOrders = vendor.total_orders !== null ? `${vendor.total_orders} past orders` : "Past orders unavailable";

            return (
              <Link
                key={vendor.vendor_id}
                to={`/vendors/${encodeURIComponent(vendor.vendor_id)}`}
                aria-label={`Open vendor details for ${vendorName}`}
                className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <article className={cn("rounded-xl border bg-card p-5 card-shadow group-hover:card-shadow-hover transition-shadow relative", vendor.is_ai_recommended && "ring-1 ring-ai/30")}>
                  {vendor.is_ai_recommended && (
                    <div className="absolute -top-2.5 left-4 flex items-center gap-1 bg-ai text-ai-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      <Sparkles className="h-3 w-3" /> AI Recommended
                    </div>
                  )}
                  <div className="mt-1">
                    <h3 className="font-semibold">{vendorName}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{category}</p>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-warning fill-warning" />
                      <span className="text-sm font-medium">{rating}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Performance:</span>{" "}
                      <span className="font-medium">{performancePct}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <p className="text-xs flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3 w-3" />{location}</p>
                    <p className="text-xs flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" />{contact}</p>
                    <p className="text-xs text-muted-foreground">{totalOrders}</p>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
