import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          actions={
            <>
              <ThemeToggle />
              <UserMenu />
            </>
          }
        >
          <MobileNav />
          <Breadcrumbs />
        </AppHeader>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
