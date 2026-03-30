import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const categories = ["IT Equipment", "IT Services", "Furniture", "Marketing", "Operations", "HR"];

const aiSuggestions = [
  "Based on recent orders, consider specifying RAM and processor requirements for laptop requests.",
  "Budget seems within range for this category. Average spend: $1,200/unit.",
  "Tip: Add delivery timeline to help vendor selection later.",
];

export default function RaiseRequestPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({ item: "", category: "", quantity: "", budget: "", description: "" });
  const [aiActive, setAiActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast({ title: "Request Created", description: `${form.item} has been submitted for validation.` });
      setForm({ item: "", category: "", quantity: "", budget: "", description: "" });
    }, 1000);
  };

  const autoFill = () => {
    setAiActive(true);
    setTimeout(() => {
      setForm({ item: "Dell Latitude 5550", category: "IT Equipment", quantity: "25", budget: "37500", description: "Laptops for engineering team expansion. Specs: i7, 16GB RAM, 512GB SSD." });
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
                <Label htmlFor="item">Item Name</Label>
                <Input id="item" placeholder="e.g., Dell Laptops" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input id="qty" type="number" placeholder="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input id="budget" type="number" placeholder="0.00" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" placeholder="Describe the requirements..." rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Request
            </Button>
          </div>
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
