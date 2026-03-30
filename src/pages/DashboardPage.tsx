import { ClipboardList, Clock, FileText, Package, AlertTriangle, Plus, CheckCircle } from "lucide-react";
import { StatsCard } from "@/components/shared/StatsCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { Button } from "@/components/ui/button";
import { recentActivity, spendData, categorySpend, procurementRequests, notifications } from "@/lib/mock-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const navigate = useNavigate();
  const pendingCount = procurementRequests.filter(r => r.status === "Pending" || r.status === "In Review").length;
  const approvedCount = procurementRequests.filter(r => r.status === "Approved").length;
  const unreadAlerts = notifications.filter(n => !n.read && n.type === "alert");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your procurement pipeline"
        actions={<Button onClick={() => navigate("/raise-request")} className="gap-2"><Plus className="h-4 w-4" />New Request</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Requests" value={procurementRequests.length} change="+2 this week" changeType="positive" icon={ClipboardList} />
        <StatsCard title="Pending Approvals" value={pendingCount} change="3 urgent" changeType="negative" icon={Clock} iconColor="bg-warning/10" />
        <StatsCard title="Active Tenders" value={3} change="1 closing soon" changeType="neutral" icon={FileText} iconColor="bg-info/10" />
        <StatsCard title="Completed Orders" value={approvedCount} change="+12% vs last month" changeType="positive" icon={Package} iconColor="bg-success/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spend chart */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold mb-4">Spend vs Budget</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={spendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="spend" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} name="Spend" />
              <Bar dataKey="budget" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} opacity={0.4} name="Budget" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category spend */}
        <div className="rounded-xl border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold mb-4">Spend by Category</h3>
          <div className="space-y-3">
            {categorySpend.map(c => {
              const max = Math.max(...categorySpend.map(x => x.amount));
              return (
                <div key={c.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{c.category}</span>
                    <span className="font-medium">${(c.amount / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(c.amount / max) * 100}%`, backgroundColor: c.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent activity */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 card-shadow">
          <h3 className="text-sm font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  {a.icon === "check" ? <CheckCircle className="h-4 w-4 text-success" /> :
                   a.icon === "alert" ? <AlertTriangle className="h-4 w-4 text-warning" /> :
                   <ClipboardList className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.action}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-4">
          <AiInsightPanel title="AI Summary">
            <p>Spending is trending 5% above Q1 forecast. Consider reviewing IT Services category — 2 large requests pending.</p>
          </AiInsightPanel>
          <div className="rounded-xl border bg-card p-5 card-shadow">
            <h3 className="text-sm font-semibold mb-3">Active Alerts</h3>
            <div className="space-y-3">
              {unreadAlerts.map(n => (
                <div key={n.id} className="flex items-start gap-2 p-2 rounded-lg bg-warning/5 border border-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
