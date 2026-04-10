import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { usePurchaseRequestDetail, usePurchaseRequestList } from "@/hooks/use-purchase-requests";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, FileDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { downloadPurchaseRequestPdf, getApiErrorMessage } from "@/lib/purchase-request-api";

function formatLocalDate(dateValue: string) {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return parsed.toLocaleDateString();
}

export default function RequestsPage() {
  const { toast } = useToast();
  const listQuery = usePurchaseRequestList({ skip: 0, limit: 50 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloadingRequestId, setDownloadingRequestId] = useState<string | null>(null);
  const detailQuery = usePurchaseRequestDetail(selectedId);

  const requests = listQuery.data?.items ?? [];
  const filtered = requests.filter((request) => {
    const query = search.toLowerCase();
    const matchSearch =
      request.item_name.toLowerCase().includes(query) ||
      request.id.toLowerCase().includes(query) ||
      request.pr_number.toLowerCase().includes(query);
    const matchStatus = statusFilter === "all" || request.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDownloadPdf = async (requestId: string, prNumber: string) => {
    setDownloadingRequestId(requestId);
    try {
      const { blob, filename } = await downloadPurchaseRequestPdf(requestId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `${prNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({ title: "PDF downloaded", description: `${prNumber} PDF has been downloaded.` });
    } catch (error) {
      toast({
        title: "PDF download failed",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDownloadingRequestId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Requests" description="Manage all procurement requests" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by PR number, ID or item..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listQuery.isLoading && (
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading purchase requests...
        </div>
      )}

      {listQuery.isError && (
        <div className="rounded-xl border border-destructive/30 bg-card p-6 card-shadow space-y-3">
          <p className="text-sm text-destructive">{getApiErrorMessage(listQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => listQuery.refetch()}>Retry</Button>
        </div>
      )}

      {!listQuery.isLoading && !listQuery.isError && (
        <div className="rounded-xl border bg-card card-shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PR Number</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">INR Total Budget</TableHead>
                <TableHead className="hidden lg:table-cell">Budget/Unit</TableHead>
                <TableHead className="hidden lg:table-cell">Expected Delivery</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((request) => (
                <TableRow
                  key={request.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedId(request.id)}
                >
                  <TableCell className="font-medium">{request.pr_number}</TableCell>
                  <TableCell>{request.item_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{request.category}</TableCell>
                  <TableCell className="hidden md:table-cell">INR {request.budget.toLocaleString()}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    INR {request.budget_per_unit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{formatLocalDate(request.expected_delivery_date)}</TableCell>
                  <TableCell><StatusBadge status={request.status} /></TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {new Date(request.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Purchase Request Details</DialogTitle></DialogHeader>

          {detailQuery.isLoading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading request details...
            </div>
          )}

          {detailQuery.isError && (
            <div className="space-y-3 text-sm">
              <p className="text-destructive">{getApiErrorMessage(detailQuery.error)}</p>
              {selectedId && (
                <Button type="button" variant="outline" onClick={() => detailQuery.refetch()}>
                  Retry
                </Button>
              )}
            </div>
          )}

          {detailQuery.data && (
            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <h3 className="font-semibold">{detailQuery.data.pr_number} - {detailQuery.data.item_name}</h3>
                <p className="text-muted-foreground">{detailQuery.data.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Category:</span> {detailQuery.data.category}</div>
                <div><span className="text-muted-foreground">Quantity:</span> {detailQuery.data.quantity}</div>
                <div><span className="text-muted-foreground">INR Total Budget:</span> INR {detailQuery.data.budget.toLocaleString()}</div>
                <div><span className="text-muted-foreground">Budget Per Unit:</span> INR {detailQuery.data.budget_per_unit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <div><span className="text-muted-foreground">Expected Delivery:</span> {formatLocalDate(detailQuery.data.expected_delivery_date)}</div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge className="ml-1" status={detailQuery.data.status} /></div>
                <div><span className="text-muted-foreground">Updated:</span> {new Date(detailQuery.data.updated_at).toLocaleString()}</div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => handleDownloadPdf(detailQuery.data.id, detailQuery.data.pr_number)}
                disabled={downloadingRequestId === detailQuery.data.id}
              >
                {downloadingRequestId === detailQuery.data.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Download PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
