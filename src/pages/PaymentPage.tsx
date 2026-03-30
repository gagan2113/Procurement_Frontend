import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { invoices } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { CheckCircle, PauseCircle, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const paymentInvoices = invoices.map(inv => ({
  ...inv,
  paymentStatus: inv.poMatch && inv.receiptMatch ? "Ready for Payment" as const : "Flagged" as const,
}));

export default function PaymentPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Approval" description="Approve payments for verified invoices" />

      <div className="grid gap-4">
        {paymentInvoices.map(inv => (
          <div key={inv.id} className="rounded-xl border bg-card p-5 card-shadow">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{inv.id} — {inv.vendorName}</h3>
                  <p className="text-sm text-muted-foreground">Amount: ${inv.amount.toLocaleString()} · PO: {inv.poId}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge status={inv.paymentStatus} />
                {inv.paymentStatus === "Ready for Payment" ? (
                  <Button size="sm" className="gap-2 bg-success hover:bg-success/90" onClick={() => toast({ title: "Payment Approved", description: `${inv.id} payment released.` })}>
                    <CheckCircle className="h-4 w-4" />Approve
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => toast({ title: "Payment Held", description: `${inv.id} placed on hold for review.` })}>
                    <PauseCircle className="h-4 w-4" />Hold
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
