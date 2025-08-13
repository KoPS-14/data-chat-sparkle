import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { DataPreview } from "@/components/data/DataPreview";
import { BarChartPanel } from "@/components/charts/BarChartPanel";
import { ChartBuilder } from "@/components/charts/ChartBuilder";
import { DownloadSummaryPDF } from "@/components/export/DownloadSummaryPDF";
import { Checkbox } from "@/components/ui/checkbox";
import { parseChartCommand } from "@/lib/chatCommands";
import { validateRows } from "@/lib/validation";
import { isNumericColumn } from "@/lib/analysis";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: JSX.Element | string;
}

const Index = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: "welcome",
    role: "assistant",
    content: (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">AI Data Prep Chat</h1>
        <p className="text-muted-foreground">Upload a CSV or Excel file, then ask for summary, missing values, or outliers. Your data never leaves the browser.</p>
      </div>
    )
  }]);
  // Track chart elements and selection
  const [chartOptions, setChartOptions] = useState<{ id: string; title: string }[]>([]);
  const [selectedCharts, setSelectedCharts] = useState<string[]>([]);
  // Helper to update chart options after rendering new messages
  useEffect(() => {
    // Find all chart cards with data-export="chart" and a title
    const chartEls = Array.from(document.querySelectorAll('[data-export="chart"]')) as HTMLElement[];
    const options = chartEls.map((el, idx) => {
      const title = (el.getAttribute('data-title') || '').trim() || `Chart ${idx + 1}`;
      return { id: el.id || `chart-${idx}`, title };
    });
    // Assign IDs to chart elements if missing
    chartEls.forEach((el, idx) => { if (!el.id) el.id = `chart-${idx}`; });
    setChartOptions(options);
    setSelectedCharts(options.map(opt => opt.id)); // default: all selected
  }, [messages]);
  // Section selection (data preview and summary)
  const [includePreview, setIncludePreview] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);

  // Chart selection UI
  const chartSelection = (
    <div className="mb-2 flex items-center flex-wrap gap-4">
      <div className="font-medium">Select outputs to include in PDF:</div>
      <label className="flex items-center gap-2">
        <Checkbox checked={includePreview} onCheckedChange={(c)=>setIncludePreview(!!c)} />
        <span className="text-sm">Data preview</span>
      </label>
      <label className="flex items-center gap-2">
        <Checkbox checked={includeSummary} onCheckedChange={(c)=>setIncludeSummary(!!c)} />
        <span className="text-sm">Quick summary</span>
      </label>
      {chartOptions.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {chartOptions.map(opt => (
            <label key={opt.id} className="flex items-center gap-2">
              <Checkbox
                checked={selectedCharts.includes(opt.id)}
                onCheckedChange={checked => {
                  setSelectedCharts(prev => checked ? [...prev, opt.id] : prev.filter(id => id !== opt.id));
                }}
              />
              <span className="text-sm">{opt.title}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [input, setInput] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--spotlight-x", `${x}%`);
      el.style.setProperty("--spotlight-y", `${y}%`);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  const parseFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    return new Promise<Record<string, any>[]>((resolve, reject) => {
      if (name.endsWith(".csv")) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (res) => resolve(res.data as Record<string, any>[]),
          error: reject,
        });
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[];
          resolve(json);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error("Unsupported file type. Please upload CSV or Excel."));
      }
    });
  }, []);

  const handleUpload = useCallback(async (file?: File) => {
    try {
      if (!file) return;
      const data = await parseFile(file);
      setRows(data);
      setUploadedFileName(file.name);
      toast({ title: "File processed", description: `${file.name} • ${data.length} rows` });
      setMessages((prev) => ([
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: `Uploaded ${file.name}` },
        { id: crypto.randomUUID(), role: "assistant", content: <DataPreview rows={data} /> },
      ]));
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message });
    }
  }, [parseFile]);

  const onSend = useCallback(() => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => ([...prev, { id: crypto.randomUUID(), role: "user", content: text }]));

    // very lightweight intent routing
    if (!rows.length) {
      setMessages((prev) => ([...prev, { id: crypto.randomUUID(), role: "assistant", content: "Please upload a CSV or Excel file first." }]));
      return;
    }

    const lower = text.toLowerCase();
    if (lower.includes("missing")) {
      const missing = Object.keys(rows[0] ?? {}).reduce((acc: Record<string, number>, k) => {
        acc[k] = rows.filter(r => r[k] === null || r[k] === undefined || r[k] === "").length; return acc;
      }, {});
      setMessages((prev) => ([...prev, {
        id: crypto.randomUUID(), role: "assistant", content: (
          <Card>
            <CardContent className="p-4">
              <div className="font-medium mb-2">Missing values by column</div>
              <ul className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                {Object.entries(missing).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between border rounded px-2 py-1">
                    <span>{k}</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      }]));
    } else if (lower.includes("summary") || lower.includes("describe") || lower.includes("statistics")) {
      setMessages((prev) => ([...prev, { id: crypto.randomUUID(), role: "assistant", content: <DataPreview rows={rows} /> }]));
    } else if (lower.includes("outlier")) {
      // simple numeric z-score check
      const cols = Object.keys(rows[0] ?? {});
      const numericCols = cols.filter(c => rows.some(r => typeof r[c] === "number"));
      const outlierCounts: Record<string, number> = {};
      for (const c of numericCols) {
        const nums = rows.map(r => r[c]).filter((n) => typeof n === "number") as number[];
        const mean = nums.reduce((a,b)=>a+b,0)/(nums.length||1);
        const sd = Math.sqrt(nums.reduce((a,b)=>a+(b-mean)*(b-mean),0)/(nums.length||1));
        outlierCounts[c] = nums.filter(n => Math.abs((n-mean)/(sd||1)) > 3).length;
      }
      setMessages((prev) => ([...prev, {
        id: crypto.randomUUID(), role: "assistant", content: (
          <Card>
            <CardContent className="p-4">
              <div className="font-medium mb-2">Potential outliers (z-score &gt; 3)</div>
              <ul className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                {Object.entries(outlierCounts).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between border rounded px-2 py-1">
                    <span>{k}</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      }]));
    } else if (lower.includes("visualize") || lower.includes("bar chart") || lower.includes("show top")) {
      const cfg = parseChartCommand(text, rows);
      if (cfg) {
        setMessages((prev) => ([
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: (
              <BarChartPanel
                rows={rows}
                category={cfg.category}
                groupBy={cfg.groupBy}
                topN={cfg.topN}
              />
            ),
          },
        ]));
      } else {
        // Show chart builder to let user pick multiple charts easily
        setMessages((prev) => ([
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: (
              <ChartBuilder
                rows={rows}
                onCreate={(charts) => {
                  // Insert all requested charts as messages
                  setMessages((pv) => ([
                    ...pv,
                    ...charts.map((c) => ({
                      id: crypto.randomUUID(),
                      role: "assistant" as const,
                      content: (
                        <BarChartPanel
                          rows={rows}
                          category={c.category}
                          groupBy={c.groupBy}
                          topN={c.topN}
                          title={`${c.category}${c.groupBy ? ` by ${c.groupBy}` : ''}`}
                        />
                      ),
                    }))
                  ]));
                }}
              />
            ),
          },
        ]));
      }
    } else {
      setMessages((prev) => ([...prev, { id: crypto.randomUUID(), role: "assistant", content: "Try: \"summary\", \"missing values\", or \"outliers in column X\"." }]));
    }
  }, [input, rows]);

  return (
    <div ref={surfaceRef} className="min-h-screen bg-hero-surface">
      <header className="container py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-lg font-semibold">AI Data Prep Chat</div>
            <p className="text-xs text-muted-foreground">Upload CSV/Excel and chat with your data</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Upload</Button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />
          {uploadedFileName ? (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={uploadedFileName}>
              {uploadedFileName}
            </span>
          ) : null}
          {chartSelection}
          {rows.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                const summary = validateRows(rows);
                setMessages((prev) => ([
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: (
                      <Card>
                        <CardContent className="p-4">
                          <div className="font-medium mb-2">Logic check</div>
                          {Object.keys(summary.countsPerRule).length === 0 ? (
                            <div className="text-sm text-muted-foreground">No issues found.</div>
                          ) : (
                            <ul className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                              {Object.entries(summary.countsPerRule).map(([rule, count]) => (
                                <li key={rule} className="flex items-center justify-between border rounded px-2 py-1">
                                  <span className="truncate max-w-[70%]" title={rule}>{rule}</span>
                                  <span>{count}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      </Card>
                    ),
                  },
                ]));
              }}
            >
              Logic check
            </Button>
          )}
          {rows.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                // Pick up to 6 categorical columns with reasonable cardinality
                const allCols = Array.from(new Set(rows.flatMap((r) => Object.keys(r || {}))));
                const candidates = allCols.filter((c) => !isNumericColumn(rows, c));
                const ranked = candidates
                  .map((c) => {
                    const set = new Set(
                      rows
                        .map((r) => r[c])
                        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
                        .map((v) => String(v))
                    );
                    return { c, uniq: set.size };
                  })
                  .filter((x) => x.uniq >= 3 && x.uniq <= 20)
                  .sort((a, b) => a.uniq - b.uniq)
                  .slice(0, 6)
                  .map((x) => x.c);
                const chosen = ranked.length ? ranked : candidates.slice(0, 6);
                if (!chosen.length) return;

                setMessages((pv) => ([
                  ...pv,
                  ...chosen.map((category) => ({
                    id: crypto.randomUUID(),
                    role: "assistant" as const,
                    content: (
                      <BarChartPanel
                        rows={rows}
                        category={category}
                        topN={10}
                        title={`${category} frequency`}
                      />
                    ),
                  }))
                ]));
              }}
            >
              Full visualization
            </Button>
          )}
          <DownloadSummaryPDF
            selectedChartIds={selectedCharts}
            includePreview={includePreview}
            includeSummary={includeSummary}
          />
          <a href="#main" className="sr-only">Skip to content</a>
        </div>
      </header>

    <main id="main" className="container pb-28">
  <section className="flex flex-col items-stretch gap-6">
      <div className="w-full max-w-6xl mx-auto space-y-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role}>{typeof m.content === "string" ? <span>{m.content}</span> : m.content}</MessageBubble>
            ))}
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 inset-x-0 border-t bg-background/70 backdrop-blur">
        <div className="container py-3">
          <div className="w-full max-w-3xl mx-auto flex items-center gap-2">
            <Input
              placeholder="Ask for a summary, missing values, or outliers…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            />
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" id="chat-file" onChange={(e) => handleUpload(e.target.files?.[0])} />
            <label htmlFor="chat-file">
              <Button variant="outline" asChild>
                <span>Attach</span>
              </Button>
            </label>
            {uploadedFileName ? (
              <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={uploadedFileName}>
                {uploadedFileName}
              </span>
            ) : null}
            <Button variant="hero" onClick={onSend}>Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
