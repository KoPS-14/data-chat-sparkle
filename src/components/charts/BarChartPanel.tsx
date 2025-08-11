import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
    "hsl(var(--muted-foreground))",
    "hsl(var(--destructive))",
  ];

  return (
    <Card data-export="chart">
      <CardHeader>
        <CardTitle>{title || (groupBy ? `${category} by ${groupBy}` : `${category} frequency`)}</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 480 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={category} angle={-25} textAnchor="end" interval={0} height={72} />
            <YAxis />
            <Tooltip />
            <Legend />
            {series.map((s, i) => (
              <Bar key={s} dataKey={s} fill={palette[i % palette.length]} radius={4} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
