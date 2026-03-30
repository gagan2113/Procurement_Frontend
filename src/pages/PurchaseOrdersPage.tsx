import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { purchaseOrders } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

export default function PurchaseOrdersPage() {
  const [selected, setSelected] = useState<typeof purchaseOrders[0] | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Orders" description="View and track all purchase orders" />

      <div className="rounded-xl border bg-card card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO ID</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="hidden md:table-cell">Total Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrders.map(po => (
              <TableRow key={po.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(po)}>
                <TableCell className="font-medium">{po.id}</TableCell>
                <TableCell>{po.vendorName}</TableCell>
                <TableCell className="hidden md:table-cell">${po.totalCost.toLocaleString()}</TableCell>
                <TableCell><StatusBadge status={po.status} /></TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{po.createdAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selected?.id} Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Vendor:</span> {selected.vendorName}</div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={selected.status} /></div>
                <div><span className="text-muted-foreground">Total:</span> ${selected.totalCost.toLocaleString()}</div>
                <div><span className="text-muted-foreground">Created:</span> {selected.createdAt}</div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Items</h4>
                {selected.items.map((item, i) => (
                  <div key={i} className="flex justify-between p-2 rounded bg-muted/50">
                    <span>{item.name}</span>
                    <span>{item.qty} × ${item.unitPrice.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
