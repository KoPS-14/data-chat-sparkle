import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface DataPreviewProps {
  rows: Record<string, any>[];
}

function inferColumns(rows: Record<string, any>[]) {
  const first = rows[0] ?? {};
  return Object.keys(first);
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
  const preview = rows.slice(0, 8);
  const columns = inferColumns(preview);
  const stats = summarize(rows);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Data preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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

      <Card>
        <CardHeader>
          <CardTitle>Quick summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(stats).map(([key, val]) => (
              <div key={key} className="rounded-md border p-3">
                <div className="font-medium mb-1">{key}</div>
                {val.type === "number" ? (
                  <div className="text-sm text-muted-foreground">
                    Count: {val.count} · Missing: {val.missing} · Mean: {val.mean.toFixed(2)} · Median: {val.median} · Range: {val.min}–{val.max} · Outliers: {val.outliers}
                  </div>
                ) : val.type === "text" ? (
                  <div className="text-sm text-muted-foreground">
                    Count: {val.count} · Missing: {val.missing} · Unique: {val.unique}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Empty column (all missing)</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
