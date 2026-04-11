import { cn } from "@/lib/utils";

type StatusType = "success" | "warning" | "danger" | "info" | "neutral" | "ai";

const statusStyles: Record<StatusType, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
  neutral: "bg-muted text-muted-foreground border-border",
  ai: "bg-ai-surface text-ai border-ai/20",
};

const statusMap: Record<string, StatusType> = {
  Approved: "success", Delivered: "success", Matched: "success", Paid: "success", "Ready for Payment": "success", Valid: "success", Closed: "success",
  Open: "info", "Open for Bidding": "info",
  Pending: "warning", "In Review": "warning", "In Progress": "warning", Sent: "warning", Acknowledged: "warning", Created: "warning", Draft: "neutral",
  Rejected: "danger", Mismatched: "danger", Flagged: "danger", "Needs Review": "danger",
  approved: "success", closed: "neutral", valid: "success", open: "info",
  pending: "warning", active: "info",
  rejected: "danger", needs_review: "danger",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const type = statusMap[status] || "neutral";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", statusStyles[type], className)}>
      {status}
    </span>
  );
}
