import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { rfqs, vendors } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Plus, Send, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const chatMessages = [
  { from: "You", text: "Can you confirm delivery within 14 days?", time: "10:30 AM" },
  { from: "TechWorld Supplies", text: "Yes, we can deliver within 12-14 business days for this quantity.", time: "10:45 AM" },
  { from: "You", text: "Great. Any volume discount for 50+ units?", time: "11:00 AM" },
  { from: "TechWorld Supplies", text: "We can offer 3% discount for orders above 50 units.", time: "11:20 AM" },
];

export default function RFQPage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFQ / Tender Management"
        description="Create and manage Requests for Quotation"
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Create RFQ</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New RFQ</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input placeholder="RFQ title..." /></div>
                <div className="space-y-2"><Label>Requirements</Label><Textarea placeholder="Describe requirements..." rows={3} /></div>
                <div className="space-y-2"><Label>Deadline</Label><Input type="date" /></div>
                <Button className="w-full gap-2"><Send className="h-4 w-4" />Send RFQ</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4">
        {rfqs.map(r => (
          <div key={r.id} className="rounded-xl border bg-card p-5 card-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{r.title}</h3>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{r.requirements}</p>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Created: {r.createdAt}</span>
                  <span>Deadline: {r.deadline}</span>
                  <span>Vendors: {r.vendors.length}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setChatOpen(true)}>
                <MessageSquare className="h-4 w-4" />Chat
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Vendor chat dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Vendor Communication</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.from === "You" ? "items-end" : "items-start"}`}>
                <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${m.from === "You" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.text}
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5">{m.from} · {m.time}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Type a message..." className="flex-1" />
            <Button size="icon"><Send className="h-4 w-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
