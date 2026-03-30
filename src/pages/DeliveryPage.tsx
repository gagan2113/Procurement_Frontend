import { PageHeader } from "@/components/shared/PageHeader";
import { CheckCircle, Circle, Truck, Package, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const deliveries = [
  {
    poId: "PO-001", vendor: "TechWorld Supplies", item: "Dell Latitude 5540",
    stages: [
      { label: "Order Placed", date: "Mar 15", done: true },
      { label: "Confirmed", date: "Mar 16", done: true },
      { label: "Shipped", date: "Mar 20", done: true },
      { label: "Delivered", date: "Mar 25", done: true },
    ],
    alert: null,
  },
  {
    poId: "PO-002", vendor: "CloudFirst Inc.", item: "AWS Credits Package",
    stages: [
      { label: "Order Placed", date: "Mar 18", done: true },
      { label: "Confirmed", date: "Mar 19", done: true },
      { label: "Provisioned", date: "—", done: false },
      { label: "Active", date: "—", done: false },
    ],
    alert: null,
  },
  {
    poId: "PO-003", vendor: "PrintPro Solutions", item: "Product Brochures A4",
    stages: [
      { label: "Order Placed", date: "Mar 12", done: true },
      { label: "Production", date: "Mar 14", done: true },
      { label: "Shipped", date: "Mar 18", done: true },
      { label: "Delivered", date: "—", done: false },
    ],
    alert: "Delivery delayed by 3 days — carrier issue",
  },
];

export default function DeliveryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Delivery Tracking" description="Track order fulfillment and delivery status" />

      <div className="grid gap-4">
        {deliveries.map(d => (
          <div key={d.poId} className="rounded-xl border bg-card p-5 card-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">{d.poId} — {d.item}</h3>
                <p className="text-sm text-muted-foreground">{d.vendor}</p>
              </div>
              {d.alert && (
                <div className="flex items-center gap-1.5 text-xs bg-warning/10 text-warning px-3 py-1.5 rounded-full mt-2 sm:mt-0">
                  <AlertTriangle className="h-3.5 w-3.5" />{d.alert}
                </div>
              )}
            </div>

            <div className="flex items-center gap-0">
              {d.stages.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center relative">
                  {/* Connector line */}
                  {i > 0 && (
                    <div className={cn("absolute top-4 right-1/2 w-full h-0.5", d.stages[i - 1].done ? "bg-success" : "bg-muted")} style={{ transform: "translateX(50%)", zIndex: 0 }} />
                  )}
                  <div className={cn("relative z-10 h-8 w-8 rounded-full flex items-center justify-center", s.done ? "bg-success" : "bg-muted")}>
                    {s.done ? <CheckCircle className="h-4 w-4 text-success-foreground" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <p className="text-xs font-medium mt-2 text-center">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{s.date}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
