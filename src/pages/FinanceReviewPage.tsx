import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import {
  useFinanceApprovePurchaseRequestMutation,
  usePurchaseRequestList,
  useUpdatePurchaseRequestMutation,
} from "@/hooks/use-purchase-requests";
import { useRfqDistributionHistory, useRfqRecommendedVendors } from "@/hooks/use-rfq-workflow";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, DollarSign, Loader2, Link2, Send, Rocket, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { bidWorkflowQueryKeys } from "@/lib/bid-workflow-api";
import { getApiErrorMessage } from "@/lib/purchase-request-api";
import {
  getRfqWorkflowApiErrorMessage,
  isRfqOpenStatus,
  publishRfq,
  sendRfqToVendors,
  toRfqStatusLabel,
  type RfqWorkflow,
} from "@/lib/rfq-workflow-api";
import { upsertRfqWorkflowCache } from "@/lib/rfq-workflow-cache";

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

function yesNo(value: boolean | null) {
  if (value === null) {
    return "Not available";
  }

  return value ? "Yes" : "No";
}

function resolveActionType(actionLabel: string) {
  const normalized = actionLabel.trim().toLowerCase();

  if (normalized === "review") {
    return "review" as const;
  }

  if (normalized === "publish") {
    return "publish" as const;
  }

  if (normalized === "send to vendors" || normalized === "send_to_vendors" || normalized === "send") {
    return "send" as const;
  }

  return "unknown" as const;
}

interface RfqWorkflowPanelProps {
  requestId: string;
  workflow: RfqWorkflow;
  onWorkflowUpdate: (requestId: string, workflow: RfqWorkflow) => void;
}

function RfqWorkflowPanel({ requestId, workflow, onWorkflowUpdate }: RfqWorkflowPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("recommended-vendors");
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [workingWorkflow, setWorkingWorkflow] = useState<RfqWorkflow>(workflow);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [publishLifecycleDetails, setPublishLifecycleDetails] = useState<Array<{ label: string; value: string }>>([]);
  const [sendResultRows, setSendResultRows] = useState<
    Array<{ vendor_name: string | null; email: string | null; email_status: string | null; portal_notification: string | null }>
  >([]);

  const recommendedVendorsQuery = useRfqRecommendedVendors(workingWorkflow.rfq_id);
  const distributionHistoryQuery = useRfqDistributionHistory(workingWorkflow.rfq_id);

  useEffect(() => {
    setWorkingWorkflow(workflow);
  }, [workflow]);

  useEffect(() => {
    if (selectedVendorIds.length > 0) {
      return;
    }

    const preselected = (recommendedVendorsQuery.data ?? [])
      .filter((vendor) => vendor.active_vendor === true && typeof vendor.vendor_id === "string")
      .map((vendor) => vendor.vendor_id as string);

    if (preselected.length > 0) {
      setSelectedVendorIds(preselected);
    }
  }, [recommendedVendorsQuery.data, selectedVendorIds.length]);

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

  const handlePublish = async () => {
    setIsPublishing(true);
    setActionFeedback(null);

    try {
      const result = await publishRfq(workingWorkflow.rfq_id, workingWorkflow);
      setPublishLifecycleDetails(result.lifecycle_details);

      const nextWorkflow: RfqWorkflow = {
        ...workingWorkflow,
        rfq_id: result.rfq_id || workingWorkflow.rfq_id,
        rfq_number: result.rfq_number || workingWorkflow.rfq_number,
        status: result.status || (result.already_published ? "open" : workingWorkflow.status),
        public_link: result.public_link || workingWorkflow.public_link,
        actions_available: result.actions_available.length > 0 ? result.actions_available : workingWorkflow.actions_available,
      };

      setWorkingWorkflow(nextWorkflow);
      onWorkflowUpdate(requestId, nextWorkflow);
      queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.live(nextWorkflow.rfq_id) });
      queryClient.refetchQueries({ queryKey: bidWorkflowQueryKeys.live(nextWorkflow.rfq_id), type: "active" });

      const feedback = result.already_published
        ? "Already published. Reusing the existing RFQ state."
        : "RFQ published successfully. Status transitioned to Open for Bidding.";

      setActionFeedback(feedback);
      toast({
        title: result.already_published ? "Already published" : "RFQ published",
        description: feedback,
      });
    } catch (error) {
      toast({
        title: "Publish failed",
        description: getRfqWorkflowApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSend = async () => {
    setActionFeedback(null);

    if (!isRfqOpenStatus(workingWorkflow.status)) {
      setActionFeedback("Send to Vendors is enabled only when RFQ status is open.");
      return;
    }

    if (selectedVendorIds.length === 0) {
      setActionFeedback("Select at least one vendor before sending.");
      return;
    }

    setIsSending(true);

    try {
      const result = await sendRfqToVendors(workingWorkflow.rfq_id, selectedVendorIds);
      const nextWorkflow: RfqWorkflow = {
        ...workingWorkflow,
        status: result.status || workingWorkflow.status,
      };

      setWorkingWorkflow(nextWorkflow);
      onWorkflowUpdate(requestId, nextWorkflow);
      queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.live(nextWorkflow.rfq_id) });
      queryClient.refetchQueries({ queryKey: bidWorkflowQueryKeys.live(nextWorkflow.rfq_id), type: "active" });

      const distributionRows = result.distribution_statuses.map((item) => ({
        vendor_name: item.vendor_name,
        email: item.email,
        email_status: item.email_status,
        portal_notification: item.portal_notification,
      }));

      setSendResultRows(distributionRows);
      setActionFeedback("RFQ sent to selected vendors.");
      toast({ title: "RFQ sent", description: "Distribution statuses updated." });
      distributionHistoryQuery.refetch();
    } catch (error) {
      toast({
        title: "Send failed",
        description: getRfqWorkflowApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleReview = () => {
    setActiveTab("recommended-vendors");
    setActionFeedback("Review action selected. Validate shortlist before publishing.");
  };

  return (
    <div className="mt-4 rounded-xl border border-ai/30 bg-ai-surface p-4 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">RFQ Draft Actions</p>
          <p className="text-xs text-muted-foreground">
            rfq_id: {workingWorkflow.rfq_id} · rfq_number: {workingWorkflow.rfq_number || "Not available"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={workingWorkflow.status || "draft"} />
          <Badge variant="outline" className="text-xs">{toRfqStatusLabel(workingWorkflow.status)}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">State machine</p>
          <p className="text-sm font-medium mt-1">Draft -&gt; Open for Bidding</p>
          <p className="text-xs text-muted-foreground mt-1">Current lifecycle stage: {toRfqStatusLabel(workingWorkflow.status)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">public_link</p>
          {workingWorkflow.public_link ? (
            <a
              href={workingWorkflow.public_link}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary inline-flex items-center gap-1 mt-1"
            >
              <Link2 className="h-3.5 w-3.5" />
              {workingWorkflow.public_link}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Not published yet.</p>
          )}
        </div>
      </div>

      {publishLifecycleDetails.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground mb-2">Publish lifecycle transition details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {publishLifecycleDetails.map((detail) => (
              <div key={`${detail.label}-${detail.value}`} className="text-xs">
                <span className="text-muted-foreground">{detail.label}:</span>{" "}
                <span className="font-medium">{detail.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">actions_available</p>
        <div className="flex flex-wrap gap-2">
          {workingWorkflow.actions_available.length > 0 ? (
            workingWorkflow.actions_available.map((actionLabel) => {
              const actionType = resolveActionType(actionLabel);

              const isLoading = (actionType === "publish" && isPublishing) || (actionType === "send" && isSending);
              const isDisabled =
                actionType === "publish"
                  ? isPublishing
                  : actionType === "send"
                    ? isSending || !isRfqOpenStatus(workingWorkflow.status) || selectedVendorIds.length === 0
                    : actionType === "unknown";

              const icon =
                actionType === "review"
                  ? <Eye className="h-4 w-4" />
                  : actionType === "publish"
                    ? <Rocket className="h-4 w-4" />
                    : <Send className="h-4 w-4" />;

              const handleClick = () => {
                if (actionType === "review") {
                  handleReview();
                  return;
                }

                if (actionType === "publish") {
                  handlePublish();
                  return;
                }

                if (actionType === "send") {
                  handleSend();
                }
              };

              return (
                <Button
                  key={actionLabel}
                  type="button"
                  size="sm"
                  variant={actionType === "unknown" ? "outline" : "default"}
                  className="gap-2"
                  onClick={handleClick}
                  disabled={isDisabled}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
                  {actionLabel}
                </Button>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No actions available from backend for this RFQ workflow.</p>
          )}
        </div>
        {!isRfqOpenStatus(workingWorkflow.status) && (
          <p className="text-xs text-warning">Send to Vendors is enabled only when RFQ status is open.</p>
        )}
      </div>

      {actionFeedback && (
        <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">{actionFeedback}</div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recommended-vendors">Vendor Shortlist</TabsTrigger>
          <TabsTrigger value="distribution-history">Distribution History</TabsTrigger>
        </TabsList>

        <TabsContent value="recommended-vendors" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Selected vendor_ids: {selectedVendorIds.length}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={isSending || !isRfqOpenStatus(workingWorkflow.status) || selectedVendorIds.length === 0}
              onClick={handleSend}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to Vendors
            </Button>
          </div>

          {recommendedVendorsQuery.isLoading && (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading recommended vendors...
            </div>
          )}

          {recommendedVendorsQuery.isError && (
            <div className="rounded-lg border border-destructive/30 bg-card p-4 space-y-2">
              <p className="text-sm text-destructive">{getRfqWorkflowApiErrorMessage(recommendedVendorsQuery.error)}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => recommendedVendorsQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}

          {!recommendedVendorsQuery.isLoading && !recommendedVendorsQuery.isError && (
            <div className="rounded-xl border bg-card overflow-hidden">
              {recommendedVendorsQuery.data && recommendedVendorsQuery.data.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Select</TableHead>
                      <TableHead>vendor_name</TableHead>
                      <TableHead>performance_score</TableHead>
                      <TableHead>past_orders_count</TableHead>
                      <TableHead>preferred_tag</TableHead>
                      <TableHead>active_vendor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recommendedVendorsQuery.data.map((vendor, index) => {
                      const selectableVendorId = typeof vendor.vendor_id === "string" ? vendor.vendor_id : null;
                      const isChecked = selectableVendorId ? selectedVendorIds.includes(selectableVendorId) : false;

                      return (
                        <TableRow key={`${vendor.vendor_name || "vendor"}-${selectableVendorId || index}`}>
                          <TableCell>
                            {selectableVendorId ? (
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => toggleVendorSelection(selectableVendorId, checked === true)}
                                aria-label={`Select vendor ${vendor.vendor_name || selectableVendorId}`}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{vendor.vendor_name || "Not available"}</TableCell>
                          <TableCell>{vendor.performance_score ?? "Not available"}</TableCell>
                          <TableCell>{vendor.past_orders_count ?? "Not available"}</TableCell>
                          <TableCell>{yesNo(vendor.preferred_tag)}</TableCell>
                          <TableCell>{yesNo(vendor.active_vendor)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 text-sm text-muted-foreground">No recommended vendors returned by backend.</div>
              )}
            </div>
          )}

          {sendResultRows.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="p-4 border-b">
                <h4 className="text-sm font-semibold">Latest distribution statuses</h4>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>vendor_name</TableHead>
                    <TableHead>email</TableHead>
                    <TableHead>email_status</TableHead>
                    <TableHead>portal_notification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sendResultRows.map((row, index) => (
                    <TableRow key={`${row.vendor_name || "vendor"}-${index}`}>
                      <TableCell className="font-medium">{row.vendor_name || "Not available"}</TableCell>
                      <TableCell>{row.email || "Not available"}</TableCell>
                      <TableCell>{row.email_status || "Not available"}</TableCell>
                      <TableCell>{row.portal_notification || "Not available"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="distribution-history">
          {distributionHistoryQuery.isLoading && (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading distribution history...
            </div>
          )}

          {distributionHistoryQuery.isError && (
            <div className="rounded-lg border border-destructive/30 bg-card p-4 space-y-2">
              <p className="text-sm text-destructive">{getRfqWorkflowApiErrorMessage(distributionHistoryQuery.error)}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => distributionHistoryQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}

          {!distributionHistoryQuery.isLoading && !distributionHistoryQuery.isError && (
            <div className="rounded-xl border bg-card overflow-hidden">
              {distributionHistoryQuery.data && distributionHistoryQuery.data.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>vendor_name</TableHead>
                      <TableHead>email</TableHead>
                      <TableHead>email_status</TableHead>
                      <TableHead>portal_notification</TableHead>
                      <TableHead>sent_at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distributionHistoryQuery.data.map((item, index) => (
                      <TableRow key={`${item.vendor_name || "distribution"}-${index}`}>
                        <TableCell className="font-medium">{item.vendor_name || "Not available"}</TableCell>
                        <TableCell>{item.email || "Not available"}</TableCell>
                        <TableCell>{item.email_status || "Not available"}</TableCell>
                        <TableCell>{item.portal_notification || "Not available"}</TableCell>
                        <TableCell>{formatDateTime(item.sent_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 text-sm text-muted-foreground">No distribution history records available for this RFQ.</div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function FinanceReviewPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const listQuery = usePurchaseRequestList({ skip: 0, limit: 50 });
  const financeApproveMutation = useFinanceApprovePurchaseRequestMutation();
  const updateRequestMutation = useUpdatePurchaseRequestMutation();
  const [workflowByRequestId, setWorkflowByRequestId] = useState<Record<string, RfqWorkflow>>({});

  const purchaseRequests = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);

  const financeData = useMemo(
    () =>
      purchaseRequests.filter(
        (request) => request.status === "pending" || request.status === "active" || Boolean(workflowByRequestId[request.id]),
      ),
    [purchaseRequests, workflowByRequestId],
  );

  const handleAction = async (id: string, expectedDeliveryDate: string, action: "approve" | "reject") => {
    try {
      if (action === "approve") {
        const response = await financeApproveMutation.mutateAsync({
          prId: id,
          expectedDeliveryDate,
        });

        if (response.data.rfq_workflow?.rfq_id) {
          const workflow = response.data.rfq_workflow;
          setWorkflowByRequestId((prev) => ({
            ...prev,
            [id]: workflow,
          }));
          upsertRfqWorkflowCache({
            rfq_id: workflow.rfq_id,
            rfq_number: workflow.rfq_number,
            status: workflow.status,
            actions_available: workflow.actions_available,
            public_link: workflow.public_link,
          });
          queryClient.invalidateQueries({ queryKey: bidWorkflowQueryKeys.live(workflow.rfq_id) });
          queryClient.refetchQueries({ queryKey: bidWorkflowQueryKeys.live(workflow.rfq_id), type: "active" });

          toast({
            title: "Request approved",
            description: `RFQ workflow loaded: ${workflow.rfq_number || workflow.rfq_id}`,
          });
        } else {
          toast({
            title: "Request approved",
            description: `${response.message}. RFQ workflow data was not returned by backend.`,
          });
        }

        return;
      }

      const response = await updateRequestMutation.mutateAsync({
        prId: id,
        payload: {
          status: "rejected",
          expected_delivery_date: expectedDeliveryDate,
        },
      });

      toast({
        title: "Request rejected",
        description: response.message,
      });
    } catch (error) {
      toast({
        title: action === "approve" ? "Could not approve request" : "Could not reject request",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Finance Review" description="Review and approve procurement budgets" />

      {listQuery.isLoading && (
        <div className="rounded-xl border bg-card p-5 card-shadow text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading finance review queue...
        </div>
      )}

      {listQuery.isError && (
        <div className="rounded-xl border border-destructive/30 bg-card p-5 card-shadow space-y-3">
          <p className="text-sm text-destructive">{getApiErrorMessage(listQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => listQuery.refetch()}>Retry</Button>
        </div>
      )}

      {!listQuery.isLoading && !listQuery.isError && (
        <div className="grid gap-4">
          {financeData.map((request) => {
            const aiStatus = typeof request.ai_status === "string" ? request.ai_status : "pending";
            const missingFields = Array.isArray(request.missing_fields) ? request.missing_fields : [];
            const budgetFeedback = request.budget_feedback || "No budget feedback available.";
            const riskFlags: string[] = [];
            if (aiStatus === "needs_review") {
              riskFlags.push("AI flagged for review");
            }

            if (missingFields.length > 0) {
              riskFlags.push(`Missing fields: ${missingFields.join(", ")}`);
            }

            if (request.status === "active") {
              riskFlags.push("Already in active review");
            }

            const isApprovingCurrent = financeApproveMutation.isPending && financeApproveMutation.variables?.prId === request.id;
            const isRejectingCurrent = updateRequestMutation.isPending && updateRequestMutation.variables?.prId === request.id;
            const isUpdatingCurrent = isApprovingCurrent || isRejectingCurrent;
            const workflow = workflowByRequestId[request.id];

            return (
              <div key={request.id} className="rounded-xl border bg-card p-5 card-shadow">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{request.pr_number} - {request.item_name}</h3>
                        <p className="text-sm text-muted-foreground">{request.description}</p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="flex items-center gap-1"><DollarSign className="h-4 w-4 text-muted-foreground" /> ${request.budget.toLocaleString()}</span>
                      <span className={aiStatus === "valid" ? "text-success" : "text-warning"}>
                        {aiStatus === "valid" ? <CheckCircle className="h-4 w-4 inline mr-1" /> : <AlertTriangle className="h-4 w-4 inline mr-1" />}
                        AI status: <StatusBadge className="ml-1" status={aiStatus} />
                      </span>
                    </div>

                    {riskFlags.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {riskFlags.map((flag, index) => (
                          <span key={index} className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full w-fit">{flag}</span>
                        ))}
                      </div>
                    )}

                    <AiInsightPanel title="AI Analysis" className="text-xs">
                      <p>{budgetFeedback}</p>
                    </AiInsightPanel>
                  </div>

                  <div className="flex lg:flex-col gap-2 lg:justify-center">
                    <Button
                      onClick={() => handleAction(request.id, request.expected_delivery_date, "approve")}
                      className="gap-2 bg-success hover:bg-success/90"
                      disabled={isUpdatingCurrent}
                    >
                      {isApprovingCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAction(request.id, request.expected_delivery_date, "reject")}
                      className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={isUpdatingCurrent}
                    >
                      {isRejectingCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Reject
                    </Button>
                  </div>
                </div>

                {workflow && (
                  <RfqWorkflowPanel
                    requestId={request.id}
                    workflow={workflow}
                    onWorkflowUpdate={(requestId, nextWorkflow) => {
                      setWorkflowByRequestId((prev) => ({
                        ...prev,
                        [requestId]: nextWorkflow,
                      }));
                      upsertRfqWorkflowCache({
                        rfq_id: nextWorkflow.rfq_id,
                        rfq_number: nextWorkflow.rfq_number,
                        status: nextWorkflow.status,
                        actions_available: nextWorkflow.actions_available,
                        public_link: nextWorkflow.public_link,
                      });
                    }}
                  />
                )}
              </div>
            );
          })}

          {financeData.length === 0 && (
            <div className="rounded-xl border bg-card p-5 card-shadow text-sm text-muted-foreground">
              No purchase requests are currently pending finance review.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
