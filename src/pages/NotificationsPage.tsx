import { PageHeader } from "@/components/shared/PageHeader";
import { notifications } from "@/lib/mock-data";
import { Bell, CheckCircle, AlertTriangle, Building2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const typeIcons = {
  approval: CheckCircle,
  alert: AlertTriangle,
  vendor: Building2,
  info: Info,
};

const typeColors = {
  approval: "bg-success/10 text-success",
  alert: "bg-warning/10 text-warning",
  vendor: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
};

export default function NotificationsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Notifications & Activity" description="Stay updated on procurement events" />

      <div className="space-y-3">
        {notifications.map(n => {
          const Icon = typeIcons[n.type];
          return (
            <div key={n.id} className={cn("rounded-xl border bg-card p-4 card-shadow flex items-start gap-3", !n.read && "border-l-2 border-l-primary")}>
              <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", typeColors[n.type])}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{n.title}</h4>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{new Date(n.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
              </div>
              {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
