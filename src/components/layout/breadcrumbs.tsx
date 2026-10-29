"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { createStore, useStore } from "@/lib/create-store";

// href -> label overrides, so /products/prd-0003 can read "Wireless Mouse" instead of "Prd 0003".
const labelsStore = createStore<Record<string, string>>({});

export function useBreadcrumbLabel(href: string, label: string | undefined) {
  useEffect(() => {
    if (!label) return;
    labelsStore.setState((labels) => ({ ...labels, [href]: label }));
    return () =>
      labelsStore.setState((labels) => {
        const next = { ...labels };
        delete next[href];
        return next;
      });
  }, [href, label]);
}

function formatSegment(segment: string) {
  return decodeURIComponent(segment)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function Breadcrumbs() {
  const segments = usePathname().split("/").filter(Boolean);
  const labels = useStore(labelsStore);

  const crumbs = [
    { label: "Dashboard", href: "/" },
    ...segments.map((segment, index) => {
      const href = "/" + segments.slice(0, index + 1).join("/");
      return { label: labels[href] ?? formatSegment(segment), href };
    }),
  ];

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="size-3.5" />}
              {isLast ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:text-foreground">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
