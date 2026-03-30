import { PageHeader } from "@/components/shared/PageHeader";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { Button } from "@/components/ui/button";
import { bids, vendors } from "@/lib/mock-data";
import { Send, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const rankedVendors = bids.map(b => {
  const v = vendors.find(v => v.id === b.vendorId);
  const maxPrice = Math.max(...bids.map(x => x.price));
  const priceScore = ((1 - b.price / maxPrice) * 100);
  const performanceScore = v?.performanceScore || 0;
  const riskScore = b.complianceScore;
  const totalScore = priceScore * 0.35 + performanceScore * 0.35 + riskScore * 0.3;
  return { ...b, vendor: v, priceScore, performanceScore, riskScore, totalScore };
}).sort((a, b) => b.totalScore - a.totalScore);

export default function ShortlistingPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <PageHeader title="Vendor Shortlisting" description="AI-ranked vendors based on composite scoring" />

      <div className="grid gap-4">
        {rankedVendors.map((v, idx) => (
          <div key={v.id} className="rounded-xl border bg-card p-5 card-shadow">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                  {idx === 0 ? <Trophy className="h-5 w-5" /> : `#${idx + 1}`}
                </div>
                <div>
                  <h3 className="font-semibold">{v.vendorName}</h3>
                  <p className="text-xs text-muted-foreground">Total Score: {v.totalScore.toFixed(1)}</p>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-3 gap-4">
                {[
                  { label: "Price", score: v.priceScore, color: "bg-primary" },
                  { label: "Performance", score: v.performanceScore, color: "bg-success" },
                  { label: "Risk/Compliance", score: v.riskScore, color: "bg-warning" },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-medium">{s.score.toFixed(0)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <Button
                size="sm"
                className="gap-2 shrink-0"
                onClick={() => toast({ title: "Sent for Approval", description: `${v.vendorName} shortlist sent for final review.` })}
              >
                <Send className="h-4 w-4" />Send for Approval
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AiInsightPanel title="Shortlisting Rationale">
        <p>Rankings are based on a weighted composite: Price (35%), Past Performance (35%), and Compliance/Risk (30%). {rankedVendors[0]?.vendorName} leads due to competitive pricing and strong track record.</p>
      </AiInsightPanel>
    </div>
  );
}
