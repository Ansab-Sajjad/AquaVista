export type AvaMessageType = "narrative" | "table" | "chart";

export interface AvaTableData {
  title?: string;
  columns: string[];
  rows: string[][];
}

export interface AvaChartData {
  chartType: "bar" | "line" | "pie";
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  labels: string[];
  series: { name: string; values: number[] }[];
}

/** Source file provenance for a data-backed answer. */
export interface AvaSource {
  id: string;
  fileName: string;
  fileType: string;
  year?: string;
}

/** Evidence trace — explains how a number was computed (for explainable AI). */
export interface AvaEvidenceTrace {
  datasetId: string;
  fileName: string;
  op: string;
  columns: string[];
  filterDescription?: string;
  matchedRows: number;
  valueColumn?: string;
  groupByColumn?: string;
  yearColumns?: string[];
  notes?: string;
}

/** Structured plan produced by the planner (for plan preview). */
export interface AvaPlan {
  mode: string;
  rationale: string;
  clarificationQuestion?: string | null;
  steps: Array<{
    op: string;
    datasetId: string;
    label: string;
    columns: string[];
    filter?: { column: string; equals: string } | null;
    valueColumn?: string | null;
    groupBy?: string | null;
    yearColumns?: string[];
  }>;
}

export interface AvaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: AvaMessageType;
  title?: string;
  tableData?: AvaTableData;
  chartData?: AvaChartData;
  /** Non-fatal caveats (missing data, unmatched numbers, stale assumptions). */
  warnings?: string[];
  /** Source files backing the answer, when tool calls were used. */
  sources?: AvaSource[];
  /** Structured plan produced by the planner (for plan preview). */
  plan?: AvaPlan;
  /** Evidence trace — how each number was computed. */
  evidenceTrace?: AvaEvidenceTrace[];
  /** USD cost of this response. */
  costUsd?: number;
  /** Model used for this response. */
  model?: string;
  isPinned?: boolean;
  createdAt?: string;
}

export interface AvaUsage {
  used: number;
  limit: number;
  remaining: number;
  limitReached: boolean;
}

export interface StartupQuestion {
  _id?: string;
  text: string;
  order: number;
}
