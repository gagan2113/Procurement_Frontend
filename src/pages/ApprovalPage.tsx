import { PageHeader } from "@/components/shared/PageHeader";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, BarChart3, Users, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const approvalItem = {
  vendor: "TechWorld Supplies",
  item: "Dell Latitude 5540",
  quantity: 50,
  totalCost: 72000,
  aiRecommendation: "Approve",
  confidence: 94,
  comparison: [
    { vendor: "TechWorld Supplies", price: 72000, delivery: "14 days", compliance: 96, recommended: true },
    { vendor: "CloudFirst Inc.", price: 78000, delivery: "10 days", compliance: 92, recommended: false },
  ],
};

export default function ApprovalPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Final Approval" description="Human-in-the-loop decision for vendor selection" />

      <AiInsightPanel title="AI Recommendation" className="text-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-success">Recommend: {approvalItem.aiRecommendation}</span>
          <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">{approvalItem.confidence}% confidence</span>
        </div>
        <p>{approvalItem.vendor} offers the best value for {approvalItem.item} procurement with strong compliance and competitive pricing.</p>
      </AiInsightPanel>

      <div className="rounded-xl border bg-card p-5 card-shadow">
        <h3 className="font-semibold mb-4">Vendor Comparison</h3>
        <div className="grid gap-3">
          {approvalItem.comparison.map(c => (
            <div key={c.vendor} className={`rounded-lg border p-4 ${c.recommended ? "ring-1 ring-success/30 bg-success/5" : ""}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{c.vendor}</h4>
                {c.recommended && <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">Recommended</span>}
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                <div className="flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-muted-foreground" />${c.price.toLocaleString()}</div>
                <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-muted-foreground" />{c.delivery}</div>
                <div className="flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-muted-foreground" />{c.compliance}% compliance</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button className="gap-2 flex-1 bg-success hover:bg-success/90" onClick={() => toast({ title: "Vendor Approved", description: `${approvalItem.vendor} has been approved.` })}>
          <CheckCircle className="h-4 w-4" />Approve Vendor
        </Button>
        <Button variant="outline" className="gap-2 flex-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => toast({ title: "Vendor Rejected", description: "Selection sent back for review." })}>
          <XCircle className="h-4 w-4" />Reject
        </Button>
      </div>
    </div>
  );
}
