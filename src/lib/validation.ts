import { isNumericColumn } from "./analysis";

export interface ValidationIssue {
  rule: string;
  message: string;
  rowIndex: number; // 0-based
  column?: string;
  value?: any;
}

export interface ValidationSummary {
  issues: ValidationIssue[];
  countsPerRule: Record<string, number>;
}

function unionColumns(rows: Record<string, any>[]) {
  const set = new Set<string>();
  for (const r of rows) Object.keys(r || {}).forEach((k) => set.add(k));
  return Array.from(set);
}

function isLikelyDateColumn(name: string) {
  return /date|time|timestamp/i.test(name);
}

function isLikelyIdColumn(name: string) {
  return /(id|code|number)$/i.test(name);
}

function isNonNegativeMetric(name: string) {
  return /(price|amount|total|quantity|qty|count|cost|revenue|sales|units)/i.test(name);
}

const ALLOWED_ENUMS: Record<string, string[]> = {
  "Purchase Type": ["Online", "In-store"],
  "Payment Method": ["Credit Card", "Gift Card", "Cash", "Wire", "Debit Card"],
};

export function validateRows(rows: Record<string, any>[], maxIssues = 500): ValidationSummary {
  const issues: ValidationIssue[] = [];
  if (!rows?.length) return { issues, countsPerRule: {} };

  const columns = unionColumns(rows);

  // Precompute numeric inference per column from sample
  const numericFlags = Object.fromEntries(columns.map((c) => [c, isNumericColumn(rows, c)]));

  // Duplicate check for likely ID columns
  const idCols = columns.filter(isLikelyIdColumn);
  for (const idCol of idCols) {
    const seen = new Map<string, number>();
    rows.forEach((r, i) => {
      const v = r[idCol];
      if (v === null || v === undefined || v === "") return;
      const s = String(v);
      if (seen.has(s)) {
        issues.push({ rule: `Duplicate ${idCol}`, message: `Duplicate identifier ${s}`, rowIndex: i, column: idCol, value: v });
      } else {
        seen.set(s, i);
      }
    });
  }

  rows.forEach((r, i) => {
    for (const c of columns) {
      const v = r[c];
      // Missing check for likely ID columns
      if (isLikelyIdColumn(c) && (v === null || v === undefined || String(v).trim() === "")) {
        issues.push({ rule: `Missing ${c}`, message: `${c} should not be empty`, rowIndex: i, column: c, value: v });
      }

      // Numeric expectations
      if (numericFlags[c]) {
        if (!(v === null || v === undefined || v === "")) {
          const n = Number(v);
          if (Number.isNaN(n)) {
            issues.push({ rule: `Invalid number in ${c}`, message: `Expected numeric`, rowIndex: i, column: c, value: v });
          } else if (isNonNegativeMetric(c) && n < 0) {
            issues.push({ rule: `Negative ${c}`, message: `Expected non-negative`, rowIndex: i, column: c, value: v });
          }
        }
      }

      // Date expectations by name
      if (isLikelyDateColumn(c) && !(v === null || v === undefined || v === "")) {
        const s = String(v);
        const t = Date.parse(s);
        if (Number.isNaN(t)) {
          issues.push({ rule: `Invalid date in ${c}`, message: `Unparseable date`, rowIndex: i, column: c, value: v });
        }
      }

      // Allowed enums (exact column name match)
      const allowed = ALLOWED_ENUMS[c];
      if (allowed && !(v === null || v === undefined || v === "")) {
        if (!allowed.includes(String(v))) {
          issues.push({ rule: `Unexpected ${c}`, message: `Value not in allowed set`, rowIndex: i, column: c, value: v });
        }
      }
    }
  });

  const trimmed = issues.slice(0, maxIssues);
  const countsPerRule: Record<string, number> = {};
  for (const it of issues) countsPerRule[it.rule] = (countsPerRule[it.rule] || 0) + 1;
  return { issues: trimmed, countsPerRule };
}
