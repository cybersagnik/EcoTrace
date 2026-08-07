"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FilterState,
  QaSourceInfo,
  QaTab,
  QualityScore,
  TelemetryRow,
  ValidationIssue,
} from "@/types/telemetry";
import { parseCsv } from "@/utils/qa/csvParser";
import { computeQualityScore, validateCsv, validateTelemetryRows } from "@/utils/qa/validator";
import {
  applyFilters,
  deserializeFilters,
  EMPTY_FILTERS,
  serializeFilters,
} from "@/utils/qa/filters";
import { generateSampleCsv } from "@/utils/qa/sampleData";

const STORAGE_KEY = "ecotrace_qa_dataset";

interface PersistedDataset {
  rows: TelemetryRow[];
  issues: ValidationIssue[];
  sourceInfo: QaSourceInfo | null;
}

interface QaDashboardContextType {
  rows: TelemetryRow[];
  issues: ValidationIssue[];
  sourceInfo: QaSourceInfo | null;
  activeTab: QaTab;
  filters: FilterState;
  filteredRows: TelemetryRow[];
  filteredIssues: ValidationIssue[];
  score: QualityScore;
  hasDataset: boolean;
  hydrated: boolean;
  setActiveTab: (tab: QaTab) => void;
  importCsv: (fileName: string, text: string) => void;
  importSample: () => void;
  addManualRows: (rows: TelemetryRow[]) => void;
  clearDataset: () => void;
  setFilters: (partial: Partial<FilterState>) => void;
  resetFilters: () => void;
}

const QaDashboardContext = createContext<QaDashboardContextType | undefined>(undefined);

function loadPersisted(): PersistedDataset | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDataset;
    if (!Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function QaDashboardProvider({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<TelemetryRow[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [sourceInfo, setSourceInfo] = useState<QaSourceInfo | null>(null);
  const [activeTab, setActiveTabState] = useState<QaTab>("csv");
  const [filters, setFiltersState] = useState<FilterState>(EMPTY_FILTERS);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // Hydrate from localStorage + URL once, client-side.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const persisted = loadPersisted();
    if (persisted) {
      setRows(persisted.rows);
      setIssues(persisted.issues);
      setSourceInfo(persisted.sourceInfo);
    }

    const urlFilters = deserializeFilters(window.location.search);
    setFiltersState((prev) => ({
      ...prev,
      ...urlFilters,
      // Prefer persisted device/fleet/region options only when the URL is empty.
      deviceIds: urlFilters.deviceIds.length > 0 ? urlFilters.deviceIds : prev.deviceIds,
      fleetIds: urlFilters.fleetIds.length > 0 ? urlFilters.fleetIds : prev.fleetIds,
      regions: urlFilters.regions.length > 0 ? urlFilters.regions : prev.regions,
      statuses: urlFilters.statuses.length > 0 ? urlFilters.statuses : prev.statuses,
      dateFrom: urlFilters.dateFrom ?? prev.dateFrom,
      dateTo: urlFilters.dateTo ?? prev.dateTo,
    }));

    setHydrated(true);
  }, []);

  // Persist dataset to localStorage (debounced-ish: saves on every change; cheap enough).
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedDataset = { rows, issues, sourceInfo };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota exceeded — degrade gracefully, dashboard still works in-memory.
    }
  }, [rows, issues, sourceInfo, hydrated]);

  const setActiveTab = useCallback((tab: QaTab) => setActiveTabState(tab), []);

  const importCsv = useCallback((fileName: string, text: string) => {
    const parsed = parseCsv(text);
    const { rows: parsedRows, issues: parsedIssues } = validateCsv(parsed);
    setRows(parsedRows);
    setIssues(parsedIssues);
    setSourceInfo({ fileName, rowCount: parsedRows.length, importedAt: new Date().toISOString() });
    setFiltersState(EMPTY_FILTERS);
  }, []);

  const importSample = useCallback(() => {
    const text = generateSampleCsv();
    const parsed = parseCsv(text);
    const { rows: parsedRows, issues: parsedIssues } = validateCsv(parsed);
    setRows(parsedRows);
    setIssues(parsedIssues);
    setSourceInfo({
      fileName: "sample_telemetry.csv",
      rowCount: parsedRows.length,
      importedAt: new Date().toISOString(),
    });
    setFiltersState(EMPTY_FILTERS);
  }, []);

  const addManualRows = useCallback(
    (newRows: TelemetryRow[]) => {
      setRows((prevRows) => {
        const base = prevRows.length;
        const indexed = newRows.map((r, idx) => ({ ...r, rowIndex: base + idx }));
        const combined = [...prevRows, ...indexed];
        setIssues(validateTelemetryRows(combined));
        return combined;
      });
    },
    []
  );

  const clearDataset = useCallback(() => {
    setRows([]);
    setIssues([]);
    setSourceInfo(null);
    setFiltersState(EMPTY_FILTERS);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors on clear.
    }
  }, []);

  const setFilters = useCallback((partial: Partial<FilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetFilters = useCallback(() => setFiltersState(EMPTY_FILTERS), []);

  // Mirror filters into the URL (no history spam — replaceState only).
  const prevSearch = useRef<string | null>(null);
  useEffect(() => {
    const qs = serializeFilters(filters);
    if (qs !== prevSearch.current) {
      prevSearch.current = qs;
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", qs || window.location.pathname);
      }
    }
  }, [filters]);

  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  const filteredIssues = useMemo(() => {
    const rowIndexes = new Set(filteredRows.map((r) => r.rowIndex));
    return issues.filter((i) => i.rowIndex === null || rowIndexes.has(i.rowIndex));
  }, [issues, filteredRows]);

  const score = useMemo(() => computeQualityScore(issues), [issues]);

  const hasDataset = rows.length > 0;

  return (
    <QaDashboardContext.Provider
      value={{
        rows,
        issues,
        sourceInfo,
        activeTab,
        filters,
        filteredRows,
        filteredIssues,
        score,
        hasDataset,
        hydrated,
        setActiveTab,
        importCsv,
        importSample,
        addManualRows,
        clearDataset,
        setFilters,
        resetFilters,
      }}
    >
      {children}
    </QaDashboardContext.Provider>
  );
}

export function useQaDashboard(): QaDashboardContextType {
  const ctx = useContext(QaDashboardContext);
  if (!ctx) {
    throw new Error("useQaDashboard must be used within a QaDashboardProvider");
  }
  return ctx;
}
