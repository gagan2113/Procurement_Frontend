import { Bot, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiInsightPanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function AiInsightPanel({ title = "AI Insight", children, className }: AiInsightPanelProps) {
  return (
    <div className={cn("rounded-lg border border-ai/20 bg-ai-surface p-4 ai-glow", className)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="h-6 w-6 rounded-md bg-ai flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-ai-foreground" />
        </div>
        <span className="text-sm font-semibold text-ai">{title}</span>
        <Bot className="h-3.5 w-3.5 text-ai/60 animate-pulse-ai" />
      </div>
      <div className="text-sm text-foreground/80">{children}</div>
    </div>
  );
}
