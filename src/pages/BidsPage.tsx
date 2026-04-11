import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  bidWorkflowQueryKeys,
  getBidWorkflowApiErrorMessage,
  isRfqClosedStatus,
  isRfqOpenStatus,
} from "@/lib/bid-workflow-api";
import {
  useBidLiveSnapshot,
  useEvaluateBidMutation,
  useSelectBidWinnerMutation,
  useSubmitBidMutation,
} from "@/hooks/use-bid-workflow";
import {
  getRfqWorkflowCache,
  subscribeRfqWorkflowCache,
  type RfqWorkflowCacheItem,
  upsertRfqWorkflowCache,
} from "@/lib/rfq-workflow-cache";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, Rocket, Send, Trophy } from "lucide-react";

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Not available";
  }

  return `INR ${value.toLocaleString()}`;
}

function recommendationClasses(recommendation: "Preferred" | "Consider" | "Avoid" | null) {
  if (recommendation === "Preferred") {
    return "border-success/30 bg-success/10 text-success";
  }

  if (recommendation === "Consider") {
    return "border-warning/30 bg-warning/10 text-warning";
  }

  if (recommendation === "Avoid") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-border bg-muted text-muted-foreground";
}

function normalizeStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "Unknown";
  }

  if (status.trim().toLowerCase() === "open") {
    return "Open for Bidding";
  }

  return status
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function BidsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [workflowOptions, setWorkflowOptions] = useState<RfqWorkflowCacheItem[]>(() => getRfqWorkflowCache());
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(() => getRfqWorkflowCache()[0]?.rfq_id ?? null);
  const [manualRfqId, setManualRfqId] = useState("");
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [winnerVendorId, setWinnerVendorId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const liveSnapshotQuery = useBidLiveSnapshot(selectedRfqId, Boolean(selectedRfqId));
  const submitBidMutation = useSubmitBidMutation();
  const evaluateBidMutation = useEvaluateBidMutation();
  const selectWinnerMutation = useSelectBidWinnerMutation();

  useEffect(() => {
    const unsubscribe = subscribeRfqWorkflowCache((items) => {
      setWorkflowOptions(items);

      if (selectedRfqId && items.some((item) => item.rfq_id === selectedRfqId)) {
        queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.live(selectedRfqId) });
        queryClient.refetchQueries({ queryKey: bidWorkflowQueryKeys.live(selectedRfqId), type: "active" });
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
    setSelectedVendorIds([]);
    setWinnerVendorId(null);
    setStatusMessage(null);
  }, [selectedRfqId]);

  const selectedWorkflow = useMemo(
    () => workflowOptions.find((workflow) => workflow.rfq_id === selectedRfqId) ?? null,
    [selectedRfqId, workflowOptions],
  );

  const snapshot = liveSnapshotQuery.data;
  const bids = useMemo(() => snapshot?.bids ?? [], [snapshot?.bids]);
  const aiInsights = useMemo(() => snapshot?.ai_insights ?? {}, [snapshot?.ai_insights]);
  const evaluation = useMemo(() => snapshot?.evaluation ?? null, [snapshot?.evaluation]);

  const currentStatus = snapshot?.rfq_status || selectedWorkflow?.status || null;
  const isRfqOpen = isRfqOpenStatus(currentStatus);
  const isRfqClosed = isRfqClosedStatus(currentStatus);

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

  useEffect(() => {
    if (selectedVendorIds.length > 0 || bids.length === 0) {
      return;
    }

    const vendorIds = bids
      .map((bid) => bid.vendor_id)
      .filter((vendorId): vendorId is string => typeof vendorId === "string" && Boolean(vendorId));

    if (vendorIds.length > 0) {
      setSelectedVendorIds(vendorIds);
    }
  }, [bids, selectedVendorIds.length]);

  const selectedVendorName =
    snapshot?.selected_vendor_name ||
    selectedWorkflow?.selected_vendor_name ||
    bids.find((bid) => bid.vendor_id && bid.vendor_id === snapshot?.selected_vendor_id)?.vendor_name ||
    null;

  const isSubmitting = submitBidMutation.isPending;
  const isEvaluating = evaluateBidMutation.isPending;
  const isSelecting = selectWinnerMutation.isPending;

  const disableBidControls = !selectedRfqId || !isRfqOpen || isRfqClosed;

  const toggleVendorSelection = (vendorId: string, checked: boolean) => {
    setSelectedVendorIds((prev) => {
      if (checked) {
        if (prev.includes(vendorId)) {
          return prev;
        }

        return [...prev, vendorId];
      }

      return prev.filter((id) => id !== vendorId);
    });
  };

  const handleManualLoad = () => {
    const normalized = manualRfqId.trim();
    if (!normalized) {
      setStatusMessage("Enter an RFQ ID to load live bidding snapshot.");
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

    await liveSnapshotQuery.refetch();
  };

  const handleSubmitBids = async () => {
    if (!selectedRfqId) {
      setStatusMessage("Select an RFQ before submitting bids.");
      return;
    }

    if (!isRfqOpen || isRfqClosed) {
      setStatusMessage("Bid submit is enabled only when RFQ status is open.");
      return;
    }

    try {
      const result = await submitBidMutation.mutateAsync({
        rfqId: selectedRfqId,
        payload: {
          vendor_ids: selectedVendorIds,
        },
      });

      setStatusMessage("Leaderboard refreshed from submit response payload.");
      upsertRfqWorkflowCache({
        rfq_id: selectedRfqId,
        rfq_number: result.snapshot.rfq_number,
        status: result.snapshot.rfq_status,
        selected_vendor_id: result.snapshot.selected_vendor_id,
        selected_vendor_name: result.snapshot.selected_vendor_name,
        actions_available: selectedWorkflow?.actions_available ?? [],
        public_link: selectedWorkflow?.public_link ?? null,
      });

      toast({ title: "Bid submit complete", description: result.message });
    } catch (error) {
      const message = getBidWorkflowApiErrorMessage(error);
      setStatusMessage(message);
      toast({ title: "Bid submit failed", description: message, variant: "destructive" });
    }
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
      const message = getBidWorkflowApiErrorMessage(error);
      setStatusMessage(message);
      toast({
        title: "Evaluation failed",
        description: message,
        variant: "destructive",
      });
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
        bids.find((bid) => bid.vendor_id === winnerVendorId)?.vendor_name ||
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
      queryClient.refetchQueries({ queryKey: bidWorkflowQueryKeys.live(selectedRfqId), type: "active" });

      setStatusMessage(`RFQ closed. Winner selected: ${winningVendorName}.`);
      toast({ title: "Winner finalized", description: result.message });
    } catch (error) {
      const message = getBidWorkflowApiErrorMessage(error);
      setStatusMessage(message);
      toast({ title: "Selection failed", description: message, variant: "destructive" });
    }
  };

  const evaluationEntries = useMemo(
    () => (evaluation ? Object.entries(evaluation).filter(([, value]) => value !== null && value !== undefined && value !== "") : []),
    [evaluation],
  );

  const requiresSequenceSetup = !selectedRfqId && workflowOptions.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bid Management"
        description="Submit, evaluate, monitor live bids, and finalize winner"
        actions={
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={!selectedRfqId || liveSnapshotQuery.isFetching}>
            {liveSnapshotQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Live
          </Button>
        }
      />

      {requiresSequenceSetup && (
        <div className="rounded-xl border bg-card p-5 card-shadow text-sm text-muted-foreground">
          Finance approval and RFQ publish should happen before bidding. Approve a request in Finance Review to receive an RFQ workflow,
          then return here.
        </div>
      )}

      <div className="rounded-xl border bg-card p-5 card-shadow space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={selectedRfqId ?? undefined} onValueChange={setSelectedRfqId}>
              <SelectTrigger className="sm:w-[320px]">
                <SelectValue placeholder="Select RFQ from finance/publish workflow" />
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
            RFQ status is not open. Submit and evaluate controls are disabled until finance approve, publish, and send flow is complete.
          </p>
        )}

        {isRfqClosed && (
          <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
            RFQ is closed. Bidding is locked. Selected vendor: {selectedVendorName || snapshot?.selected_vendor_id || "Not available"}.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="gap-2"
            onClick={handleSubmitBids}
            disabled={disableBidControls || isSubmitting || selectedVendorIds.length === 0}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Bid
          </Button>

          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleEvaluate}
            disabled={disableBidControls || isEvaluating}
          >
            {isEvaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Evaluate
          </Button>

          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleFinalizeWinner}
            disabled={disableBidControls || isSelecting || !winnerVendorId}
          >
            {isSelecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
            Finalize Winner
          </Button>
        </div>

        {statusMessage && (
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {liveSnapshotQuery.isLoading && selectedRfqId && (
            <div className="rounded-xl border bg-card p-5 card-shadow text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading live bid snapshot...
            </div>
          )}

          {liveSnapshotQuery.isError && selectedRfqId && (
            <div className="rounded-xl border border-destructive/30 bg-card p-5 card-shadow space-y-2">
              <p className="text-sm text-destructive">{getBidWorkflowApiErrorMessage(liveSnapshotQuery.error)}</p>
              <Button type="button" variant="outline" size="sm" onClick={handleRefresh}>Retry</Button>
            </div>
          )}

          {!liveSnapshotQuery.isLoading && !liveSnapshotQuery.isError && selectedRfqId && (
            <div className="rounded-xl border bg-card card-shadow overflow-hidden">
              {bids.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">No bid rows returned in data.bids.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Submit</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Compliance</TableHead>
                      <TableHead>Total Score</TableHead>
                      <TableHead>Winner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bids.map((bid, index) => {
                      const vendorId = bid.vendor_id;
                      const isSelectedForSubmit = vendorId ? selectedVendorIds.includes(vendorId) : false;
                      const isWinner = Boolean(vendorId) && (vendorId === winnerVendorId || vendorId === snapshot?.selected_vendor_id);
                      const isSelectable = Boolean(vendorId) && !isRfqClosed;

                      return (
                        <TableRow key={`${bid.bid_id || vendorId || "bid"}-${index}`} className={isWinner ? "bg-success/10" : ""}>
                          <TableCell>
                            {vendorId ? (
                              <Checkbox
                                checked={isSelectedForSubmit}
                                disabled={!isSelectable || disableBidControls}
                                onCheckedChange={(checked) => toggleVendorSelection(vendorId, checked === true)}
                                aria-label={`Select ${bid.vendor_name || vendorId} for bid submit`}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{bid.vendor_name || "Not available"}</TableCell>
                          <TableCell>{formatCurrency(bid.price)}</TableCell>
                          <TableCell>{bid.delivery_days !== null ? `${bid.delivery_days} days` : "Not available"}</TableCell>
                          <TableCell>{bid.compliance_score !== null ? `${bid.compliance_score}%` : "Not available"}</TableCell>
                          <TableCell>{bid.total_score !== null ? bid.total_score.toFixed(2) : "Not available"}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant={isWinner ? "default" : "outline"}
                              className="gap-2"
                              disabled={!isSelectable || disableBidControls}
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

          {evaluationEntries.length > 0 && (
            <div className="rounded-xl border bg-card p-5 card-shadow">
              <h3 className="text-sm font-semibold mb-3">Evaluation (data.evaluation)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {evaluationEntries.map(([key, value]) => (
                  <div key={key} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className="text-sm font-medium mt-1">{typeof value === "string" ? value : JSON.stringify(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <AiInsightPanel title="Bid AI Insights">
            <p className="text-xs">
              AI insight records are read from data.ai_insights[vendor_id] with strengths, risks, and recommendation.
            </p>
          </AiInsightPanel>

          <div className="space-y-3">
            {bids.length === 0 && (
              <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                No vendors available for AI insight rendering.
              </div>
            )}

            {bids.map((bid, index) => {
              const vendorId = bid.vendor_id;
              const insight = vendorId ? aiInsights[vendorId] : null;

              return (
                <div key={`${bid.vendor_name || "insight"}-${index}`} className="rounded-xl border bg-card p-4 card-shadow">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{bid.vendor_name || "Unknown Vendor"}</p>
                    <Badge className={recommendationClasses(insight?.recommendation || null)}>
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
          <h3 className="text-sm font-semibold text-success">Bidding Locked</h3>
          <p className="text-sm mt-1 text-muted-foreground">
            RFQ is closed and ranking actions are frozen. Selected vendor: {selectedVendorName || "Not available"}.
          </p>
        </div>
      )}
    </div>
  );
}
