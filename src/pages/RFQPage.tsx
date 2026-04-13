import { type FormEvent, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRfqDetail, useRfqList, rfqQueryKeys } from "@/hooks/use-rfqs";
import {
  bidWorkflowQueryKeys,
} from "@/lib/bid-workflow-api";
import {
  createManualRfq,
  deleteRfq,
  getRfqDetail,
  getRfqPdfDownloadUrl,
  getRfqPublicLink,
  getRfqWorkflowApiErrorMessage,
  getRfqWorkflowMissingFields,
  openRfqForBidding,
  sendRfqToVendors,
  toRfqStatusLabel,
  updateRfq,
  type RfqDetailData,
  type RfqListItem,
  type RfqWorkflow,
} from "@/lib/rfq-workflow-api";
import { upsertRfqWorkflowCache } from "@/lib/rfq-workflow-cache";
import { cn } from "@/lib/utils";
import { Eye, FileText, Loader2, Pencil, PlusCircle, RefreshCw, Rocket, Search, Send, Trash2 } from "lucide-react";

type RfqEditorMode = "create" | "edit";

interface RfqEditorState {
  pr_number: string;
  material: string;
  category: string;
  quantity: string;
  delivery_date: string;
  submission_deadline: string;
  full_specs: string;
  scope_of_work: string;
  technical_specs: string;
  payment_terms: string;
  evaluation_criteria: string;
}

interface RfqOrchestrationStats {
  status: string | null;
  public_link: string | null;
  vendors_invited: number | null;
  emails_sent: number | null;
  in_app_sent: number | null;
}

const EMPTY_EDITOR_STATE: RfqEditorState = {
  pr_number: "",
  material: "",
  category: "",
  quantity: "",
  delivery_date: "",
  submission_deadline: "",
  full_specs: "",
  scope_of_work: "",
  technical_specs: "",
  payment_terms: "",
  evaluation_criteria: "",
};

const EDITOR_FIELD_ALIASES: Record<keyof RfqEditorState, string[]> = {
  pr_number: ["pr_number", "pr"],
  material: ["material", "item_name"],
  category: ["category"],
  quantity: ["quantity"],
  delivery_date: ["delivery_date", "delivery"],
  submission_deadline: ["submission_deadline", "deadline"],
  full_specs: ["full_specs", "full_specifications", "specs"],
  scope_of_work: ["scope_of_work", "scope"],
  technical_specs: ["technical_specs", "technical_specifications"],
  payment_terms: ["payment_terms", "payment_term"],
  evaluation_criteria: ["evaluation_criteria", "evaluation"],
};

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

function normalizeStatusKey(status: string | null | undefined) {
  if (!status) {
    return "unknown";
  }

  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isSendAllowed(status: string | null | undefined) {
  const normalized = normalizeStatusKey(status);
  return normalized === "draft" || normalized === "published";
}

function isOpenForBiddingAllowed(status: string | null | undefined) {
  const normalized = normalizeStatusKey(status);
  return normalized === "published";
}

function toEditableString(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function toEditorState(detail: Partial<RfqDetailData> | null): RfqEditorState {
  return {
    pr_number: toEditableString(detail?.pr_number),
    material: toEditableString(detail?.material),
    category: toEditableString(detail?.category),
    quantity: detail?.quantity !== null && detail?.quantity !== undefined ? String(detail.quantity) : "",
    delivery_date: toEditableString(detail?.delivery_date),
    submission_deadline: toEditableString(detail?.submission_deadline),
    full_specs: toEditableString(detail?.full_specs),
    scope_of_work: toEditableString(detail?.scope_of_work),
    technical_specs: toEditableString(detail?.technical_specs),
    payment_terms: toEditableString(detail?.payment_terms),
    evaluation_criteria: toEditableString(detail?.evaluation_criteria),
  };
}

function buildEditorPayload(state: RfqEditorState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (state.pr_number.trim()) {
    payload.pr_number = state.pr_number.trim();
  }

  if (state.material.trim()) {
    payload.material = state.material.trim();
  }

  if (state.category.trim()) {
    payload.category = state.category.trim();
  }

  if (state.quantity.trim()) {
    const quantity = Number(state.quantity);
    if (Number.isFinite(quantity)) {
      payload.quantity = quantity;
    }
  }

  if (state.delivery_date.trim()) {
    payload.delivery_date = state.delivery_date.trim();
  }

  if (state.submission_deadline.trim()) {
    payload.submission_deadline = state.submission_deadline.trim();
  }

  if (state.full_specs.trim()) {
    payload.full_specs = state.full_specs.trim();
  }

  if (state.scope_of_work.trim()) {
    payload.scope_of_work = state.scope_of_work.trim();
  }

  if (state.technical_specs.trim()) {
    payload.technical_specs = state.technical_specs.trim();
  }

  if (state.payment_terms.trim()) {
    payload.payment_terms = state.payment_terms.trim();
  }

  if (state.evaluation_criteria.trim()) {
    payload.evaluation_criteria = state.evaluation_criteria.trim();
  }

  return payload;
}

function normalizeChecklistField(field: string) {
  return field.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function isEditorFieldMissing(field: keyof RfqEditorState, missingFields: string[]) {
  const aliases = new Set(
    EDITOR_FIELD_ALIASES[field].map((entry) => normalizeChecklistField(entry)),
  );

  return missingFields.some((entry) => aliases.has(normalizeChecklistField(entry)));
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<RfqEditorMode>("create");
  const [editorRfqId, setEditorRfqId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<RfqEditorState>(EMPTY_EDITOR_STATE);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorMissingFields, setEditorMissingFields] = useState<string[]>([]);
  const [orchestrationStats, setOrchestrationStats] = useState<Record<string, RfqOrchestrationStats>>({});

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

  const updateEditorField = (field: keyof RfqEditorState, value: string) => {
    setEditorState((prev) => ({ ...prev, [field]: value }));
    setEditorMissingFields((prev) => prev.filter((entry) => !isEditorFieldMissing(field, [entry])));
  };

  const setOrchestrationStatsForRfq = (rfqId: string, patch: Partial<RfqOrchestrationStats>) => {
    setOrchestrationStats((prev) => {
      const current = prev[rfqId] ?? {
        status: null,
        public_link: null,
        vendors_invited: null,
        emails_sent: null,
        in_app_sent: null,
      };

      return {
        ...prev,
        [rfqId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const refreshRfqViews = async (rfqId: string) => {
    await rfqListQuery.refetch();

    if (selectedRfqId === rfqId) {
      await rfqDetailQuery.refetch();
    }

    queryClient.invalidateQueries({ queryKey: rfqQueryKeys.detail(rfqId) });
    queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.live(rfqId) });
    queryClient.refetchQueries({ queryKey: bidWorkflowQueryKeys.live(rfqId), type: "active" });
  };

  const openCreateEditor = () => {
    setEditorMode("create");
    setEditorRfqId(null);
    setEditorState(EMPTY_EDITOR_STATE);
    setEditorMissingFields([]);
    setSelectedRfqId(null);
    setEditorOpen(true);
  };

  const openEditEditor = async (rfqId: string, missingFields: string[] = []) => {
    setEditorMode("edit");
    setEditorRfqId(rfqId);
    setEditorMissingFields(missingFields);
    setSelectedRfqId(null);
    setEditorOpen(true);
    setEditorLoading(true);

    try {
      const detail = await getRfqDetail(rfqId);
      setEditorState(toEditorState(detail));
    } catch (error) {
      toast({
        title: "Unable to load RFQ for edit",
        description: getRfqWorkflowApiErrorMessage(error),
        variant: "destructive",
      });
      setEditorState(EMPTY_EDITOR_STATE);
    } finally {
      setEditorLoading(false);
    }
  };

  const handleEditorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditorLoading(true);

    const payload = buildEditorPayload(editorState);

    try {
      if (editorMode === "create") {
        const created = await createManualRfq(payload);

        upsertRfqWorkflowCache({
          rfq_id: created.rfq_id,
          rfq_number: created.rfq_number,
          status: created.status,
          actions_available: created.actions_available,
          public_link: created.public_link,
        });

        await refreshRfqViews(created.rfq_id);
        setSelectedRfqId(created.rfq_id);

        toast({
          title: "Draft RFQ created",
          description: `RFQ ${created.rfq_number || created.rfq_id} is ready for internal review.`,
        });
      } else {
        if (!editorRfqId) {
          throw new Error("RFQ id is required for edit");
        }

        const updated = await updateRfq(editorRfqId, payload);

        upsertRfqWorkflowCache({
          rfq_id: updated.rfq_id,
          rfq_number: updated.rfq_number,
          status: updated.status,
          actions_available: updated.actions_available,
          public_link: updated.public_link,
        });

        await refreshRfqViews(updated.rfq_id);
        setSelectedRfqId(updated.rfq_id);

        toast({
          title: "RFQ updated",
          description: `RFQ ${updated.rfq_number || updated.rfq_id} was saved successfully.`,
        });
      }

      setEditorOpen(false);
      setEditorMissingFields([]);
      setEditorState(EMPTY_EDITOR_STATE);
    } catch (error) {
      toast({
        title: editorMode === "create" ? "Create failed" : "Update failed",
        description: getRfqWorkflowApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setEditorLoading(false);
    }
  };

  const handleDelete = async (rfq: RfqListItem) => {
    const approved = window.confirm(`Delete RFQ ${rfq.rfq_number || rfq.rfq_id}? This cannot be undone.`);
    if (!approved) {
      return;
    }

    const requestKey = `${rfq.rfq_id}:delete`;
    setActionInFlight(requestKey);

    try {
      const result = await deleteRfq(rfq.rfq_id);
      await rfqListQuery.refetch();

      if (selectedRfqId === rfq.rfq_id) {
        setSelectedRfqId(null);
      }

      toast({
        title: "RFQ deleted",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: getRfqWorkflowApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setActionInFlight(null);
    }
  };

  const handleOpenForBidding = async (rfq: RfqListItem) => {
    if (!isOpenForBiddingAllowed(rfq.status)) {
      toast({
        title: "Send first",
        description: "Send to Vendors must complete before Open for Bidding.",
        variant: "destructive",
      });
      return;
    }

    const requestKey = `${rfq.rfq_id}:open`;
    setActionInFlight(requestKey);

    const currentWorkflow: RfqWorkflow = {
      rfq_id: rfq.rfq_id,
      rfq_number: rfq.rfq_number,
      status: rfq.status,
      actions_available: rfq.actions_available,
      public_link: rfq.public_link,
    };

    try {
      const result = await openRfqForBidding(rfq.rfq_id, currentWorkflow);

      upsertRfqWorkflowCache({
        rfq_id: rfq.rfq_id,
        rfq_number: result.rfq_number || rfq.rfq_number,
        status: result.status || rfq.status,
        actions_available: result.actions_available.length > 0 ? result.actions_available : rfq.actions_available,
        public_link: result.public_link || rfq.public_link,
      });

      setOrchestrationStatsForRfq(rfq.rfq_id, {
        status: result.status,
        public_link: result.public_link,
        vendors_invited: result.vendors_invited,
        emails_sent: result.notifications.emails_sent,
        in_app_sent: result.notifications.in_app_sent,
      });

      await refreshRfqViews(rfq.rfq_id);

      toast({
        title: result.already_published ? "Already open" : "Open for bidding",
        description: `Status: ${toRfqStatusLabel(result.status)}. Emails: ${result.notifications.emails_sent ?? 0}, In-app: ${result.notifications.in_app_sent ?? 0}.`,
      });
    } catch (error) {
      toast({
        title: "Open for bidding failed",
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
      if (!isSendAllowed(rfq.status)) {
        toast({
          title: "Send unavailable",
          description: "Only Draft or Published RFQs can be sent to vendors.",
          variant: "destructive",
        });
        return;
      }

      const result = await sendRfqToVendors(rfq.rfq_id);

      upsertRfqWorkflowCache({
        rfq_id: rfq.rfq_id,
        rfq_number: result.rfq_number || rfq.rfq_number,
        status: result.status || rfq.status,
        actions_available: rfq.actions_available,
        public_link: result.public_link || rfq.public_link,
      });

      setOrchestrationStatsForRfq(rfq.rfq_id, {
        status: result.status,
        public_link: result.public_link,
        vendors_invited: result.vendors_invited,
        emails_sent: result.notifications.emails_sent,
        in_app_sent: result.notifications.in_app_sent,
      });

      await refreshRfqViews(rfq.rfq_id);

      toast({
        title: "RFQ sent",
        description: `Status: ${toRfqStatusLabel(result.status)}. Vendors invited: ${result.vendors_invited ?? "N/A"}. Emails: ${result.notifications.emails_sent ?? 0}, In-app: ${result.notifications.in_app_sent ?? 0}.`,
      });
    } catch (error) {
      const missingFields = getRfqWorkflowMissingFields(error);

      if (missingFields.length > 0) {
        toast({
          title: "RFQ incomplete",
          description: "Complete the required fields in edit mode, then retry send.",
          variant: "destructive",
        });

        await openEditEditor(rfq.rfq_id, missingFields);
        return;
      }

      toast({
        title: "Send failed",
        description: getRfqWorkflowApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setActionInFlight(null);
    }
  };

  const handleRefresh = async () => {
    await rfqListQuery.refetch();
    if (selectedRfqId) {
      await rfqDetailQuery.refetch();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFQ / Tender Management"
        description="Draft, edit, send to vendors, and open for bidding"
        actions={
          <Button type="button" className="gap-2" onClick={openCreateEditor}>
            <PlusCircle className="h-4 w-4" />
            Manual Draft RFQ
          </Button>
        }
      />

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
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="open_for_bidding">Open for Bidding</SelectItem>
            <SelectItem value="open">Open (Legacy)</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" className="gap-2" onClick={handleRefresh}>
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
            const pdfUrl = getRfqPdfDownloadUrl(rfq.rfq_id, rfq.pdf_download_url);
            const stats = orchestrationStats[rfq.rfq_id] ?? null;
            const publicLink = getRfqPublicLink(stats?.public_link || rfq.public_link);
            const vendorsInvited = stats?.vendors_invited ?? rfq.vendors_invited_count;

            const reviewRequestKey = `${rfq.rfq_id}:review`;
            const editRequestKey = `${rfq.rfq_id}:edit`;
            const sendRequestKey = `${rfq.rfq_id}:send`;
            const openRequestKey = `${rfq.rfq_id}:open`;
            const deleteRequestKey = `${rfq.rfq_id}:delete`;

            const isReviewLoading = actionInFlight === reviewRequestKey;
            const isEditLoading = actionInFlight === editRequestKey;
            const isSendLoading = actionInFlight === sendRequestKey;
            const isOpenLoading = actionInFlight === openRequestKey;
            const isDeleteLoading = actionInFlight === deleteRequestKey;
            const isActionBusy = actionInFlight !== null;

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
                      <span className="text-xs text-muted-foreground">{toRfqStatusLabel(rfq.status)}</span>
                      <span className="text-xs text-muted-foreground">rfq_id: {rfq.rfq_id}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                      <p><span className="text-muted-foreground">pr_number:</span> {rfq.pr_number || "Not available"}</p>
                      <p><span className="text-muted-foreground">material:</span> {rfq.material || "Not available"}</p>
                      <p><span className="text-muted-foreground">category:</span> {rfq.category || "Not available"}</p>
                      <p><span className="text-muted-foreground">quantity:</span> {rfq.quantity ?? "Not available"}</p>
                      <p><span className="text-muted-foreground">delivery_date:</span> {formatDateTime(rfq.delivery_date)}</p>
                      <p><span className="text-muted-foreground">submission_deadline:</span> {formatDateTime(rfq.submission_deadline)}</p>
                      <p><span className="text-muted-foreground">vendors_invited_count:</span> {vendorsInvited ?? "Not available"}</p>
                      <p><span className="text-muted-foreground">last_sent_at:</span> {formatDateTime(rfq.last_sent_at)}</p>
                      <p><span className="text-muted-foreground">created_at:</span> {formatDateTime(rfq.created_at)}</p>
                      <p><span className="text-muted-foreground">updated_at:</span> {formatDateTime(rfq.updated_at)}</p>
                    </div>

                    {stats && (
                      <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                        <p>notifications: emails_sent={stats.emails_sent ?? 0}, in_app_sent={stats.in_app_sent ?? 0}</p>
                        <p>orchestration_status: {toRfqStatusLabel(stats.status)}</p>
                      </div>
                    )}

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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={isActionBusy && !isReviewLoading}
                      onClick={() => setSelectedRfqId(rfq.rfq_id)}
                    >
                      <Eye className="h-4 w-4" />
                      Review
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={isActionBusy && !isEditLoading}
                      onClick={() => openEditEditor(rfq.rfq_id)}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      className="gap-2"
                      disabled={!isSendAllowed(rfq.status) || (isActionBusy && !isSendLoading)}
                      onClick={() => handleSend(rfq)}
                    >
                      {isSendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send to Vendors
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={!isOpenForBiddingAllowed(rfq.status) || (isActionBusy && !isOpenLoading)}
                      onClick={() => handleOpenForBidding(rfq)}
                    >
                      {isOpenLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                      Open for Bidding
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2 text-destructive hover:text-destructive"
                      disabled={isActionBusy && !isDeleteLoading}
                      onClick={() => handleDelete(rfq)}
                    >
                      {isDeleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Delete
                    </Button>

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
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={rfqDetailQuery.data.status || "draft"} />
                    <span className="text-xs text-muted-foreground">{toRfqStatusLabel(rfqDetailQuery.data.status)}</span>
                    <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => openEditEditor(rfqDetailQuery.data.rfq_id)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button type="button" size="sm" className="gap-2" disabled={!isSendAllowed(rfqDetailQuery.data.status)} onClick={() => handleSend(rfqDetailQuery.data)}>
                      <Send className="h-4 w-4" /> Send
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="gap-2" disabled={!isOpenForBiddingAllowed(rfqDetailQuery.data.status)} onClick={() => handleOpenForBidding(rfqDetailQuery.data)}>
                      <Rocket className="h-4 w-4" /> Open
                    </Button>
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

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditorMissingFields([]);
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editorMode === "create" ? "Create Manual Draft RFQ" : `Edit RFQ ${editorRfqId || ""}`}</DialogTitle>
          </DialogHeader>

          {editorMissingFields.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-medium text-warning">Complete these fields before sending:</p>
              <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                {editorMissingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleEditorSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className={cn("text-xs", isEditorFieldMissing("pr_number", editorMissingFields) ? "text-destructive" : "text-muted-foreground")}>PR Number</p>
                <Input value={editorState.pr_number} onChange={(event) => updateEditorField("pr_number", event.target.value)} />
              </div>

              <div className="space-y-1">
                <p className={cn("text-xs", isEditorFieldMissing("material", editorMissingFields) ? "text-destructive" : "text-muted-foreground")}>Material</p>
                <Input value={editorState.material} onChange={(event) => updateEditorField("material", event.target.value)} />
              </div>

              <div className="space-y-1">
                <p className={cn("text-xs", isEditorFieldMissing("category", editorMissingFields) ? "text-destructive" : "text-muted-foreground")}>Category</p>
                <Input value={editorState.category} onChange={(event) => updateEditorField("category", event.target.value)} />
              </div>

              <div className="space-y-1">
                <p className={cn("text-xs", isEditorFieldMissing("quantity", editorMissingFields) ? "text-destructive" : "text-muted-foreground")}>Quantity</p>
                <Input value={editorState.quantity} onChange={(event) => updateEditorField("quantity", event.target.value)} type="number" min="0" step="1" />
              </div>

              <div className="space-y-1">
                <p className={cn("text-xs", isEditorFieldMissing("delivery_date", editorMissingFields) ? "text-destructive" : "text-muted-foreground")}>Delivery Date</p>
                <Input value={editorState.delivery_date} onChange={(event) => updateEditorField("delivery_date", event.target.value)} placeholder="2026-04-30T10:00:00" />
              </div>

              <div className="space-y-1">
                <p className={cn("text-xs", isEditorFieldMissing("submission_deadline", editorMissingFields) ? "text-destructive" : "text-muted-foreground")}>Submission Deadline</p>
                <Input value={editorState.submission_deadline} onChange={(event) => updateEditorField("submission_deadline", event.target.value)} placeholder="2026-05-05T18:00:00" />
              </div>
            </div>

            <div className="space-y-1">
              <p className={cn("text-xs", isEditorFieldMissing("full_specs", editorMissingFields) ? "text-destructive" : "text-muted-foreground")}>Full Specs</p>
              <Textarea rows={3} value={editorState.full_specs} onChange={(event) => updateEditorField("full_specs", event.target.value)} />
            </div>

            <div className="space-y-1">
              <p className={cn("text-xs", isEditorFieldMissing("scope_of_work", editorMissingFields) ? "text-destructive" : "text-muted-foreground")}>Scope of Work</p>
              <Textarea rows={3} value={editorState.scope_of_work} onChange={(event) => updateEditorField("scope_of_work", event.target.value)} />
            </div>

            <div className="space-y-1">
              <p className={cn("text-xs", isEditorFieldMissing("technical_specs", editorMissingFields) ? "text-destructive" : "text-muted-foreground")}>Technical Specs</p>
              <Textarea rows={3} value={editorState.technical_specs} onChange={(event) => updateEditorField("technical_specs", event.target.value)} />
            </div>

            <div className="space-y-1">
              <p className={cn("text-xs", isEditorFieldMissing("payment_terms", editorMissingFields) ? "text-destructive" : "text-muted-foreground")}>Payment Terms</p>
              <Textarea rows={3} value={editorState.payment_terms} onChange={(event) => updateEditorField("payment_terms", event.target.value)} />
            </div>

            <div className="space-y-1">
              <p className={cn("text-xs", isEditorFieldMissing("evaluation_criteria", editorMissingFields) ? "text-destructive" : "text-muted-foreground")}>Evaluation Criteria</p>
              <Textarea rows={3} value={editorState.evaluation_criteria} onChange={(event) => updateEditorField("evaluation_criteria", event.target.value)} />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={editorLoading}>
                Cancel
              </Button>
              <Button type="submit" className="gap-2" disabled={editorLoading}>
                {editorLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SaveIcon />}
                {editorMode === "create" ? "Create Draft" : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaveIcon() {
  return <Pencil className="h-4 w-4" />;
}
