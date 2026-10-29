type AppHeaderProps = {
  children?: React.ReactNode;
  actions?: React.ReactNode;
};

export function AppHeader({ children, actions }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
