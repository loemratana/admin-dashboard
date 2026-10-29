"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { StockMovementPoint } from "../types/dashboard";
import { formatDayOfMonth, formatLongDate, formatNumber, formatShortDate } from "@/lib/format";

const series = [
  { key: "stockIn", label: "Stock in", barClassName: "bg-chart-1" },
  { key: "stockOut", label: "Stock out", barClassName: "bg-chart-2" },
] as const;

// Rounds the axis up to a clean step (1, 2 or 5 × 10^n) so ticks read 0 / 50 / 100 …
function niceScale(max: number, tickCount = 4) {
  const raw = Math.max(max, 1) / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const step = (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10) * magnitude;
  const top = Math.ceil(Math.max(max, 1) / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  return { top, ticks };
}

export function StockMovementChart({ data }: { data: StockMovementPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { top, ticks } = niceScale(Math.max(...data.flatMap((point) => [point.stockIn, point.stockOut])));
  const totals = {
    stockIn: data.reduce((sum, point) => sum + point.stockIn, 0),
    stockOut: data.reduce((sum, point) => sum + point.stockOut, 0),
  };
  const range = data.length > 0 ? `${formatShortDate(data[0].date)} – ${formatShortDate(data[data.length - 1].date)}` : "";

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Stock in vs. stock out</CardTitle>
        <CardDescription>Units moved per day, {range}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* mb-6 leaves room for the top tick label, which sits half above the plot. */}
        <ul className="mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {series.map(({ key, label, barClassName }) => (
            <li key={key} className="flex items-center gap-2">
              <span aria-hidden="true" className={`size-2.5 rounded-[2px] ${barClassName}`} />
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold">{formatNumber(totals[key])}</span>
            </li>
          ))}
        </ul>

        <div role="figure" aria-label={`Units in and out per day, ${range}`} className="flex gap-2">
          {/* Y axis */}
          <div aria-hidden="true" className="relative h-56 w-8 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
            {ticks.map((tick) => (
              <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(tick / top) * 100}%` }}>
                {formatNumber(tick)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative h-56">
              {ticks.map((tick) => (
                <div
                  key={tick}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-border"
                  style={{ bottom: `${(tick / top) * 100}%` }}
                />
              ))}

              <div className="absolute inset-0 flex">
                {data.map((point, index) => {
                  const active = activeIndex === index;
                  const dimmed = activeIndex !== null && !active;
                  // Beside the day rather than over it, flipping sides so it stays inside the card.
                  const tooltipPosition = index < data.length / 2 ? "left-full ml-1" : "right-full mr-1";

                  return (
                    <div
                      key={point.date}
                      tabIndex={0}
                      aria-label={`${formatLongDate(point.date)}: ${point.stockIn} in, ${point.stockOut} out`}
                      onPointerEnter={() => setActiveIndex(index)}
                      onPointerLeave={() => setActiveIndex(null)}
                      onFocus={() => setActiveIndex(index)}
                      onBlur={() => setActiveIndex(null)}
                      className="relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {series.map(({ key, barClassName }) => (
                        <div
                          key={key}
                          className={`w-full max-w-3 rounded-t-[4px] transition-opacity ${barClassName} ${dimmed ? "opacity-35" : ""}`}
                          style={{ height: `${(point[key] / top) * 100}%` }}
                        />
                      ))}

                      {active && (
                        <div
                          role="tooltip"
                          className={`pointer-events-none absolute top-0 z-10 w-36 rounded-md border border-border bg-popover p-2.5 text-popover-foreground shadow-md ${tooltipPosition}`}
                        >
                          <p className="mb-1.5 text-xs text-muted-foreground">{formatLongDate(point.date)}</p>
                          {series.map(({ key, label, barClassName }) => (
                            <p key={key} className="flex items-center gap-2 text-xs">
                              <span aria-hidden="true" className={`h-0.5 w-3 rounded-full ${barClassName}`} />
                              <span className="font-semibold tabular-nums">{formatNumber(point[key])}</span>
                              <span className="text-muted-foreground">{label}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X axis: day of month; every other label hidden on narrow screens. */}
            <div aria-hidden="true" className="mt-2 flex text-[11px] text-muted-foreground tabular-nums">
              {data.map((point, index) => (
                <span key={point.date} className={`flex-1 text-center ${index % 2 === 1 ? "max-sm:invisible" : ""}`}>
                  {formatDayOfMonth(point.date)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View as table</summary>
          <table className="mt-2 w-full text-left">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 text-right font-medium">Stock in</th>
                <th className="py-1 text-right font-medium">Stock out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {data.map((point) => (
                <tr key={point.date}>
                  <td className="py-1">{formatLongDate(point.date)}</td>
                  <td className="py-1 text-right">{formatNumber(point.stockIn)}</td>
                  <td className="py-1 text-right">{formatNumber(point.stockOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </CardContent>
    </Card>
  );
}
