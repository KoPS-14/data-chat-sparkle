import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isNumericColumn } from "@/lib/analysis";

export interface ChartBuilderProps {
  rows: Record<string, any>[];
  defaultCategory?: string;
  defaultGroupBy?: string;
  defaultTopN?: number;
  onCreate: (charts: { category: string; groupBy?: string; topN?: number; title?: string }[]) => void;
}

function inferColumnsUnion(rows: Record<string, any>[]) {
  const set = new Set<string>();
  for (const r of rows) Object.keys(r || {}).forEach((k) => set.add(k));
  return Array.from(set);
}

export function ChartBuilder({ rows, defaultCategory, defaultGroupBy, defaultTopN = 10, onCreate }: ChartBuilderProps) {
  const columns = useMemo(() => inferColumnsUnion(rows), [rows]);
  const numericFlags = useMemo(() => Object.fromEntries(columns.map(c => [c, isNumericColumn(rows, c)])), [rows, columns]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(defaultCategory ? [defaultCategory] : []);
  const [groupBy, setGroupBy] = useState<string | undefined>(defaultGroupBy);
  const [topN, setTopN] = useState<number>(defaultTopN);

  const toggleCategory = (c: string, checked: boolean | string) => {
    const isChecked = !!checked;
    setSelectedCategories((prev) => isChecked ? Array.from(new Set([...prev, c])) : prev.filter(x => x !== c));
  };

  const handleCreate = () => {
    if (!selectedCategories.length) return;
    onCreate(selectedCategories.map((c) => ({ category: c, groupBy: groupBy || undefined, topN })));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Build visualizations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="font-medium">Choose categories (x-axis)</div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-auto pr-1">
            {columns.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm border rounded px-2 py-1">
                <Checkbox checked={selectedCategories.includes(c)} onCheckedChange={(v) => toggleCategory(c, v)} />
                <span className="truncate" title={c}>{c}</span>
                <span className="ml-auto text-[10px] px-1 rounded bg-muted text-muted-foreground">{numericFlags[c] ? "123" : "ABC"}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Group by (optional)</div>
            <Select value={groupBy ?? "__none__"} onValueChange={(v) => setGroupBy(v === "__none__" ? undefined : v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {columns.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Top N</div>
            <Input type="number" className="w-24" min={1} max={100} value={topN} onChange={(e) => setTopN(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
          </div>

          <div className="ml-auto">
            <Button onClick={handleCreate} disabled={!selectedCategories.length}>Add charts to chat</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ChartBuilder;
