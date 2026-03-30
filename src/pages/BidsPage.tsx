import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { bids } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

export default function BidsPage() {
  const [normalized, setNormalized] = useState(false);

  const maxPrice = Math.max(...bids.map(b => b.price));
  const minDelivery = Math.min(...bids.map(b => b.deliveryDays));

  const bestBid = bids.reduce((best, b) =>
    (b.complianceScore * 0.4 + (1 - b.price / maxPrice) * 100 * 0.35 + (1 - b.deliveryDays / 30) * 100 * 0.25) >
    (best.complianceScore * 0.4 + (1 - best.price / maxPrice) * 100 * 0.35 + (1 - best.deliveryDays / 30) * 100 * 0.25) ? b : best
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Bid Management" description="Compare and analyze vendor bids" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Switch id="normalize" checked={normalized} onCheckedChange={setNormalized} />
            <Label htmlFor="normalize" className="text-sm">Normalized View</Label>
          </div>

          <div className="rounded-xl border bg-card card-shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>{normalized ? "Price Score" : "Price"}</TableHead>
                  <TableHead>{normalized ? "Delivery Score" : "Delivery"}</TableHead>
                  <TableHead>Compliance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids.map(b => (
                  <TableRow key={b.id} className={b.id === bestBid.id ? "bg-success/5" : ""}>
                    <TableCell className="font-medium">
                      {b.vendorName}
                      {b.id === bestBid.id && <span className="ml-2 text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">Best</span>}
                    </TableCell>
                    <TableCell>{normalized ? `${((1 - b.price / maxPrice) * 100).toFixed(0)}/100` : `$${b.price.toLocaleString()}`}</TableCell>
                    <TableCell>{normalized ? `${((1 - b.deliveryDays / 30) * 100).toFixed(0)}/100` : `${b.deliveryDays} days`}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${b.complianceScore}%` }} />
                        </div>
                        <span className="text-xs">{b.complianceScore}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-4">
          <AiInsightPanel title="AI Recommendation">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="font-medium text-sm">Best Value: {bestBid.vendorName}</span>
              </div>
              <p className="text-xs">Highest weighted score combining price competitiveness ({((1 - bestBid.price / maxPrice) * 100).toFixed(0)}%), delivery speed ({bestBid.deliveryDays} days), and compliance ({bestBid.complianceScore}%).</p>
              <div className="pt-2 border-t border-ai/10 space-y-1">
                <div className="flex items-center gap-1 text-xs"><CheckCircle className="h-3 w-3 text-success" /> Strong compliance record</div>
                <div className="flex items-center gap-1 text-xs"><CheckCircle className="h-3 w-3 text-success" /> Competitive pricing</div>
                <div className="flex items-center gap-1 text-xs"><AlertTriangle className="h-3 w-3 text-warning" /> Verify capacity for volume</div>
              </div>
            </div>
          </AiInsightPanel>
        </div>
      </div>
    </div>
  );
}
