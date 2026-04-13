import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getRfqPublicLink,
  getRfqWorkflowApiErrorMessage,
  listVendorPortalOpenRfqs,
  toRfqStatusLabel,
} from "@/lib/rfq-workflow-api";
import { ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export default function VendorPortalPage() {
  const [vendorIdInput, setVendorIdInput] = useState("");
  const [vendorIdFilter, setVendorIdFilter] = useState<string | null>(null);

  const portalQuery = useQuery({
    queryKey: ["rfq", "vendor-portal", "open", vendorIdFilter || "all"],
    queryFn: async () => listVendorPortalOpenRfqs(vendorIdFilter || undefined),
  });

  const items = useMemo(() => portalQuery.data?.items ?? [], [portalQuery.data?.items]);

  const applyFilter = () => {
    const normalized = vendorIdInput.trim();
    setVendorIdFilter(normalized || null);
  };

  const clearFilter = () => {
    setVendorIdInput("");
    setVendorIdFilter(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Portal"
        description="Open RFQs available to vendor users"
        actions={
          <Button type="button" variant="outline" className="gap-2" onClick={() => portalQuery.refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="rounded-xl border bg-card p-4 card-shadow space-y-3">
        <p className="text-sm text-muted-foreground">
          Optional vendor filter can be used to call /api/v1/rfq/vendor-portal/open?vendor_id=...
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={vendorIdInput}
              onChange={(event) => setVendorIdInput(event.target.value)}
              placeholder="Optional vendor_id"
              className="pl-9"
            />
          </div>
          <Button type="button" onClick={applyFilter}>Apply Filter</Button>
          <Button type="button" variant="outline" onClick={clearFilter}>Clear</Button>
        </div>
      </div>

      {portalQuery.isLoading && (
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading open RFQs...
        </div>
      )}

      {portalQuery.isError && (
        <div className="rounded-xl border border-destructive/30 bg-card p-6 card-shadow space-y-3">
          <p className="text-sm text-destructive">{getRfqWorkflowApiErrorMessage(portalQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => portalQuery.refetch()}>Retry</Button>
        </div>
      )}

      {!portalQuery.isLoading && !portalQuery.isError && items.length === 0 && (
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground">
          No open RFQs were returned for the selected vendor filter.
        </div>
      )}

      {!portalQuery.isLoading && !portalQuery.isError && items.length > 0 && (
        <div className="grid gap-4">
          {items.map((rfq) => {
            const publicLink = getRfqPublicLink(rfq.public_link);
            const routeLink = `/rfq/public/${encodeURIComponent(rfq.rfq_id)}`;

            return (
              <article key={rfq.rfq_id} className="rounded-xl border bg-card p-5 card-shadow">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 className="font-semibold">{rfq.rfq_number || rfq.rfq_id}</h3>
                      <StatusBadge status={rfq.status || "open_for_bidding"} />
                      <span className="text-xs text-muted-foreground">{toRfqStatusLabel(rfq.status)}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                      <p><span className="text-muted-foreground">material:</span> {rfq.material || "Not available"}</p>
                      <p><span className="text-muted-foreground">category:</span> {rfq.category || "Not available"}</p>
                      <p><span className="text-muted-foreground">quantity:</span> {rfq.quantity ?? "Not available"}</p>
                      <p><span className="text-muted-foreground">submission_deadline:</span> {formatDateTime(rfq.submission_deadline)}</p>
                      <p><span className="text-muted-foreground">deadline_expired:</span> {rfq.deadline_expired ? "Yes" : "No"}</p>
                      <p><span className="text-muted-foreground">vendors_invited:</span> {rfq.vendors_invited ?? rfq.vendors_invited_count ?? "Not available"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap lg:flex-col gap-2">
                    <Button asChild type="button" size="sm" className="gap-2">
                      <Link to={routeLink}>View Public RFQ</Link>
                    </Button>

                    {publicLink && (
                      <Button asChild type="button" size="sm" variant="outline" className="gap-2">
                        <a href={publicLink} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" /> Public Link
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
