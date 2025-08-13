import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface DataPreviewProps {
  rows: Record<string, any>[];
}

function inferColumns(rows: Record<string, any>[]) {
  const set = new Set<string>();
  for (const r of rows) {
    Object.keys(r || {}).forEach((k) => set.add(k));
  }
  return Array.from(set);
}

function isNumericColumn(rows: Record<string, any>[], key: string) {
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

function summarize(rows: Record<string, any>[]) {
  const cols = inferColumns(rows);
  const res: Record<string, any> = {};
  for (const c of cols) {
    const values = rows.map(r => r[c]).filter(v => v !== null && v !== undefined && v !== "");
    const missing = rows.length - values.length;
    if (values.length === 0) {
      res[c] = { type: "empty", missing };
      continue;
    }
    if (isNumericColumn(rows, c)) {
      const nums = values.map(Number).filter(n => !Number.isNaN(n));
      nums.sort((a,b) => a-b);
      const mean = nums.reduce((a,b)=>a+b,0)/nums.length;
      const median = nums[Math.floor(nums.length/2)];
      const min = nums[0];
      const max = nums[nums.length-1];
      const sd = Math.sqrt(nums.reduce((a,b)=>a+(b-mean)*(b-mean),0)/nums.length);
      const outliers = nums.filter(n => Math.abs((n-mean)/(sd||1)) > 3).length;
      res[c] = { type: "number", count: nums.length, missing, mean, median, min, max, sd, outliers };
    } else {
      const unique = new Set(values.map(String));
      res[c] = { type: "text", count: values.length, missing, unique: unique.size };
    }
  }
  return res;
}

export function DataPreview({ rows }: DataPreviewProps) {
  const preview = rows;
  const columns = inferColumns(rows);
  const stats = summarize(rows);

  return (
    <div className="space-y-4">
  <Card id="data-preview-section">
        <CardHeader>
          <CardTitle>Data preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell key={c}>{String(row[c] ?? "")}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

  <Card id="summary-section">
        <CardHeader>
          <CardTitle className="text-2xl text-neutral-900">Quick summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(stats).map(([key, val]) => {
              const values = rows
                .map((r) => r[key])
                .filter((v) => v !== null && v !== undefined && v !== "");

              let topList: { label: string; count: number }[] = [];
              let topNums: number[] = [];

              if (val.type === "text") {
                const counts = new Map<string, number>();
                for (const v of values) {
                  const s = String(v);
                  counts.set(s, (counts.get(s) || 0) + 1);
                }
                topList = Array.from(counts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([label, count]) => ({ label, count }));
              } else if (val.type === "number") {
                topNums = values
                  .map((n) => Number(n))
                  .filter((n) => !Number.isNaN(n))
                  .sort((a, b) => b - a)
                  .slice(0, 5);
              }

              return (
                <div key={key} className="rounded-md border p-4 bg-white">
                  <div className="font-semibold mb-1 text-base text-neutral-900">{key}</div>
                  {val.type === "number" ? (
                    <>
                      <div className="text-base text-neutral-800">
                        Count: {val.count} - Missing: {val.missing} - Mean: {val.mean.toFixed(2)} - Median: {val.median} - Range: {val.min}–{val.max} - Outliers: {val.outliers}
                      </div>
                      {topNums.length ? (
                        <ul className="mt-2 text-sm text-neutral-800 grid grid-cols-2 gap-1">
                          {topNums.map((n, i) => (
                            <li key={i} className="flex items-center justify-between">
                              <span>Top {i + 1}</span>
                              <span>{n}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : val.type === "text" ? (
                    <>
                      <div className="text-base text-neutral-800">
                        Count: {val.count} - Missing: {val.missing} - Unique: {val.unique}
                      </div>
                      {topList.length ? (
                        <ul className="mt-2 text-sm text-neutral-800 grid grid-cols-1 gap-1">
                          {topList.map(({ label, count }) => (
                            <li key={label} className="flex items-center justify-between">
                              <span className="break-words whitespace-normal pr-2" title={label}>{label}</span>
                              <span className="shrink-0">{count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-base text-neutral-800">Empty column (all missing)</div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
