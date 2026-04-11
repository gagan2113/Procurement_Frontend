import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRfqDetail, useRfqList, rfqQueryKeys } from "@/hooks/use-rfqs";
import {
  bidWorkflowQueryKeys,
} from "@/lib/bid-workflow-api";
import {
  getRfqPdfDownloadUrl,
  getRfqPublicLink,
  getRfqRecommendedVendors,
  getRfqWorkflowApiErrorMessage,
  publishRfq,
  sendRfqToVendors,
  toRfqStatusLabel,
  type RfqListItem,
  type RfqWorkflow,
} from "@/lib/rfq-workflow-api";
import { upsertRfqWorkflowCache } from "@/lib/rfq-workflow-cache";
import { cn } from "@/lib/utils";
import { Eye, FileText, Loader2, RefreshCw, Rocket, Search, Send } from "lucide-react";

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

function resolveQuickAction(actionLabel: string) {
  const normalized = actionLabel.trim().toLowerCase();

  if (normalized === "review") {
    return "review" as const;
  }

  if (normalized === "publish") {
    return "publish" as const;
  }

  if (normalized === "send" || normalized === "send_to_vendors" || normalized === "send to vendors") {
    return "send" as const;
  }

  return "unknown" as const;
}

function withReviewAction(actionsAvailable: string[]) {
  const actions = [...actionsAvailable];
  const hasReview = actions.some((action) => resolveQuickAction(action) === "review");

  if (!hasReview) {
    actions.unshift("Review");
  }

  return actions;
}

function renderDetailField(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return <p className="text-sm text-muted-foreground">Not available</p>;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <p className="text-sm whitespace-pre-wrap">{String(value)}</p>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <p className="text-sm text-muted-foreground">Not available</p>;
    }

    return (
      <ul className="list-disc list-inside text-sm space-y-1">
        {value.map((item, index) => (
          <li key={`${String(item)}-${index}`}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    return <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-auto">{JSON.stringify(value, null, 2)}</pre>;
  }

  return <p className="text-sm text-muted-foreground">Not available</p>;
}

export default function RFQPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  const effectiveStatus = statusFilter === "all" ? undefined : statusFilter;

  const rfqListQuery = useRfqList({
    status: effectiveStatus,
    search,
  });

  const rfqDetailQuery = useRfqDetail(selectedRfqId);
  const rfqs = useMemo(() => rfqListQuery.data?.rfqs ?? [], [rfqListQuery.data?.rfqs]);

  const selectedRfq = useMemo(
    () => rfqs.find((rfq) => rfq.rfq_id === selectedRfqId) ?? null,
    [rfqs, selectedRfqId],
  );

  const refreshRfqViews = async (rfqId: string) => {
    await rfqListQuery.refetch();

    if (selectedRfqId === rfqId) {
      await rfqDetailQuery.refetch();
    }

    queryClient.invalidateQueries({ queryKey: rfqQueryKeys.detail(rfqId) });
    queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.live(rfqId) });
    queryClient.refetchQueries({ queryKey: bidWorkflowQueryKeys.live(rfqId), type: "active" });
  };

  const handlePublish = async (rfq: RfqListItem) => {
    const requestKey = `${rfq.rfq_id}:publish`;
    setActionInFlight(requestKey);

    const currentWorkflow: RfqWorkflow = {
      rfq_id: rfq.rfq_id,
      rfq_number: rfq.rfq_number,
      status: rfq.status,
      actions_available: rfq.actions_available,
      public_link: rfq.public_link,
    };

    try {
      const result = await publishRfq(rfq.rfq_id, currentWorkflow);

      upsertRfqWorkflowCache({
        rfq_id: rfq.rfq_id,
        rfq_number: result.rfq_number || rfq.rfq_number,
        status: result.status || rfq.status,
        actions_available: result.actions_available.length > 0 ? result.actions_available : rfq.actions_available,
        public_link: result.public_link || rfq.public_link,
      });

      await refreshRfqViews(rfq.rfq_id);

      toast({
        title: result.already_published ? "Already published" : "RFQ published",
        description: result.already_published
          ? "RFQ was already published; existing state reused."
          : "RFQ moved to open state for bidding.",
      });
    } catch (error) {
      toast({
        title: "Publish failed",
        description: getRfqWorkflowApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setActionInFlight(null);
    }
  };

  const handleSend = async (rfq: RfqListItem) => {
    const requestKey = `${rfq.rfq_id}:send`;
    setActionInFlight(requestKey);

    try {
      const recommended = await getRfqRecommendedVendors(rfq.rfq_id);
      const activeVendorIds = recommended
        .filter((vendor) => vendor.active_vendor === true && typeof vendor.vendor_id === "string")
        .map((vendor) => vendor.vendor_id as string);

      const fallbackVendorIds = recommended
        .map((vendor) => vendor.vendor_id)
        .filter((vendorId): vendorId is string => typeof vendorId === "string" && Boolean(vendorId));

      const vendorIds = activeVendorIds.length > 0 ? activeVendorIds : fallbackVendorIds;

      if (vendorIds.length === 0) {
        toast({
          title: "No vendors to send",
          description: "Recommended vendors are empty for this RFQ.",
          variant: "destructive",
        });
        return;
      }

      const result = await sendRfqToVendors(rfq.rfq_id, vendorIds);

      upsertRfqWorkflowCache({
        rfq_id: rfq.rfq_id,
        rfq_number: rfq.rfq_number,
        status: result.status || rfq.status,
        actions_available: rfq.actions_available,
        public_link: rfq.public_link,
      });

      await refreshRfqViews(rfq.rfq_id);

      toast({
        title: "RFQ sent",
        description: `Distribution statuses returned for ${result.distribution_statuses.length} vendors.`,
      });
    } catch (error) {
      toast({
        title: "Send failed",
        description: getRfqWorkflowApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setActionInFlight(null);
    }
  };

  const handleQuickAction = async (rfq: RfqListItem, actionLabel: string) => {
    const actionType = resolveQuickAction(actionLabel);

    if (actionType === "review") {
      setSelectedRfqId(rfq.rfq_id);
      return;
    }

    if (actionType === "publish") {
      await handlePublish(rfq);
      return;
    }

    if (actionType === "send") {
      await handleSend(rfq);
      return;
    }

    toast({
      title: "Action unavailable",
      description: `The action '${actionLabel}' is not supported by this frontend yet.`,
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="RFQ / Tender Management" description="Review RFQs, publish, send to vendors, and access PDFs" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search RFQs by number, material, PR..."
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" className="gap-2" onClick={() => rfqListQuery.refetch()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {rfqListQuery.isLoading && (
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading RFQs...
        </div>
      )}

      {rfqListQuery.isError && (
        <div className="rounded-xl border border-destructive/30 bg-card p-6 card-shadow space-y-3">
          <p className="text-sm text-destructive">{getRfqWorkflowApiErrorMessage(rfqListQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => rfqListQuery.refetch()}>Retry</Button>
        </div>
      )}

      {!rfqListQuery.isLoading && !rfqListQuery.isError && rfqs.length === 0 && (
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground">
          No RFQs found for the current filters.
        </div>
      )}

      {!rfqListQuery.isLoading && !rfqListQuery.isError && rfqs.length > 0 && (
        <div className="grid gap-4">
          {rfqs.map((rfq) => {
            const quickActions = withReviewAction(rfq.actions_available);
            const pdfUrl = getRfqPdfDownloadUrl(rfq.rfq_id, rfq.pdf_download_url);
            const publicLink = getRfqPublicLink(rfq.public_link);

            return (
              <article
                key={rfq.rfq_id}
                role="button"
                tabIndex={0}
                className="rounded-xl border bg-card p-5 card-shadow hover:card-shadow-hover transition-shadow cursor-pointer"
                onClick={() => setSelectedRfqId(rfq.rfq_id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedRfqId(rfq.rfq_id);
                  }
                }}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 className="font-semibold">{rfq.rfq_number || rfq.rfq_id}</h3>
                      <StatusBadge status={rfq.status || "draft"} />
                      <span className="text-xs text-muted-foreground">rfq_id: {rfq.rfq_id}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                      <p><span className="text-muted-foreground">pr_number:</span> {rfq.pr_number || "Not available"}</p>
                      <p><span className="text-muted-foreground">material:</span> {rfq.material || "Not available"}</p>
                      <p><span className="text-muted-foreground">category:</span> {rfq.category || "Not available"}</p>
                      <p><span className="text-muted-foreground">quantity:</span> {rfq.quantity ?? "Not available"}</p>
                      <p><span className="text-muted-foreground">delivery_date:</span> {formatDateTime(rfq.delivery_date)}</p>
                      <p><span className="text-muted-foreground">submission_deadline:</span> {formatDateTime(rfq.submission_deadline)}</p>
                      <p><span className="text-muted-foreground">vendors_invited_count:</span> {rfq.vendors_invited_count ?? "Not available"}</p>
                      <p><span className="text-muted-foreground">last_sent_at:</span> {formatDateTime(rfq.last_sent_at)}</p>
                      <p><span className="text-muted-foreground">created_at:</span> {formatDateTime(rfq.created_at)}</p>
                      <p><span className="text-muted-foreground">updated_at:</span> {formatDateTime(rfq.updated_at)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {rfq.actions_available.length > 0 ? (
                        rfq.actions_available.map((action) => (
                          <span key={action} className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                            {action}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">No actions_available</span>
                      )}
                    </div>

                    {publicLink && (
                      <a
                        href={publicLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline underline-offset-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        public_link: {publicLink}
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap lg:flex-col gap-2" onClick={(event) => event.stopPropagation()}>
                    {quickActions.map((actionLabel) => {
                      const actionType = resolveQuickAction(actionLabel);
                      const loadingKey = `${rfq.rfq_id}:${actionType}`;
                      const isLoading = actionInFlight === loadingKey;
                      const isDisabled = actionInFlight !== null && actionInFlight !== loadingKey;

                      const icon = actionType === "review"
                        ? <Eye className="h-4 w-4" />
                        : actionType === "publish"
                          ? <Rocket className="h-4 w-4" />
                          : <Send className="h-4 w-4" />;

                      return (
                        <Button
                          key={actionLabel}
                          type="button"
                          size="sm"
                          variant={actionType === "unknown" ? "outline" : "default"}
                          className="gap-2"
                          onClick={() => handleQuickAction(rfq, actionLabel)}
                          disabled={isDisabled || isLoading || actionType === "unknown"}
                        >
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
                          {actionLabel}
                        </Button>
                      );
                    })}

                    <Button asChild type="button" variant="outline" size="sm" className="gap-2">
                      <a href={pdfUrl} target="_blank" rel="noreferrer">
                        <FileText className="h-4 w-4" />
                        {rfq.pdf_available ? "View PDF" : "Generate and View"}
                      </a>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(selectedRfqId)} onOpenChange={(open) => !open && setSelectedRfqId(null)}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>RFQ Detail</DialogTitle>
          </DialogHeader>

          {rfqDetailQuery.isLoading && (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading RFQ details...
            </div>
          )}

          {rfqDetailQuery.isError && (
            <div className="rounded-lg border border-destructive/30 bg-card p-4 space-y-2">
              <p className="text-sm text-destructive">{getRfqWorkflowApiErrorMessage(rfqDetailQuery.error)}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => rfqDetailQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}

          {rfqDetailQuery.data && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-base">{rfqDetailQuery.data.rfq_number || rfqDetailQuery.data.rfq_id}</h3>
                    <p className="text-xs text-muted-foreground mt-1">rfq_id: {rfqDetailQuery.data.rfq_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={rfqDetailQuery.data.status || "draft"} />
                    <span className="text-xs text-muted-foreground">{toRfqStatusLabel(rfqDetailQuery.data.status)}</span>
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <a href={getRfqPdfDownloadUrl(rfqDetailQuery.data.rfq_id, rfqDetailQuery.data.pdf_download_url)} target="_blank" rel="noreferrer">
                        <FileText className="h-4 w-4" />
                        {rfqDetailQuery.data.pdf_available ? "View PDF" : "Generate and View"}
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                  <p><span className="text-muted-foreground">pr_number:</span> {rfqDetailQuery.data.pr_number || "Not available"}</p>
                  <p><span className="text-muted-foreground">material:</span> {rfqDetailQuery.data.material || "Not available"}</p>
                  <p><span className="text-muted-foreground">category:</span> {rfqDetailQuery.data.category || "Not available"}</p>
                  <p><span className="text-muted-foreground">quantity:</span> {rfqDetailQuery.data.quantity ?? "Not available"}</p>
                  <p><span className="text-muted-foreground">delivery_date:</span> {formatDateTime(rfqDetailQuery.data.delivery_date)}</p>
                  <p><span className="text-muted-foreground">submission_deadline:</span> {formatDateTime(rfqDetailQuery.data.submission_deadline)}</p>
                  <p><span className="text-muted-foreground">vendors_invited_count:</span> {rfqDetailQuery.data.vendors_invited_count ?? "Not available"}</p>
                  <p><span className="text-muted-foreground">last_sent_at:</span> {formatDateTime(rfqDetailQuery.data.last_sent_at)}</p>
                  <p><span className="text-muted-foreground">updated_at:</span> {formatDateTime(rfqDetailQuery.data.updated_at)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card p-4">
                  <h4 className="text-sm font-semibold mb-2">Full Specs</h4>
                  {renderDetailField(rfqDetailQuery.data.full_specs)}
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h4 className="text-sm font-semibold mb-2">Scope of Work</h4>
                  {renderDetailField(rfqDetailQuery.data.scope_of_work)}
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h4 className="text-sm font-semibold mb-2">Technical Specs</h4>
                  {renderDetailField(rfqDetailQuery.data.technical_specs)}
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h4 className="text-sm font-semibold mb-2">Payment Terms</h4>
                  {renderDetailField(rfqDetailQuery.data.payment_terms)}
                </div>

                <div className="rounded-xl border bg-card p-4 lg:col-span-2">
                  <h4 className="text-sm font-semibold mb-2">Evaluation Criteria</h4>
                  {renderDetailField(rfqDetailQuery.data.evaluation_criteria)}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <h4 className="text-sm font-semibold mb-3">PDF Preview</h4>
                <iframe
                  title={`RFQ PDF preview ${rfqDetailQuery.data.rfq_id}`}
                  src={getRfqPdfDownloadUrl(rfqDetailQuery.data.rfq_id, rfqDetailQuery.data.pdf_download_url)}
                  className={cn("w-full h-[520px] rounded-lg border bg-white")}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
