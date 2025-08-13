import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";
import { isNumericColumn, topFrequencies, inferColumns } from "@/lib/analysis";

export interface BarChartPanelProps {
  rows: Record<string, any>[];
  category: string;
  groupBy?: string;
  topN?: number;
  title?: string;
}

function buildGroupedData(rows: Record<string, any>[], category: string, groupBy?: string, topN = 10) {
  const cats = topFrequencies(rows, category, 100); // start big, limit later
  const topCats = cats.slice(0, topN).map((c) => c.value);

  if (!groupBy) {
    const freq = topFrequencies(rows, category, topN);
    return { data: freq.map((f) => ({ [category]: f.value, Count: f.count })), series: ["Count"] };
  }

  // Grouped counts by category and groupBy
  const groups = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const cat = r[category];
    const grp = r[groupBy];
    if (cat === null || cat === undefined || cat === "") continue;
    if (grp === null || grp === undefined || grp === "") continue;
    const catStr = String(cat);
    const grpStr = String(grp);
    if (!topCats.includes(catStr)) continue;
    if (!groups.has(catStr)) groups.set(catStr, new Map());
    const m = groups.get(catStr)!;
    m.set(grpStr, (m.get(grpStr) || 0) + 1);
  }

  const allGroups = new Set<string>();
  groups.forEach((m) => m.forEach((_, g) => allGroups.add(g)));
  const series = Array.from(allGroups);

  const data = topCats.map((cat) => {
    const row: Record<string, any> = { [category]: cat };
    const m = groups.get(cat) || new Map();
    for (const g of series) row[g] = m.get(g) || 0;
    return row;
  });

  return { data, series };
}

export function BarChartPanel({ rows, category, groupBy, topN = 10, title }: BarChartPanelProps) {
  const isNumeric = useMemo(() => isNumericColumn(rows, category), [rows, category]);

  const { data, series } = useMemo(() => {
    if (isNumeric) {
      // Treat numeric as frequency of values (no binning for simplicity)
      const freq = topFrequencies(rows, category, topN);
      return { data: freq.map((f) => ({ [category]: String(f.value), Count: f.count })), series: ["Count"] };
    }
    return buildGroupedData(rows, category, groupBy, topN);
  }, [rows, category, groupBy, topN, isNumeric]);

  const palette = [
    "#4f46e5", // indigo-600
    "#06b6d4", // cyan-500
    "#f59e0b", // amber-500
    "#10b981", // emerald-500
    "#ef4444", // red-500
    "#8b5cf6", // violet-500
    "#22c55e", // green-500
    "#eab308", // yellow-500
    "#3b82f6", // blue-500
    "#f97316", // orange-500
  ];

  const resolvedTitle = title || (groupBy ? `${category} by ${groupBy}` : `${category} frequency`);

  // Compute totals across series to optionally plot a line like the reference image
  const dataWithTotals = useMemo(() => {
    return (data || []).map((d) => {
      const total = series.reduce((sum, s) => sum + (Number(d[s]) || 0), 0);
      return { ...d, Total: total };
    });
  }, [data, series]);

  const tickFmt = (v: any) => {
    const s = String(v ?? "");
    return s.length > 12 ? s.slice(0, 12) + "…" : s;
  };

  // Build a short, human-readable summary for the chart footer
  const summary = useMemo(() => {
    const allCategoryCounts = dataWithTotals.map((r: any) => ({ key: r[category], count: Number(groupBy ? r.Total : r.Count) || 0 }));
    const totalShown = allCategoryCounts.reduce((a, b) => a + b.count, 0);
    const top = [...allCategoryCounts].sort((a, b) => b.count - a.count)[0];
    const uniqueAll = topFrequencies(rows, category, 100000).length; // total unique in dataset
    const shown = allCategoryCounts.length;
    const coverage = totalShown > 0 && top ? Math.round((top.count / totalShown) * 100) : 0;

    if (!top) return "No data";
    const parts: string[] = [];
    parts.push(`Top ${category}: ${top.key} (${top.count})`);
    parts.push(`Shown: ${shown} of ${uniqueAll} categories`);
    parts.push(`Top share: ${coverage}% of bars shown`);
    if (groupBy) parts.push(`Grouped by ${groupBy}`);
  return parts.join(" - ");
  }, [dataWithTotals, rows, category, groupBy]);

  return (
    <Card data-export="chart" data-title={resolvedTitle} className="w-full">
      <CardHeader>
        <CardTitle>{resolvedTitle}</CardTitle>
      </CardHeader>
  <CardContent style={{ height: 560 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dataWithTotals} margin={{ top: 8, right: 32, left: 8, bottom: 56 }} barCategoryGap={"20%"} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={category} angle={-20} tickFormatter={tickFmt} textAnchor="end" interval={0} height={72} />
            <YAxis yAxisId="left" allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" allowDecimals={false} hide={!groupBy} />
            <Tooltip />
            <Legend />
            {series.map((s, i) => (
              <Bar key={s} yAxisId="left" dataKey={s} fill={palette[i % palette.length]} radius={3} maxBarSize={32} />
            ))}
            {groupBy ? (
              <Line yAxisId="right" type="monotone" dataKey="Total" stroke="#111827" strokeWidth={2} dot={false} />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
      <CardFooter className="pt-2">
        <div className="text-base text-neutral-900 font-medium">{summary}</div>
      </CardFooter>
    </Card>
  );
}
