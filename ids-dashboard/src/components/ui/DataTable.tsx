"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { cn, downloadCSV, truncate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";

export interface Column<T = any> {
  key: keyof T | string;
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
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          )}
          {downloadable && (
            <button
              onClick={() => downloadCSV(data as Record<string, unknown>[], downloadName)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              <Download size={12} /> Export CSV
            </button>
          )}
          <span className="ml-auto text-[11px] text-slate-500">
            {total.toLocaleString()} row{total !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[#1e3a5f]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#0f1f3d] border-b border-[#1e3a5f]">
              {columns.map((col) => (
                <th
                  key={col.key as string}
                  onClick={() => col.sortable && toggleSort(col.key as string)}
                  className={cn(
                    "px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap",
                    col.sortable && "cursor-pointer hover:text-white select-none",
                    col.className
                  )}
                >
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
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
                  className="px-3 py-8 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              slice.map((row: any, i: number) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-[#1e3a5f]/50 transition-colors",
                    i % 2 === 0 ? "bg-[#0a1628]" : "bg-[#0c1a30]",
                    "hover:bg-blue-500/5"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key as string}
                      className={cn("px-3 py-2 text-slate-300", col.className)}
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
          <span className="text-[11px] text-slate-500">
            Page {safePage} of {pages}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={safePage === 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 hover:bg-white/5 transition-colors"
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
                  className={cn(
                    "w-7 h-7 rounded text-xs font-medium transition-colors",
                    pg === safePage
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {pg}
                </button>
              );
            })}
            <button
              disabled={safePage === pages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 hover:bg-white/5 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
