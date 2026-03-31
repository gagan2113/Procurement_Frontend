import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Sparkles, Loader2, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreatePurchaseRequestMutation } from "@/hooks/use-purchase-requests";
import {
  downloadPurchaseRequestPdf,
  getApiErrorMessage,
  getApiFieldErrors,
  type PurchaseRequest,
} from "@/lib/purchase-request-api";

const categories = ["IT Equipment", "IT Services", "Furniture", "Marketing", "Operations", "HR"];

const aiSuggestions = [
  "Based on recent orders, consider specifying RAM and processor requirements for laptop requests.",
  "Budget seems within range for this category. Average spend: $1,200/unit.",
  "Tip: Add delivery timeline to help vendor selection later.",
];

export default function RaiseRequestPage() {
  const { toast } = useToast();
  const createRequestMutation = useCreatePurchaseRequestMutation();
  const [form, setForm] = useState({ item_name: "", category: "", quantity: "", budget: "", description: "" });
  const [aiActive, setAiActive] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdRequest, setCreatedRequest] = useState<PurchaseRequest | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const itemName = form.item_name.trim();
    const category = form.category.trim();
    const description = form.description.trim();
    const quantity = Number.parseInt(form.quantity, 10);
    const budget = Number.parseFloat(form.budget);

    if (itemName.length < 2 || itemName.length > 255) {
      errors.item_name = "Item name must be between 2 and 255 characters.";
    }

    if (category.length < 2 || category.length > 100) {
      errors.category = "Category must be between 2 and 100 characters.";
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      errors.quantity = "Quantity must be an integer greater than or equal to 1.";
    }

    if (!Number.isFinite(budget) || budget <= 0) {
      errors.budget = "Budget must be greater than 0.";
    }

    if (description.length < 10 || description.length > 2000) {
      errors.description = "Description must be between 10 and 2000 characters.";
    }

    return errors;
  };

  const downloadPdf = async (purchaseRequest: PurchaseRequest) => {
    setDownloadingPdf(true);
    try {
      const { blob, filename } = await downloadPurchaseRequestPdf(purchaseRequest.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `${purchaseRequest.pr_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: "PDF downloaded", description: `${purchaseRequest.pr_number} PDF has been downloaded.` });
    } catch (error) {
      toast({
        title: "PDF download failed",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast({
        title: "Validation failed",
        description: "Please fix the highlighted fields and try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        item_name: form.item_name.trim(),
        category: form.category.trim(),
        quantity: Number.parseInt(form.quantity, 10),
        budget: Number.parseFloat(form.budget),
        description: form.description.trim(),
      };

      const response = await createRequestMutation.mutateAsync(payload);
      setCreatedRequest(response.data);
      setForm({ item_name: "", category: "", quantity: "", budget: "", description: "" });
      toast({ title: "Request created", description: response.message });
    } catch (error) {
      const apiErrors = getApiFieldErrors(error);
      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors(apiErrors);
      }

      toast({
        title: "Could not create request",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const autoFill = () => {
    setAiActive(true);
    setTimeout(() => {
      setForm({ item_name: "Dell Latitude 5550", category: "IT Equipment", quantity: "25", budget: "37500", description: "Laptops for engineering team expansion. Specs: i7, 16GB RAM, 512GB SSD." });
      setAiActive(false);
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title="Raise Procurement Request" description="Submit a new procurement request for review" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border bg-card p-6 card-shadow space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item_name">Item Name</Label>
                <Input
                  id="item_name"
                  minLength={2}
                  maxLength={255}
                  placeholder="e.g., Dell Laptops"
                  value={form.item_name}
                  onChange={(e) => setField("item_name", e.target.value)}
                  required
                />
                {fieldErrors.item_name && <p className="text-xs text-destructive">{fieldErrors.item_name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={form.category} onValueChange={(value) => setField("category", value)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                {fieldErrors.category && <p className="text-xs text-destructive">{fieldErrors.category}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) => setField("quantity", e.target.value)}
                  required
                />
                {fieldErrors.quantity && <p className="text-xs text-destructive">{fieldErrors.quantity}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input
                  id="budget"
                  type="number"
                  min={0.01}
                  step={0.01}
                  placeholder="0.00"
                  value={form.budget}
                  onChange={(e) => setField("budget", e.target.value)}
                  required
                />
                {fieldErrors.budget && <p className="text-xs text-destructive">{fieldErrors.budget}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                minLength={10}
                maxLength={2000}
                placeholder="Describe the requirements..."
                rows={4}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                required
              />
              {fieldErrors.description && <p className="text-xs text-destructive">{fieldErrors.description}</p>}
            </div>
            <Button type="submit" disabled={createRequestMutation.isPending} className="gap-2">
              {createRequestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Request
            </Button>
          </div>

          {createdRequest && (
            <div className="rounded-xl border bg-card p-6 card-shadow space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold">Created Request: {createdRequest.pr_number}</h3>
                  <p className="text-sm text-muted-foreground">{createdRequest.item_name}</p>
                </div>
                <StatusBadge status={createdRequest.ai_status} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <p><span className="text-muted-foreground">Status:</span> {createdRequest.status}</p>
                <p><span className="text-muted-foreground">Budget:</span> ${createdRequest.budget.toLocaleString()}</p>
                <p><span className="text-muted-foreground">Created:</span> {new Date(createdRequest.created_at).toLocaleString()}</p>
                <p><span className="text-muted-foreground">Updated:</span> {new Date(createdRequest.updated_at).toLocaleString()}</p>
              </div>

              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Improved Description:</span> {createdRequest.improved_description}</p>
                <p><span className="text-muted-foreground">Budget Feedback:</span> {createdRequest.budget_feedback}</p>
                <p>
                  <span className="text-muted-foreground">Missing Fields:</span>{" "}
                  {createdRequest.missing_fields.length > 0 ? createdRequest.missing_fields.join(", ") : "None"}
                </p>
              </div>

              <Button
                variant="outline"
                className="gap-2"
                disabled={downloadingPdf}
                onClick={() => downloadPdf(createdRequest)}
                type="button"
              >
                {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Download PDF
              </Button>
            </div>
          )}
        </form>

        <div className="space-y-4">
          <AiInsightPanel title="AI Assistant">
            <div className="space-y-3">
              {aiSuggestions.map((s, i) => (
                <p key={i} className="text-xs leading-relaxed">• {s}</p>
              ))}
            </div>
          </AiInsightPanel>
          <Button variant="outline" onClick={autoFill} disabled={aiActive} className="w-full gap-2 border-ai/30 text-ai hover:bg-ai-surface">
            {aiActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI Auto-Fill Demo
          </Button>
        </div>
      </div>
    </div>
  );
}
