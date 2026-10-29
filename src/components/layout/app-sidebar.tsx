'use client';
import { AppLogo } from "./app-logo";
import {useState} from "react";
import { SidebarNav } from "./sidebar-nav";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";


export function AppSidebar() {

  const [collapsed,setCollapsed] = useState(false);
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    
    <aside
      className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className={`flex h-14 items-center border-b border-border ${collapsed ? "justify-center px-2" : "px-4"}`}>
        <AppLogo collapsed={collapsed} />
      </div>

      <SidebarNav collapsed={collapsed} />

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={`flex w-full items-center rounded-md py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground ${
            collapsed ? "justify-center px-2" : "gap-3 px-3"
          }`}
        >
          <ToggleIcon className="size-4 shrink-0" />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
