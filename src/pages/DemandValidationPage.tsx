import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { procurementRequests } from "@/lib/mock-data";
import { CheckCircle, AlertTriangle, PackageSearch, XCircle } from "lucide-react";

const validationResults = [
  { requestId: "PR-002", item: "Office Chairs", inventoryAvailable: false, duplicate: false, status: "Valid" as const },
  { requestId: "PR-003", item: "Cloud Server Credits", inventoryAvailable: false, duplicate: true, status: "Needs Review" as const },
  { requestId: "PR-006", item: "Standing Desks", inventoryAvailable: true, duplicate: false, status: "Needs Review" as const },
  { requestId: "PR-007", item: "Software Licenses", inventoryAvailable: false, duplicate: false, status: "Valid" as const },
];

export default function DemandValidationPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Demand Validation" description="AI-powered validation of procurement requests" />

      <AiInsightPanel title="Validation Summary">
        <p>{validationResults.filter(v => v.status === "Valid").length} of {validationResults.length} requests passed validation. Review flagged items below.</p>
      </AiInsightPanel>

      <div className="grid gap-4">
        {validationResults.map(v => (
          <div key={v.requestId} className="rounded-xl border bg-card p-5 card-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {v.status === "Valid" ? (
                  <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{v.requestId} — {v.item}</p>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs flex items-center gap-1">
                      <PackageSearch className="h-3 w-3" />
                      Inventory: {v.inventoryAvailable ? <span className="text-warning">Available in stock</span> : <span className="text-success">Not in stock — proceed</span>}
                    </span>
                    <span className="text-xs flex items-center gap-1">
                      {v.duplicate ? <><XCircle className="h-3 w-3 text-destructive" /><span className="text-destructive">Duplicate detected</span></> : <><CheckCircle className="h-3 w-3 text-success" /><span className="text-success">No duplicates</span></>}
                    </span>
                  </div>
                </div>
              </div>
              <StatusBadge status={v.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
