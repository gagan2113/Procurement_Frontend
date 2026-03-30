import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { procurementRequests } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function RequestsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<typeof procurementRequests[0] | null>(null);

  const filtered = procurementRequests.filter(r => {
    const matchSearch = r.item.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Requests" description="Manage all procurement requests" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by ID or item..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
            <SelectItem value="In Review">In Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request ID</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden md:table-cell">Budget</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                <TableCell className="font-medium">{r.id}</TableCell>
                <TableCell>{r.item}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{r.category}</TableCell>
                <TableCell className="hidden md:table-cell">${r.budget.toLocaleString()}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">{r.createdAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selected?.id} — {selected?.item}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Category:</span> {selected.category}</div>
                <div><span className="text-muted-foreground">Quantity:</span> {selected.quantity}</div>
                <div><span className="text-muted-foreground">Budget:</span> ${selected.budget.toLocaleString()}</div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={selected.status} /></div>
                <div><span className="text-muted-foreground">Requested by:</span> {selected.requestedBy}</div>
                <div><span className="text-muted-foreground">Date:</span> {selected.createdAt}</div>
              </div>
              <div><span className="text-muted-foreground">Description:</span> {selected.description}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
