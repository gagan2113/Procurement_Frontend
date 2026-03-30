import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { invoices } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function InvoicesPage() {
  const [selectedInvoice, setSelectedInvoice] = useState<typeof invoices[0] | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Processing"
        description="Process invoices and verify 3-way matching"
        actions={<Button variant="outline" className="gap-2"><Upload className="h-4 w-4" />Upload Invoice</Button>}
      />

      <div className="grid gap-4">
        {invoices.map(inv => (
          <div key={inv.id} className="rounded-xl border bg-card p-5 card-shadow cursor-pointer hover:card-shadow-hover transition-shadow" onClick={() => setSelectedInvoice(inv)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">{inv.id}</h3>
                  <p className="text-sm text-muted-foreground">{inv.vendorName} · ${inv.amount.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={inv.status} />
              </div>
            </div>

            {/* 3-way match */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: "PO Match", match: inv.poMatch },
                { label: "Invoice Verified", match: true },
                { label: "Receipt Match", match: inv.receiptMatch },
              ].map(m => (
                <div key={m.label} className={cn("rounded-lg p-3 text-center text-xs", m.match ? "bg-success/10" : "bg-destructive/10")}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {m.match ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                  </div>
                  <span className={m.match ? "text-success font-medium" : "text-destructive font-medium"}>{m.label}</span>
                </div>
              ))}
            </div>

            {(!inv.poMatch || !inv.receiptMatch) && (
              <div className="flex items-center gap-2 mt-3 text-xs text-destructive bg-destructive/5 p-2 rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5" />
                Mismatch detected — review required before payment
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
