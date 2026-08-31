"use client";

import type { AvaTableData } from "./types";
import { memo, useMemo, useState } from "react";

import { Check, ContentCopy } from "@mui/icons-material";
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { cn } from "@/lib/utils";

/**
 * The single AVA table component for chat responses. Numeric columns auto
 * right-align with tabular figures, values are shown as exact figures, and
 * gain/deficit values are color-coded as small pills (governmental convention).
 */

/** A value that reads as a number/currency/percent (for right-alignment). */
function looksNumeric(v: string | undefined): boolean {
  if (v == null || v === "") return false;
  return /^[\s$€£+\-−(]*[\d,]+(\.\d+)?%?\)?\s*$/.test(String(v).trim());
}

/** Color gains green, deficits red (governmental convention), as a small pill. */
function valuePillClass(value?: string): string {
  if (!value) return "";
  const v = value.trim();
  if (/^\+/.test(v) || /gain|improv|surplus/i.test(v)) return "bg-success/10 text-success";
  if (/^[−(-]\s*[$€£]?\s*[\d]|deficit|loss/i.test(v)) return "bg-error/10 text-error";
  return "";
}

function AvaTable({ data }: { data: AvaTableData }) {
  const [copied, setCopied] = useState(false);

  const columns = useMemo(() => (Array.isArray(data?.columns) ? data.columns : []), [data]);
  const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data]);

  // Right-align a column if the majority of its values are numeric.
  const numericCols = useMemo(() => {
    const set = new Set<number>();
    columns.forEach((_, colIndex) => {
      const vals = rows.map((row) => row[colIndex]).filter((v) => v != null && v !== "");
      if (vals.length && vals.filter((v) => looksNumeric(v)).length >= vals.length / 2) set.add(colIndex);
    });
    return set;
  }, [columns, rows]);

  // Currency columns: numeric columns whose values already carry a $/€/£, or whose
  // header signals money (Actual/Budget/Revenue/Cost/Fee/Amount…). These get a "$"
  // prefix so bare figures read as money (1,452,781 → $1,452,781).
  const currencyCols = useMemo(() => {
    const money = /\$|€|£|actual|budget|revenue|expense|cost|fee|amount|charge|balance|debt|price/i;
    const set = new Set<number>();
    columns.forEach((col, colIndex) => {
      if (!numericCols.has(colIndex)) return;
      const vals = rows.map((row) => row[colIndex]).filter((v) => v != null && v !== "");
      const hasSymbol = vals.some((v) => /[$€£]/.test(v));
      if (hasSymbol || money.test(col)) set.add(colIndex);
    });
    return set;
  }, [columns, rows, numericCols]);

  const handleCopy = async () => {
    const tsv = [columns.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; ignore silently
    }
  };

  if (columns.length === 0 && rows.length === 0) {
    return null;
  }

  return (
    <Box className="border-grey-200 mt-3 w-full overflow-hidden rounded-xl border">
      <Box className="bg-grey-25 border-grey-200 flex items-center justify-between border-b px-3 py-2">
        <Typography variant="subtitle2" className="text-text-primary">
          {data?.title || "Table"}
        </Typography>
        <IconButton size="small" onClick={handleCopy} title="Copy table values">
          {copied ? <Check fontSize="small" className="text-success" /> : <ContentCopy fontSize="small" />}
        </IconButton>
      </Box>
      {/* Wide tables scroll horizontally inside their own container so the chat
          column never overflows (industry-standard data-table behaviour). */}
      <TableContainer component={Box} className="max-h-[420px] max-w-full overflow-x-auto">
        <Table size="small" stickyHeader className="w-full">
          <TableHead>
            <TableRow>
              {columns.map((column, colIndex) => (
                <TableCell
                  key={colIndex}
                  align={numericCols.has(colIndex) ? "right" : "left"}
                  className="bg-grey-50 text-text-secondary border-grey-200 border-b px-3 py-2.5 text-xs font-semibold tracking-wide uppercase"
                >
                  {column}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                hover
                // Zebra striping for scannability across wide rows.
                className={cn("text-text-secondary", rowIndex % 2 === 1 && "bg-grey-25")}
              >
                {columns.map((_, colIndex) => {
                  const numeric = numericCols.has(colIndex);
                  const raw = row[colIndex] ?? "";
                  const pill = valuePillClass(raw);
                  // Show the exact figure as-is (no abbreviation); prefix "$" on
                  // currency columns so bare numbers read as money.
                  let display = raw;
                  if (
                    numeric &&
                    currencyCols.has(colIndex) &&
                    display !== "" &&
                    !/[$€£]/.test(display) &&
                    /\d/.test(display)
                  ) {
                    // Keep a leading minus outside the symbol: -1,452,781 → -$1,452,781.
                    display = display.startsWith("-") ? `-$${display.slice(1)}` : `$${display}`;
                  }
                  return (
                    <TableCell
                      key={colIndex}
                      align={numeric ? "right" : "left"}
                      className={cn(
                        "py-2.5",
                        numeric && "whitespace-nowrap tabular-nums",
                        colIndex === 0 && "text-text-primary font-semibold",
                      )}
                    >
                      {pill ? (
                        <span className={cn("inline-block rounded-md px-2 py-0.5 font-medium", pill)}>{display}</span>
                      ) : (
                        display
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default memo(AvaTable);
