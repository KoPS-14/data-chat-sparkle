export function inferColumns(rows: Record<string, any>[]) {
  const first = rows[0] ?? {};
  return Object.keys(first);
}

export function isNumericColumn(rows: Record<string, any>[], key: string) {
  let numeric = 0;
  let non = 0;
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) numeric++; else non++;
    if (numeric > 3 && non === 0) return true;
  }
  return numeric > non;
}

export function topFrequencies(rows: Record<string, any>[], key: string, topN = 5) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined || v === "") continue;
    const s = String(v);
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([value, count]) => ({ value, count }));
}

export function topNumericValues(rows: Record<string, any>[], key: string, topN = 10) {
  const nums = rows
    .map((r) => Number(r[key]))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => b - a);
  return nums.slice(0, topN);
}

export function detectOutliers(rows: Record<string, any>[], key: string) {
  const nums = rows
    .map((r) => Number(r[key]))
    .filter((n) => !Number.isNaN(n));
  if (!nums.length) return { count: 0, values: [] as number[] };
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const sd = Math.sqrt(nums.reduce((a, b) => a + (b - mean) * (b - mean), 0) / nums.length) || 1;
  const outliers = nums.filter((n) => Math.abs((n - mean) / sd) > 3);
  return { count: outliers.length, values: outliers };
}
