import { Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useState } from "react";

export function AppHeader() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 gap-4 shrink-0">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="text-muted-foreground" />
        {searchOpen ? (
          <Input
            placeholder="Search requests, vendors..."
            className="w-64 h-8 text-sm"
            autoFocus
            onBlur={() => setSearchOpen(false)}
          />
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setSearchOpen(true)} className="text-muted-foreground gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Search...</span>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
            3
          </span>
        </Button>
        <div className="flex items-center gap-2 ml-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-none">Alex Morgan</p>
            <p className="text-xs text-muted-foreground">Procurement Lead</p>
          </div>
        </div>
      </div>
    </header>
  );
}
