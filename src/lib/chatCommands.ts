export interface ChartConfig {
  category: string;
  groupBy?: string;
  topN?: number;
}

export function parseChartCommand(text: string, rows: Record<string, any>[]): ChartConfig | null {
  const lower = text.toLowerCase();
  const cols = Object.keys(rows[0] ?? {});
  if (!cols.length) return null;
  const colsLower = cols.map((c) => c.toLowerCase());

  // Parse top N like: "top 10" or "up to 7"
  let topN: number | undefined;
  const m = lower.match(/(?:top|up to)\s+(\d{1,3})/i);
  if (m) topN = Math.max(1, Math.min(100, parseInt(m[1], 10)));

  // Find mentioned columns
  function findColNear(keyword: string) {
    const idx = lower.indexOf(keyword);
    if (idx === -1) return undefined;
    // try to match any known column name present after this keyword
    for (const c of colsLower) {
      if (lower.includes(c)) return cols[colsLower.indexOf(c)];
    }
    return undefined;
  }

  // Heuristic: first mentioned column is category (x-axis)
  let category: string | undefined;
  for (const c of colsLower) {
    if (lower.includes(c)) { category = cols[colsLower.indexOf(c)]; break; }
  }

  // Optional: groupBy after the word 'with'
  let groupBy: string | undefined;
  if (lower.includes(" with ")) {
    for (const c of colsLower) {
      if (lower.includes(c) && cols[colsLower.indexOf(c)] !== category) {
        groupBy = cols[colsLower.indexOf(c)];
        break;
      }
    }
  }

  if (!category) return null;
  return { category, groupBy, topN };
}
