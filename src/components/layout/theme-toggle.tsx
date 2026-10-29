"use client";

import { useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useDismiss } from "@/hooks/use-dismiss";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  // The selected theme lives in ThemeProvider; this component only reads and updates it.
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useDismiss(containerRef, open, () => setOpen(false));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change theme"
        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {/* Chosen by CSS, so the icon is right on first paint without waiting for hydration. */}
        <Sun className="size-5 dark:hidden" />
        <Moon className="hidden size-5 dark:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-border bg-card py-1 shadow-lg"
        >
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              <Icon className="size-4" />
              {label}
              {theme === value && <Check className="ml-auto size-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
