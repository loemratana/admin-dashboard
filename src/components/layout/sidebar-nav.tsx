"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { isNavGroup, mainNav, type NavGroup, type NavItem, type NavLink } from "@/config/navigation";
import { useAuthorization } from "@/features/access-control/hooks/use-access";

type SidebarNavProps = {
  // Icon-only mode for the desktop sidebar; the mobile drawer leaves it off.
  collapsed?: boolean;
  onNavigate?: () => void;
};

function matches(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

// The most specific link wins: on /inventory/receive that's "Stock in", not "Stock overview".
function activeHrefFor(pathname: string) {
  return mainNav
    .flatMap((item) => (isNavGroup(item) ? item.children : [item]))
    .filter((link) => link.available && matches(link.href, pathname))
    .reduce<string | null>((best, link) => (!best || link.href.length > best.length ? link.href : best), null);
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const canDo = useAuthorization();

  // Drop links the user can't open, then groups left without any available page.
  const allowed = (link: NavLink) => !link.permission || canDo(link.permission);
  const visibleNav = mainNav.flatMap((item): NavItem[] => {
    if (!isNavGroup(item)) return allowed(item) ? [item] : [];
    const children = item.children.filter(allowed);
    return children.some((child) => child.available) ? [{ ...item, children }] : [];
  });

  return (
    // Scrolls when the links outgrow the sidebar. Not when collapsed: the
    // flyout submenus and tooltips sit outside the nav and would be clipped.
    <nav className={`flex min-h-0 flex-1 flex-col gap-1 p-2 ${collapsed ? "" : "overflow-y-auto overscroll-contain"}`}>
      {visibleNav.map((item) =>
        isNavGroup(item) ? (
          <SidebarNavGroup
            key={item.title}
            group={item}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ) : (
          <SidebarNavLink
            key={item.href}
            link={item}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ),
      )}
    </nav>
  );
}

// Shown beside an icon-only item on hover or keyboard focus.
function NavTooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 rounded-md bg-primary px-2 py-1 text-xs whitespace-nowrap text-primary-foreground opacity-0 shadow-md transition-opacity group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
    >
      {children}
    </span>
  );
}

type SidebarNavGroupProps = {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
};

function SidebarNavGroup({ group, pathname, collapsed, onNavigate }: SidebarNavGroupProps) {
  const containsActive = group.children.some((child) => child.href === activeHrefFor(pathname));
  // null = follow the route (open while one of its pages is active) until the user toggles it.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? containsActive;
  const panelId = useId();
  const Icon = group.icon;

  const children = group.children.map((child) => (
    <SidebarNavLink key={child.href} link={child} pathname={pathname} collapsed={false} onNavigate={onNavigate} />
  ));

  if (collapsed) {
    // Icon only; the sub-links appear in a popover on hover or keyboard focus.
    return (
      <div className="group/nav relative">
        <button
          type="button"
          aria-label={group.title}
          aria-haspopup="true"
          className={`flex w-full items-center justify-center rounded-md px-2 py-2 ${
            containsActive
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Icon className="size-4" />
        </button>
        {/* pl-2 instead of a margin, so the pointer can cross into the popover without it closing. */}
        <div className="absolute top-0 left-full z-50 hidden pl-2 group-focus-within/nav:block group-hover/nav:block">
          <div className="flex min-w-48 flex-col gap-1 rounded-md border border-border bg-card p-1 shadow-lg">
            <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{group.title}</p>
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted hover:text-foreground ${
          containsActive ? "font-medium text-foreground" : "text-muted-foreground"
        }`}
      >
        <Icon className="size-4" />
        {group.title}
        <ChevronDown className={`ml-auto size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div id={panelId} hidden={!open} className="mt-1 ml-5 flex flex-col gap-1 border-l border-border pl-2">
        {children}
      </div>
    </div>
  );
}

type SidebarNavLinkProps = {
  link: NavLink;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
};

function SidebarNavLink({ link, pathname, collapsed, onNavigate }: SidebarNavLinkProps) {
  const { title, href, icon: Icon, available } = link;
  const layout = `group/item relative flex items-center rounded-md py-2 text-sm whitespace-nowrap ${
    collapsed ? "justify-center px-2" : "gap-3 px-3"
  }`;

  if (!available) {
    return (
      <span aria-disabled="true" className={`${layout} cursor-not-allowed text-muted-foreground/60`}>
        <Icon className="size-4 shrink-0" />
        <span className={collapsed ? "sr-only" : ""}>{title}</span>
        {collapsed ? (
          <NavTooltip>{title} (soon)</NavTooltip>
        ) : (
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            Soon
          </span>
        )}
      </span>
    );
  }

  const active = href === activeHrefFor(pathname);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${layout} ${
        active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {/* sr-only, not removed, so the link keeps its accessible name when collapsed. */}
      <span className={collapsed ? "sr-only" : ""}>{title}</span>
      {collapsed && <NavTooltip>{title}</NavTooltip>}
    </Link>
  );
}
