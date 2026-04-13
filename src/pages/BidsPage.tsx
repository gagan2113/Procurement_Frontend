import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  bidWorkflowQueryKeys,
  getBidWorkflowApiErrorMessage,
  isBidInternalAccessError,
  isRfqClosedStatus,
  isRfqOpenStatus,
  type BidEvaluationItem,
  type BidItem,
} from "@/lib/bid-workflow-api";
import {
  useBidLiveSnapshot,
  useBidSubmissions,
  useEvaluateBidMutation,
  useManualOverrideBidMutation,
  useSendForApprovalMutation,
  useSelectBidWinnerMutation,
} from "@/hooks/use-bid-workflow";
import {
  getRfqWorkflowCache,
  subscribeRfqWorkflowCache,
  type RfqWorkflowCacheItem,
  upsertRfqWorkflowCache,
} from "@/lib/rfq-workflow-cache";
import { CheckCircle, Link2, Loader2, RefreshCw, Rocket, Send, ShieldCheck, Trophy } from "lucide-react";

function formatCurrency(value: number | null, currency: string | null) {
  if (value === null || Number.isNaN(value)) {
    return "Not available";
  }

  const prefix = currency || "INR";
  return `${prefix} ${value.toLocaleString()}`;
}

function recommendationClasses(recommendation: string | null | undefined) {
  const normalized = recommendation?.trim().toLowerCase();

  if (normalized === "preferred") {
    return "border-success/30 bg-success/10 text-success";
  }

  if (normalized === "consider") {
    return "border-warning/30 bg-warning/10 text-warning";
  }

  if (normalized === "avoid") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-border bg-muted text-muted-foreground";
}

function normalizeStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "Unknown";
  }

  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (normalized === "open" || normalized === "open_for_bidding") {
    return "Open for Bidding";
  }

  if (normalized === "published") {
    return "Published";
  }

  return status
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function collectDocumentLinks(bid: BidItem): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];

  if (bid.document_links.quotation_pdf_url) {
    links.push({ label: "Quotation", url: bid.document_links.quotation_pdf_url });
  }

  if (bid.document_links.technical_sheet_url) {
    links.push({ label: "Technical Sheet", url: bid.document_links.technical_sheet_url });
  }

  if (bid.document_links.compliance_documents_urls.length > 0) {
    bid.document_links.compliance_documents_urls.forEach((url, index) => {
      links.push({ label: `Compliance ${index + 1}`, url });
    });
  }

  if (bid.document_links.certifications_urls.length > 0) {
    bid.document_links.certifications_urls.forEach((url, index) => {
      links.push({ label: `Certification ${index + 1}`, url });
    });
  }

  return links;
}

function toInternalMessage(error: unknown) {
  if (isBidInternalAccessError(error)) {
    return "Internal access denied. Ensure x-internal-access: true is sent for internal endpoints.";
  }

  return getBidWorkflowApiErrorMessage(error);
}

export default function BidsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [workflowOptions, setWorkflowOptions] = useState<RfqWorkflowCacheItem[]>(() => getRfqWorkflowCache());
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(() => getRfqWorkflowCache()[0]?.rfq_id ?? null);
  const [manualRfqId, setManualRfqId] = useState("");
  const [winnerVendorId, setWinnerVendorId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const liveSnapshotQuery = useBidLiveSnapshot(selectedRfqId, Boolean(selectedRfqId));
  const submissionsQuery = useBidSubmissions(selectedRfqId);
  const evaluateBidMutation = useEvaluateBidMutation();
  const manualOverrideMutation = useManualOverrideBidMutation();
  const sendForApprovalMutation = useSendForApprovalMutation();
  const selectWinnerMutation = useSelectBidWinnerMutation();

  useEffect(() => {
    const unsubscribe = subscribeRfqWorkflowCache((items) => {
      setWorkflowOptions(items);

      if (selectedRfqId && items.some((item) => item.rfq_id === selectedRfqId)) {
        queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.live(selectedRfqId) });
        queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.submissions(selectedRfqId) });
      }
    });

    return unsubscribe;
  }, [queryClient, selectedRfqId]);

  useEffect(() => {
    if (selectedRfqId) {
      const exists = workflowOptions.some((item) => item.rfq_id === selectedRfqId);
      if (exists) {
        return;
      }
    }

    if (workflowOptions.length > 0) {
      setSelectedRfqId(workflowOptions[0].rfq_id);
    }
  }, [selectedRfqId, workflowOptions]);

  useEffect(() => {
    setWinnerVendorId(null);
    setOverrideReason("");
    setStatusMessage(null);
  }, [selectedRfqId]);

  const selectedWorkflow = useMemo(
    () => workflowOptions.find((workflow) => workflow.rfq_id === selectedRfqId) ?? null,
    [selectedRfqId, workflowOptions],
  );

  const snapshot = liveSnapshotQuery.data;
  const submissions = useMemo(
    () => submissionsQuery.data?.bids ?? snapshot?.bids ?? [],
    [submissionsQuery.data?.bids, snapshot?.bids],
  );
  const evaluationItems = useMemo(() => snapshot?.evaluation ?? [], [snapshot?.evaluation]);
  const aiInsights = useMemo(() => snapshot?.ai_insights ?? {}, [snapshot?.ai_insights]);

  const evaluationByVendor = useMemo(() => {
    const map = new Map<string, BidEvaluationItem>();

    evaluationItems.forEach((item) => {
      if (item.vendor_id) {
        map.set(item.vendor_id, item);
      }
    });

    return map;
  }, [evaluationItems]);

  const currentStatus = snapshot?.rfq_status || submissionsQuery.data?.rfq_status || selectedWorkflow?.status || null;
  const isRfqOpen = isRfqOpenStatus(currentStatus);
  const isRfqClosed = isRfqClosedStatus(currentStatus);
  const isDeadlineExpired = snapshot?.deadline_expired === true;

  useEffect(() => {
    if (!selectedRfqId || !snapshot) {
      return;
    }

    upsertRfqWorkflowCache({
      rfq_id: selectedRfqId,
      rfq_number: snapshot.rfq_number,
      status: snapshot.rfq_status,
      selected_vendor_id: snapshot.selected_vendor_id,
      selected_vendor_name: snapshot.selected_vendor_name,
      actions_available: selectedWorkflow?.actions_available ?? [],
      public_link: selectedWorkflow?.public_link ?? null,
    });
  }, [selectedRfqId, selectedWorkflow?.actions_available, selectedWorkflow?.public_link, snapshot]);

  useEffect(() => {
    if (snapshot?.selected_vendor_id) {
      setWinnerVendorId(snapshot.selected_vendor_id);
    }
  }, [snapshot?.selected_vendor_id]);

  const selectedVendorName =
    snapshot?.selected_vendor_name ||
    selectedWorkflow?.selected_vendor_name ||
    submissions.find((bid) => bid.vendor_id && bid.vendor_id === winnerVendorId)?.vendor_name ||
    null;

  const isEvaluating = evaluateBidMutation.isPending;
  const isManualOverride = manualOverrideMutation.isPending;
  const isSendingForApproval = sendForApprovalMutation.isPending;
  const isSelecting = selectWinnerMutation.isPending;

  const canRunInternalActions = Boolean(selectedRfqId) && isRfqOpen && !isRfqClosed;

  const handleManualLoad = () => {
    const normalized = manualRfqId.trim();
    if (!normalized) {
      setStatusMessage("Enter an RFQ ID to load bid workflow.");
      return;
    }

    upsertRfqWorkflowCache({
      rfq_id: normalized,
      status: "draft",
      actions_available: [],
      public_link: null,
    });

    setSelectedRfqId(normalized);
    setManualRfqId("");
  };

  const handleRefresh = async () => {
    if (!selectedRfqId) {
      return;
    }

    await Promise.all([
      liveSnapshotQuery.refetch(),
      submissionsQuery.refetch(),
    ]);
  };

  const handleEvaluate = async () => {
    if (!selectedRfqId) {
      setStatusMessage("Select an RFQ before evaluating bids.");
      return;
    }

    if (!isRfqOpen || isRfqClosed) {
      setStatusMessage("Evaluation is enabled only when RFQ status is open.");
      return;
    }

    try {
      const result = await evaluateBidMutation.mutateAsync({ rfqId: selectedRfqId });
      setStatusMessage("Evaluation refreshed from backend response.");

      upsertRfqWorkflowCache({
        rfq_id: selectedRfqId,
        rfq_number: result.snapshot.rfq_number,
        status: result.snapshot.rfq_status,
        selected_vendor_id: result.snapshot.selected_vendor_id,
        selected_vendor_name: result.snapshot.selected_vendor_name,
        actions_available: selectedWorkflow?.actions_available ?? [],
        public_link: selectedWorkflow?.public_link ?? null,
      });

      toast({ title: "Evaluation complete", description: result.message });
    } catch (error) {
      const message = toInternalMessage(error);
      setStatusMessage(message);
      toast({
        title: "Evaluation failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleManualOverride = async () => {
    if (!selectedRfqId) {
      setStatusMessage("Select an RFQ before applying manual override.");
      return;
    }

    if (!winnerVendorId) {
      setStatusMessage("Choose a vendor first, then apply manual override.");
      return;
    }

    if (!isRfqOpen || isRfqClosed) {
      setStatusMessage("Manual override is enabled only while RFQ is open.");
      return;
    }

    try {
      const result = await manualOverrideMutation.mutateAsync({
        rfqId: selectedRfqId,
        payload: {
          vendor_id: winnerVendorId,
          reason: overrideReason.trim() || undefined,
        },
      });

      setStatusMessage("Manual override applied and snapshot refreshed.");

      upsertRfqWorkflowCache({
        rfq_id: selectedRfqId,
        rfq_number: result.snapshot.rfq_number,
        status: result.snapshot.rfq_status,
        selected_vendor_id: result.snapshot.selected_vendor_id || winnerVendorId,
        selected_vendor_name: result.snapshot.selected_vendor_name || selectedVendorName,
        actions_available: selectedWorkflow?.actions_available ?? [],
        public_link: selectedWorkflow?.public_link ?? null,
      });

      toast({ title: "Manual override applied", description: result.message });
    } catch (error) {
      const message = toInternalMessage(error);
      setStatusMessage(message);
      toast({ title: "Manual override failed", description: message, variant: "destructive" });
    }
  };

  const handleSendForApproval = async () => {
    if (!selectedRfqId) {
      setStatusMessage("Select an RFQ before sending for approval.");
      return;
    }

    if (!isRfqOpen || isRfqClosed) {
      setStatusMessage("Approval handoff is enabled only while RFQ is open.");
      return;
    }

    try {
      const result = await sendForApprovalMutation.mutateAsync({
        rfqId: selectedRfqId,
        payload: {
          vendor_id: winnerVendorId || undefined,
          note: overrideReason.trim() || undefined,
        },
      });

      setStatusMessage("Bid package sent for approval.");

      upsertRfqWorkflowCache({
        rfq_id: selectedRfqId,
        rfq_number: result.snapshot.rfq_number,
        status: result.snapshot.rfq_status,
        selected_vendor_id: result.snapshot.selected_vendor_id || winnerVendorId,
        selected_vendor_name: result.snapshot.selected_vendor_name || selectedVendorName,
        actions_available: selectedWorkflow?.actions_available ?? [],
        public_link: selectedWorkflow?.public_link ?? null,
      });

      toast({ title: "Sent for approval", description: result.message });
    } catch (error) {
      const message = toInternalMessage(error);
      setStatusMessage(message);
      toast({ title: "Send for approval failed", description: message, variant: "destructive" });
    }
  };

  const handleFinalizeWinner = async () => {
    if (!selectedRfqId) {
      setStatusMessage("Select an RFQ before finalizing winner.");
      return;
    }

    if (!winnerVendorId) {
      setStatusMessage("Choose a winner vendor before finalizing.");
      return;
    }

    if (!isRfqOpen || isRfqClosed) {
      setStatusMessage("Winner finalization is enabled only while RFQ is open.");
      return;
    }

    try {
      const result = await selectWinnerMutation.mutateAsync({
        rfqId: selectedRfqId,
        vendorId: winnerVendorId,
      });

      const winningVendorName =
        result.snapshot.selected_vendor_name ||
        submissions.find((bid) => bid.vendor_id === winnerVendorId)?.vendor_name ||
        winnerVendorId;

      upsertRfqWorkflowCache({
        rfq_id: selectedRfqId,
        rfq_number: result.snapshot.rfq_number,
        status: result.snapshot.rfq_status || "closed",
        selected_vendor_id: result.snapshot.selected_vendor_id || winnerVendorId,
        selected_vendor_name: result.snapshot.selected_vendor_name || winningVendorName,
        actions_available: selectedWorkflow?.actions_available ?? [],
        public_link: selectedWorkflow?.public_link ?? null,
      });

      queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.live(selectedRfqId) });
      queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.submissions(selectedRfqId) });

      setStatusMessage(`RFQ closed. Winner selected: ${winningVendorName}.`);
      toast({ title: "Winner finalized", description: result.message });
    } catch (error) {
      const message = toInternalMessage(error);
      setStatusMessage(message);
      toast({ title: "Selection failed", description: message, variant: "destructive" });
    }
  };

  const requiresSequenceSetup = !selectedRfqId && workflowOptions.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bid Management"
        description="Internal submissions review, evaluation, override, approval handoff, and final selection"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRefresh}
            disabled={!selectedRfqId || liveSnapshotQuery.isFetching || submissionsQuery.isFetching}
          >
            {liveSnapshotQuery.isFetching || submissionsQuery.isFetching
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      {requiresSequenceSetup && (
        <div className="rounded-xl border bg-card p-5 card-shadow text-sm text-muted-foreground">
          Finance approval and RFQ lifecycle progression should happen before internal bid management becomes active.
        </div>
      )}

      <div className="rounded-xl border bg-card p-5 card-shadow space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={selectedRfqId ?? undefined} onValueChange={setSelectedRfqId}>
              <SelectTrigger className="sm:w-[320px]">
                <SelectValue placeholder="Select RFQ from workflow cache" />
              </SelectTrigger>
              <SelectContent>
                {workflowOptions.map((workflow) => (
                  <SelectItem key={workflow.rfq_id} value={workflow.rfq_id}>
                    {(workflow.rfq_number || workflow.rfq_id)} · {normalizeStatusLabel(workflow.status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Or enter RFQ ID"
                value={manualRfqId}
                onChange={(event) => setManualRfqId(event.target.value)}
              />
              <Button type="button" variant="outline" onClick={handleManualLoad}>Load</Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={currentStatus || "draft"} />
            <Badge variant="outline">{normalizeStatusLabel(currentStatus)}</Badge>
          </div>
        </div>

        {selectedWorkflow?.public_link && (
          <p className="text-xs text-muted-foreground">public_link: {selectedWorkflow.public_link}</p>
        )}

        {!isRfqOpen && !isRfqClosed && selectedRfqId && (
          <p className="text-xs text-warning">
            RFQ is not open for bidding. Internal actions are disabled until the RFQ reaches open state.
          </p>
        )}

        {isDeadlineExpired && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            Submission deadline has expired. Vendor submissions are closed; internal evaluation actions remain available.
          </div>
        )}

        {isRfqClosed && (
          <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
            RFQ is closed. Selected vendor: {selectedVendorName || snapshot?.selected_vendor_id || "Not available"}.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Manual Override / Approval Note</p>
            <Textarea
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              rows={3}
              placeholder="Optional reason for manual override or approval handoff"
            />
          </div>

          <div className="flex flex-wrap lg:flex-col gap-2">
            <Button
              type="button"
              className="gap-2"
              onClick={handleEvaluate}
              disabled={!canRunInternalActions || isEvaluating}
            >
              {isEvaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Evaluate
            </Button>

            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleManualOverride}
              disabled={!canRunInternalActions || isManualOverride || !winnerVendorId}
            >
              {isManualOverride ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Manual Override
            </Button>

            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleSendForApproval}
              disabled={!canRunInternalActions || isSendingForApproval}
            >
              {isSendingForApproval ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send for Approval
            </Button>

            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleFinalizeWinner}
              disabled={!canRunInternalActions || isSelecting || !winnerVendorId}
            >
              {isSelecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Finalize Winner
            </Button>
          </div>
        </div>

        {statusMessage && (
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {(submissionsQuery.isLoading || (liveSnapshotQuery.isLoading && selectedRfqId)) && (
            <div className="rounded-xl border bg-card p-5 card-shadow text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading bid submissions...
            </div>
          )}

          {submissionsQuery.isError && selectedRfqId && (
            <div className="rounded-xl border border-destructive/30 bg-card p-5 card-shadow space-y-2">
              <p className="text-sm text-destructive">{toInternalMessage(submissionsQuery.error)}</p>
              <Button type="button" variant="outline" size="sm" onClick={handleRefresh}>Retry</Button>
            </div>
          )}

          {!submissionsQuery.isLoading && !submissionsQuery.isError && selectedRfqId && (
            <div className="rounded-xl border bg-card card-shadow overflow-hidden">
              {submissions.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">No bid submissions returned by data.bids from /submissions.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Lead Time</TableHead>
                      <TableHead>Document Status</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Compliance</TableHead>
                      <TableHead>Score / Rank</TableHead>
                      <TableHead>Winner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((bid, index) => {
                      const vendorId = bid.vendor_id;
                      const isWinner = Boolean(vendorId) && (vendorId === winnerVendorId || vendorId === snapshot?.selected_vendor_id);
                      const isSelectable = Boolean(vendorId) && !isRfqClosed;
                      const links = collectDocumentLinks(bid);
                      const evaluation = vendorId ? evaluationByVendor.get(vendorId) : null;
                      const score = evaluation?.score ?? bid.score;
                      const rank = evaluation?.rank ?? bid.rank;

                      return (
                        <TableRow key={`${bid.bid_id || vendorId || "bid"}-${index}`} className={isWinner ? "bg-success/10" : ""}>
                          <TableCell className="font-medium">{bid.vendor_name || "Not available"}</TableCell>
                          <TableCell>{formatCurrency(bid.price, bid.currency)}</TableCell>
                          <TableCell>{bid.lead_time !== null ? `${bid.lead_time} days` : "Not available"}</TableCell>
                          <TableCell>{bid.document_status || "Not available"}</TableCell>
                          <TableCell>
                            {links.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Not available</span>
                            ) : (
                              <div className="space-y-1">
                                {links.map((link) => (
                                  <a
                                    key={`${link.label}-${link.url}`}
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-xs text-primary underline underline-offset-2"
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      <Link2 className="h-3 w-3" />
                                      {link.label}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{bid.compliance_score !== null ? `${bid.compliance_score}%` : "Not available"}</TableCell>
                          <TableCell>
                            {score !== null && rank !== null
                              ? `${score.toFixed(2)} / #${rank}`
                              : score !== null
                                ? score.toFixed(2)
                                : "Not available"}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant={isWinner ? "default" : "outline"}
                              className="gap-2"
                              disabled={!isSelectable || !canRunInternalActions}
                              onClick={() => setWinnerVendorId(vendorId)}
                            >
                              {isWinner ? <CheckCircle className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
                              {isWinner ? "Selected" : "Choose"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {evaluationItems.length > 0 && (
            <div className="rounded-xl border bg-card p-5 card-shadow">
              <h3 className="text-sm font-semibold mb-3">Evaluation (data.evaluation)</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {evaluationItems.map((item, index) => {
                  const vendorName = item.vendor_name || (item.vendor_id ? submissions.find((bid) => bid.vendor_id === item.vendor_id)?.vendor_name : null);

                  return (
                    <div key={`${item.vendor_id || "evaluation"}-${index}`} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{vendorName || item.vendor_id || "Unknown Vendor"}</p>
                        <Badge className={recommendationClasses(item.recommendation)}>
                          {item.recommendation || "No Recommendation"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <p><span className="text-muted-foreground">score:</span> {item.score !== null ? item.score.toFixed(2) : "N/A"}</p>
                        <p><span className="text-muted-foreground">rank:</span> {item.rank !== null ? `#${item.rank}` : "N/A"}</p>
                        <p><span className="text-muted-foreground">price:</span> {item.breakdown.price ?? "N/A"}</p>
                        <p><span className="text-muted-foreground">quality:</span> {item.breakdown.quality ?? "N/A"}</p>
                        <p><span className="text-muted-foreground">delivery:</span> {item.breakdown.delivery ?? "N/A"}</p>
                        <p><span className="text-muted-foreground">reliability:</span> {item.breakdown.reliability ?? "N/A"}</p>
                        <p><span className="text-muted-foreground">capability:</span> {item.breakdown.capability ?? "N/A"}</p>
                        <p><span className="text-muted-foreground">risk:</span> {item.breakdown.risk ?? "N/A"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <AiInsightPanel title="Bid AI Insights">
            <p className="text-xs">
              Renders data.ai_insights strengths, risks, and recommendation by vendor.
            </p>
          </AiInsightPanel>

          <div className="space-y-3">
            {submissions.length === 0 && (
              <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                No vendors available for AI insight rendering.
              </div>
            )}

            {submissions.map((bid, index) => {
              const vendorId = bid.vendor_id;
              const insight = vendorId ? aiInsights[vendorId] : null;

              return (
                <div key={`${bid.vendor_name || "insight"}-${index}`} className="rounded-xl border bg-card p-4 card-shadow">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{bid.vendor_name || "Unknown Vendor"}</p>
                    <Badge className={recommendationClasses(insight?.recommendation)}>
                      {insight?.recommendation || "No Recommendation"}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Strengths</p>
                      {insight?.strengths && insight.strengths.length > 0 ? (
                        <ul className="mt-1 list-disc list-inside text-xs space-y-1">
                          {insight.strengths.map((strength, insightIndex) => (
                            <li key={`${strength}-${insightIndex}`}>{strength}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs mt-1 text-muted-foreground">No strengths provided.</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Risks</p>
                      {insight?.risks && insight.risks.length > 0 ? (
                        <ul className="mt-1 list-disc list-inside text-xs space-y-1">
                          {insight.risks.map((risk, riskIndex) => (
                            <li key={`${risk}-${riskIndex}`}>{risk}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs mt-1 text-muted-foreground">No risks provided.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isRfqClosed && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-5 card-shadow">
          <h3 className="text-sm font-semibold text-success">Bidding Closed</h3>
          <p className="text-sm mt-1 text-muted-foreground">
            RFQ is closed and ranking actions are frozen. Selected vendor: {selectedVendorName || "Not available"}.
          </p>
        </div>
      )}
    </div>
  );
}
