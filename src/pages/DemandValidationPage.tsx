import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { usePurchaseRequestList } from "@/hooks/use-purchase-requests";
import { getApiErrorMessage } from "@/lib/purchase-request-api";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function getAiStatusLabel(status: string) {
  if (status === "needs_review") {
    return "Needs Review";
  }

  if (status === "pending") {
    return "Pending";
  }

  return "Valid";
}

export default function DemandValidationPage() {
  const listQuery = usePurchaseRequestList({ skip: 0, limit: 50 });
  const requests = listQuery.data?.items ?? [];
  const validCount = requests.filter((request) => request.ai_status === "valid").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Demand Validation" description="AI-powered validation of procurement requests" />

      <AiInsightPanel title="Validation Summary">
        <p>{validCount} of {requests.length} requests passed AI validation. Review flagged items below.</p>
      </AiInsightPanel>

      {listQuery.isLoading && (
        <div className="rounded-xl border bg-card p-5 card-shadow text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading validation queue...
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
          {requests.map((request) => (
            <div key={request.id} className="rounded-xl border bg-card p-5 card-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {request.ai_status === "valid" ? (
                    <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{request.pr_number} - {request.item_name}</p>
                    <div className="space-y-1 mt-1 text-xs">
                      <p>
                        <span className="text-muted-foreground">Missing fields:</span>{" "}
                        {request.missing_fields.length > 0 ? request.missing_fields.join(", ") : "None"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Budget feedback:</span> {request.budget_feedback}
                      </p>
                    </div>
                  </div>
                </div>
                <StatusBadge status={request.ai_status} className="min-w-[110px] justify-center" />
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                AI decision: {getAiStatusLabel(request.ai_status)}
              </div>
            </div>
          ))}

          {requests.length === 0 && (
            <div className="rounded-xl border bg-card p-5 card-shadow text-sm text-muted-foreground">
              No purchase requests found for validation.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
