import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
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
  rewritePurchaseRequestDescription,
  type RewriteDescriptionInput,
  type PurchaseRequest,
} from "@/lib/purchase-request-api";

const categories = ["IT Equipment", "IT Services", "Furniture", "Marketing", "Operations", "HR"];
const DESCRIPTION_MIN_LENGTH = 10;

function formatLocalDate(dateValue: string) {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return parsed.toLocaleDateString();
}

function getDateInputValue(daysFromToday = 0) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + daysFromToday);

  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function RaiseRequestPage() {
  const { toast } = useToast();
  const createRequestMutation = useCreatePurchaseRequestMutation();
  const [form, setForm] = useState({
    item_name: "",
    category: "",
    quantity: "",
    budget: "",
    description: "",
    expected_delivery_date: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdRequest, setCreatedRequest] = useState<PurchaseRequest | null>(null);
  const [isRewriteLoading, setIsRewriteLoading] = useState(false);
  const [rewriteMissingDetails, setRewriteMissingDetails] = useState<string[]>([]);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const todayDate = getDateInputValue(0);
  const tomorrowDate = getDateInputValue(1);

  const perUnitBudget = useMemo(() => {
    const quantity = Number.parseFloat(form.quantity);
    const budget = Number.parseFloat(form.budget);

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(budget) || budget <= 0) {
      return null;
    }

    return budget / quantity;
  }, [form.quantity, form.budget]);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => {
      if (!previous[key]) {
        return previous;
      }

      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const itemName = form.item_name.trim();
    const category = form.category.trim();
    const description = form.description.trim();
    const quantity = Number.parseInt(form.quantity, 10);
    const budget = Number.parseFloat(form.budget);
    const expectedDeliveryDate = form.expected_delivery_date.trim();

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

    if (description.length < DESCRIPTION_MIN_LENGTH || description.length > 2000) {
      errors.description = `Description must be between ${DESCRIPTION_MIN_LENGTH} and 2000 characters.`;
    }

    if (!expectedDeliveryDate) {
      errors.expected_delivery_date = "Expected delivery date is required.";
    } else if (expectedDeliveryDate <= todayDate) {
      errors.expected_delivery_date = "Expected delivery date must be a future date.";
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
        expected_delivery_date: form.expected_delivery_date.trim(),
      };

      const response = await createRequestMutation.mutateAsync(payload);
      setCreatedRequest(response.data);
      setRewriteMissingDetails([]);
      setForm({ item_name: "", category: "", quantity: "", budget: "", description: "", expected_delivery_date: "" });
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

  const handleRewriteDescription = async () => {
    const description = form.description.trim();
    if (description.length < DESCRIPTION_MIN_LENGTH) {
      const message = `Description must be at least ${DESCRIPTION_MIN_LENGTH} characters before rewrite.`;
      setFieldErrors((previous) => ({ ...previous, description: message }));
      toast({
        title: "Description too short",
        description: message,
        variant: "destructive",
      });
      return;
    }

    const payload: RewriteDescriptionInput = {
      description,
    };

    const itemName = form.item_name.trim();
    const category = form.category.trim();
    const expectedDeliveryDate = form.expected_delivery_date.trim();
    const quantity = Number.parseInt(form.quantity, 10);
    const budget = Number.parseFloat(form.budget);

    if (itemName) {
      payload.item_name = itemName;
    }

    if (category) {
      payload.category = category;
    }

    if (Number.isInteger(quantity) && quantity > 0) {
      payload.quantity = quantity;
    }

    if (Number.isFinite(budget) && budget > 0) {
      payload.budget = budget;
    }

    if (expectedDeliveryDate) {
      payload.expected_delivery_date = expectedDeliveryDate;
    }

    setIsRewriteLoading(true);
    try {
      const response = await rewritePurchaseRequestDescription(payload);
      const rewrittenDescription = response.data.rewritten_description?.trim();
      const missingDetails = Array.isArray(response.data.missing_details) ? response.data.missing_details : [];

      if (rewrittenDescription) {
        setForm((previous) => ({ ...previous, description: rewrittenDescription }));
      }

      setRewriteMissingDetails(missingDetails);

      setFieldErrors((previous) => {
        if (!previous.description) {
          return previous;
        }

        const next = { ...previous };
        delete next.description;
        return next;
      });

      toast({
        title: "Description rewritten",
        description: response.message,
      });
    } catch (error) {
      toast({
        title: "Could not rewrite description",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsRewriteLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Raise Procurement Request" description="Submit a new procurement request for review" />

      <form onSubmit={handleSubmit} className="space-y-5">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <Label htmlFor="budget">INR Total Budget</Label>
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
                <p className="text-xs text-muted-foreground">
                  Budget Per Unit (read-only): {perUnitBudget === null ? "-" : `INR ${perUnitBudget.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
                <Input
                  id="expected_delivery_date"
                  type="date"
                  min={tomorrowDate}
                  value={form.expected_delivery_date}
                  onChange={(e) => setField("expected_delivery_date", e.target.value)}
                  required
                />
                {fieldErrors.expected_delivery_date && <p className="text-xs text-destructive">{fieldErrors.expected_delivery_date}</p>}
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

            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleRewriteDescription}
              disabled={isRewriteLoading}
            >
              {isRewriteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isRewriteLoading ? "Rewriting..." : "AI Rewrite"}
            </Button>

            {rewriteMissingDetails.length > 0 && (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
                <p className="text-sm font-medium">Missing details to confirm</p>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {rewriteMissingDetails.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button type="submit" disabled={createRequestMutation.isPending} className="gap-2">
              {createRequestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Purchase Request
            </Button>
          </div>

          {createdRequest && (
            <div className="rounded-xl border bg-card p-6 card-shadow space-y-4">
              <div>
                <h3 className="text-base font-semibold">Created Request: {createdRequest.pr_number}</h3>
                <p className="text-sm text-muted-foreground">{createdRequest.item_name}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <p><span className="text-muted-foreground">Status:</span> {createdRequest.status}</p>
                <p><span className="text-muted-foreground">INR Total Budget:</span> INR {createdRequest.budget.toLocaleString()}</p>
                <p><span className="text-muted-foreground">Budget Per Unit:</span> INR {(Number.isFinite(createdRequest.budget_per_unit) ? createdRequest.budget_per_unit : createdRequest.budget / Math.max(createdRequest.quantity, 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                <p><span className="text-muted-foreground">Expected Delivery:</span> {formatLocalDate(createdRequest.expected_delivery_date)}</p>
                <p><span className="text-muted-foreground">Created:</span> {new Date(createdRequest.created_at).toLocaleString()}</p>
                <p><span className="text-muted-foreground">Updated:</span> {new Date(createdRequest.updated_at).toLocaleString()}</p>
              </div>

              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Description:</span> {createdRequest.description}</p>
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
    </div>
  );
}
