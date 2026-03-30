import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { vendors } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Search, Sparkles, MapPin, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VendorsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const categories = [...new Set(vendors.map(v => v.category))];

  const filtered = vendors.filter(v => {
    const matchSearch = v.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || v.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Vendor Discovery" description="Find and evaluate vendors for your procurement needs" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vendors..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(v => (
          <div key={v.id} className={cn("rounded-xl border bg-card p-5 card-shadow hover:card-shadow-hover transition-shadow relative", v.isAiRecommended && "ring-1 ring-ai/30")}>
            {v.isAiRecommended && (
              <div className="absolute -top-2.5 left-4 flex items-center gap-1 bg-ai text-ai-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <Sparkles className="h-3 w-3" /> AI Recommended
              </div>
            )}
            <div className="mt-1">
              <h3 className="font-semibold">{v.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{v.category}</p>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-warning fill-warning" />
                <span className="text-sm font-medium">{v.rating}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Performance:</span>{" "}
                <span className="font-medium">{v.performanceScore}%</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t space-y-1">
              <p className="text-xs flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3 w-3" />{v.location}</p>
              <p className="text-xs flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" />{v.contact}</p>
              <p className="text-xs text-muted-foreground">{v.pastOrders} past orders</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
