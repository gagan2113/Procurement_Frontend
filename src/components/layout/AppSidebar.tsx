import {
  LayoutDashboard, FilePlus, CheckSquare, ClipboardList, DollarSign,
  Building2, FileText, BarChart3, Users, ShieldCheck, Package,
  Truck, Receipt, CreditCard, Bell, Bot, Globe
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Raise Request", url: "/raise-request", icon: FilePlus },
  { title: "Demand Validation", url: "/demand-validation", icon: CheckSquare },
  { title: "Requests", url: "/requests", icon: ClipboardList },
  { title: "Finance Review", url: "/finance-review", icon: DollarSign },
];

const procurementNav = [
  { title: "Vendors", url: "/vendors", icon: Building2 },
  { title: "RFQ / Tenders", url: "/rfq", icon: FileText },
  { title: "Vendor Portal", url: "/vendor-portal", icon: Globe },
  { title: "Bid Management", url: "/bids", icon: BarChart3 },
  { title: "Vendor Shortlisting", url: "/shortlisting", icon: Users },
  { title: "Approval", url: "/approval", icon: ShieldCheck },
];

const fulfillmentNav = [
  { title: "Purchase Orders", url: "/purchase-orders", icon: Package },
  { title: "Delivery Tracking", url: "/delivery", icon: Truck },
  { title: "Invoice Processing", url: "/invoices", icon: Receipt },
  { title: "Payment Approval", url: "/payment", icon: CreditCard },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === path;
    }

    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const renderGroup = (label: string, items: typeof mainNav) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-wider">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <NavLink to={item.url} end={item.url === "/"} className="gap-3" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="text-sm">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-sidebar-primary-foreground">ProcureAI</h1>
              <p className="text-[10px] text-sidebar-foreground/50">Intelligent Procurement</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        {renderGroup("Overview", mainNav)}
        {renderGroup("Procurement", procurementNav)}
        {renderGroup("Fulfillment", fulfillmentNav)}
      </SidebarContent>
    </Sidebar>
  );
}
