import { Warehouse } from "lucide-react";

export function AppLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2 font-semibold">
      <Warehouse className="size-5 shrink-0" />
      <span className={collapsed ? "sr-only" : ""}>Inventory</span>
    </div>
  );
}
