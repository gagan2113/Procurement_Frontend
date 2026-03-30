import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { procurementRequests } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const financeData = procurementRequests.filter(r => r.status === "Pending" || r.status === "In Review").map(r => ({
  ...r,
  budgetCheck: r.budget <= 50000 ? "Within Limit" : "Exceeds Threshold",
  riskFlags: r.budget > 100000 ? ["High value", "Requires VP approval"] : r.budget > 50000 ? ["Above threshold"] : [],
  aiExplanation: r.budget > 100000
    ? "This request exceeds the quarterly threshold. Historical data shows similar requests require 2-level approval."
    : r.budget > 50000
    ? "Budget is above standard limits but within category norms. Recommend conditional approval."
    : "Request is within normal parameters. No issues detected.",
}));

export default function FinanceReviewPage() {
  const { toast } = useToast();

  const handleAction = (id: string, action: "approve" | "reject") => {
    toast({
      title: action === "approve" ? "Request Approved" : "Request Rejected",
      description: `${id} has been ${action === "approve" ? "approved" : "rejected"} by finance.`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Finance Review" description="Review and approve procurement budgets" />

      <div className="grid gap-4">
        {financeData.map(r => (
          <div key={r.id} className="rounded-xl border bg-card p-5 card-shadow">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{r.id} — {r.item}</h3>
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1"><DollarSign className="h-4 w-4 text-muted-foreground" /> ${r.budget.toLocaleString()}</span>
                  <span className={r.budgetCheck === "Within Limit" ? "text-success" : "text-warning"}>
                    {r.budgetCheck === "Within Limit" ? <CheckCircle className="h-4 w-4 inline mr-1" /> : <AlertTriangle className="h-4 w-4 inline mr-1" />}
                    {r.budgetCheck}
                  </span>
                </div>
                {r.riskFlags.length > 0 && (
                  <div className="flex gap-2">
                    {r.riskFlags.map((f, i) => (
                      <span key={i} className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                )}
                <AiInsightPanel title="AI Analysis" className="text-xs">
                  <p>{r.aiExplanation}</p>
                </AiInsightPanel>
              </div>
              <div className="flex lg:flex-col gap-2 lg:justify-center">
                <Button onClick={() => handleAction(r.id, "approve")} className="gap-2 bg-success hover:bg-success/90"><CheckCircle className="h-4 w-4" />Approve</Button>
                <Button variant="outline" onClick={() => handleAction(r.id, "reject")} className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"><XCircle className="h-4 w-4" />Reject</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
