"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ClientComparisonRow } from "@/features/intelligence/data";
import { formatCurrency, formatDateShort, formatSatisfaction } from "@/features/intelligence/format";

import { TrendArrow } from "./relationship-risk-badge";

type SortKey = "name" | "totalExperiences" | "totalParticipants" | "avgSatisfaction" | "totalContractValue" | "lastActiveDate";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Client" },
  { key: "totalExperiences", label: "Experiences", align: "right" },
  { key: "totalParticipants", label: "Participants", align: "right" },
  { key: "avgSatisfaction", label: "Avg Satisfaction", align: "right" },
  { key: "totalContractValue", label: "Contract Value", align: "right" },
  { key: "lastActiveDate", label: "Last Active", align: "right" },
];

function compareValues(a: ClientComparisonRow, b: ClientComparisonRow, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (av === null) return 1;
  if (bv === null) return -1;
  if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv);
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return 0;
}

export function ClientComparisonTable({ rows, selectedClientId }: { rows: ClientComparisonRow[]; selectedClientId: string | null }) {
  const [sortKey, setSortKey] = useState<SortKey>("avgSatisfaction");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => compareValues(a, b, sortKey) * (sortDir === "asc" ? 1 : -1));
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <Card className="bg-surface-elevated">
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col.key} className={col.align === "right" ? "text-right" : undefined}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-gold",
                      col.align === "right" && "flex-row-reverse"
                    )}
                  >
                    {col.label}
                    <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
              ))}
              <TableHead className="text-right">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.id === selectedClientId ? "selected" : undefined}
                className={cn(row.id === selectedClientId && "bg-gold/5")}
              >
                <TableCell className="font-medium">
                  <Link href={`/dashboard/intelligence/clients?client=${row.id}`} className="text-ivory hover:text-gold">
                    {row.name}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground capitalize">{row.type}</span>
                </TableCell>
                <TableCell className="text-right text-ivory">{row.totalExperiences}</TableCell>
                <TableCell className="text-right text-ivory">{row.totalParticipants.toLocaleString()}</TableCell>
                <TableCell className="text-right text-ivory">{formatSatisfaction(row.avgSatisfaction)}</TableCell>
                <TableCell className="text-right text-ivory">{formatCurrency(row.totalContractValue)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatDateShort(row.lastActiveDate)}</TableCell>
                <TableCell className="text-right text-lg">
                  <TrendArrow trend={row.trend} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <CardContent className="space-y-3 md:hidden">
        {sortedRows.map((row) => (
          <Link
            key={row.id}
            href={`/dashboard/intelligence/clients?client=${row.id}`}
            className={cn(
              "block rounded-lg border border-border-subtle bg-night/40 p-3",
              row.id === selectedClientId && "border-gold/40 bg-gold/5"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-ivory">{row.name}</p>
              <TrendArrow trend={row.trend} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground capitalize">{row.type}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{row.totalExperiences} experiences</span>
              <span className="text-right">{row.totalParticipants.toLocaleString()} participants</span>
              <span>Satisfaction {formatSatisfaction(row.avgSatisfaction)}</span>
              <span className="text-right">{formatCurrency(row.totalContractValue)}</span>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
