import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { usePurchaseRequestList, useUpdatePurchaseRequestMutation } from "@/hooks/use-purchase-requests";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle, DollarSign, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/purchase-request-api";

export default function FinanceReviewPage() {
  const { toast } = useToast();
  const listQuery = usePurchaseRequestList({ skip: 0, limit: 50 });
  const updateRequestMutation = useUpdatePurchaseRequestMutation();
  const financeData = (listQuery.data?.items ?? []).filter((request) => request.status === "pending" || request.status === "active");

  const handleAction = async (id: string, action: "approve" | "reject") => {
    const targetStatus = action === "approve" ? "approved" : "rejected";

    try {
      const response = await updateRequestMutation.mutateAsync({
        prId: id,
        payload: { status: targetStatus },
      });

      toast({
        title: action === "approve" ? "Request approved" : "Request rejected",
        description: response.message,
      });
    } catch (error) {
      toast({
        title: "Could not update request",
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
            const riskFlags: string[] = [];
            if (request.ai_status === "needs_review") {
              riskFlags.push("AI flagged for review");
            }

            if (request.missing_fields.length > 0) {
              riskFlags.push(`Missing fields: ${request.missing_fields.join(", ")}`);
            }

            if (request.status === "active") {
              riskFlags.push("Already in active review");
            }

            const isUpdatingCurrent = updateRequestMutation.isPending && updateRequestMutation.variables?.prId === request.id;

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
                      <span className={request.ai_status === "valid" ? "text-success" : "text-warning"}>
                        {request.ai_status === "valid" ? <CheckCircle className="h-4 w-4 inline mr-1" /> : <AlertTriangle className="h-4 w-4 inline mr-1" />}
                        AI status: <StatusBadge className="ml-1" status={request.ai_status} />
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
                      <p>{request.budget_feedback}</p>
                    </AiInsightPanel>
                  </div>

                  <div className="flex lg:flex-col gap-2 lg:justify-center">
                    <Button
                      onClick={() => handleAction(request.id, "approve")}
                      className="gap-2 bg-success hover:bg-success/90"
                      disabled={isUpdatingCurrent}
                    >
                      {isUpdatingCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAction(request.id, "reject")}
                      className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={isUpdatingCurrent}
                    >
                      {isUpdatingCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Reject
                    </Button>
                  </div>
                </div>
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
