import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
}

export function StatsCard({ title, value, change, changeType = "neutral", icon: Icon, iconColor }: StatsCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 card-shadow hover:card-shadow-hover transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", iconColor || "bg-primary/10")}>
          <Icon className={cn("h-4.5 w-4.5", iconColor ? "text-card" : "text-primary")} />
        </div>
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {change && (
        <p className={cn("text-xs mt-1 font-medium", {
          "text-success": changeType === "positive",
          "text-destructive": changeType === "negative",
          "text-muted-foreground": changeType === "neutral",
        })}>
          {change}
        </p>
      )}
    </div>
  );
}
