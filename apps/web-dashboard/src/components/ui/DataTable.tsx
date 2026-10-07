"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { cn, downloadCSV, truncate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";

export interface Column<T = any> {
  key: keyof T | string;
  id?: string;           // unique React key override — use when two columns share the same key
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  downloadable?: boolean;
  downloadName?: string;
  className?: string;
  emptyMessage?: string;
}

export default function DataTable<T = any>({
  columns,
  data,
  pageSize = 10,
  searchable = false,
  searchKeys = [],
  downloadable = false,
  downloadName = "results.csv",
  className,
  emptyMessage = "No data available.",
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Filter
  const filtered = query
    ? data.filter((row: any) =>
        (searchKeys as string[]).some((k) =>
          String(row[k] ?? "").toLowerCase().includes(query.toLowerCase())
        )
      )
    : data;

  // Sort
  const sorted = sortKey
    ? [...filtered].sort((a: any, b: any) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        return sortDir === "asc"
          ? av < bv ? -1 : av > bv ? 1 : 0
          : av > bv ? -1 : av < bv ? 1 : 0;
      })
    : filtered;

  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const slice = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Toolbar */}
      {(searchable || downloadable) && (
        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  outlineColor: "var(--accent)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
            </div>
          )}
          {downloadable && (
            <button
              onClick={() => downloadCSV(data as Record<string, unknown>[], downloadName)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border)",
                color: "var(--accent)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card-hover)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)"; }}
            >
              <Download size={12} /> Export CSV
            </button>
          )}
          <span className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>
            {total.toLocaleString()} row{total !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
              {columns.map((col) => (
                <th
                  key={(col.id ?? col.key) as string}
                  onClick={() => col.sortable && toggleSort(col.key as string)}
                  className={cn(
                    "px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap",
                    col.sortable && "cursor-pointer select-none",
                    col.className
                  )}
                  style={{ color: "var(--text-secondary)" }}
                >
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    <span className="ml-1" style={{ color: "var(--accent)" }}>
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              slice.map((row: any, i: number) => (
                <tr
                  key={i}
                  className="border-b transition-colors"
                  style={{
                    background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-card-alt)",
                    borderColor: "color-mix(in srgb, var(--border) 50%, transparent)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      "color-mix(in srgb, var(--accent) 5%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      i % 2 === 0 ? "var(--bg-card)" : "var(--bg-card-alt)";
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={(col.id ?? col.key) as string}
                      className={cn("px-3 py-2", col.className)}
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {col.render
                        ? col.render(row)
                        : truncate(String(row[col.key as string] ?? "—"), 30)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Page {safePage} of {pages}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={safePage === 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded disabled:opacity-30 transition-colors hover:bg-[var(--bg-elevated)]"
              style={{ color: "var(--text-secondary)" }}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const pg =
                pages <= 5
                  ? i + 1
                  : safePage <= 3
                  ? i + 1
                  : safePage >= pages - 2
                  ? pages - 4 + i
                  : safePage - 2 + i;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className="w-7 h-7 rounded text-xs font-medium transition-colors"
                  style={
                    pg === safePage
                      ? {
                          background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                          color: "var(--accent)",
                          border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                        }
                      : { color: "var(--text-secondary)" }
                  }
                  onMouseEnter={(e) => {
                    if (pg !== safePage)
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
                  }}
                  onMouseLeave={(e) => {
                    if (pg !== safePage)
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  {pg}
                </button>
              );
            })}
            <button
              disabled={safePage === pages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded disabled:opacity-30 transition-colors hover:bg-[var(--bg-elevated)]"
              style={{ color: "var(--text-secondary)" }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
