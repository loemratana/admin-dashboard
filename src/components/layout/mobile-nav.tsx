"use client";

import { useRef } from "react";
import { Menu, X } from "lucide-react";

import { AppLogo } from "./app-logo";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Open menu"
        className="-ml-2 rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden"
      >
        <Menu className="size-5" />
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Navigation"
        // Clicks on the backdrop target the dialog element itself.
        onClick={(event) => event.target === event.currentTarget && close()}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 border-r border-border bg-card p-0 text-foreground backdrop:bg-black/50 md:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <AppLogo />
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="-mr-2 rounded-md p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="size-5" />
            </button>
          </div>
          <SidebarNav onNavigate={close} />
        </div>
      </dialog>
    </>
  );
}
