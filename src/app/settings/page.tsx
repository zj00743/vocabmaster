"use client";

import { useEffect, useState, useRef } from "react";
import {
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AppShell } from "@/components/app-shell";
import { toast } from "sonner";
import { getSettings, saveSettings } from "@/lib/settings";
import { CATEGORIES } from "@/lib/types";
import type { UserSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && c === delimiter) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out.map((s) => s.replace(/^"|"$/g, ""));
}

function parseCSV(content: string) {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const first = lines[0];
  const tabCount = (first.match(/\t/g) ?? []).length;
  const commaCount = (first.match(/,/g) ?? []).length;
  const delimiter = tabCount > commaCount ? "\t" : ",";

  const headerLine = lines[0].toLowerCase();
  const headers = parseCsvLine(headerLine, delimiter).map((h) =>
    h.trim().replace(/"/g, "")
  );

  const rankIdx = headers.findIndex((h) => h.includes("rank") || h === "#");
  const wordIdx = headers.findIndex(
    (h) => h.includes("word") || h === "lemma"
  );
  const posIdx = headers.findIndex(
    (h) => h.includes("pos") || h.includes("part")
  );
  const catIdx = headers.findIndex((h) => h === "category");
  const defIdx = headers.findIndex((h) => h.includes("definition"));
  const zhIdx = headers.findIndex(
    (h) => h.includes("translation") || h === "zh"
  );
  const ipaIdx = headers.findIndex((h) => h === "ipa");
  const synIdx = headers.findIndex((h) => h.includes("synonym"));
  const antIdx = headers.findIndex((h) => h.includes("antonym"));
  const colIdx = headers.findIndex((h) => h.includes("collocation"));
  const exIdx = headers.findIndex(
    (h) => h.includes("example") || h.includes("sentence")
  );
  const customIdx = headers.findIndex((h) => h.includes("custom"));

  const splitList = (raw: string | undefined) =>
    (raw ?? "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);

  if (wordIdx === -1) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const word = cols[wordIdx]?.trim();
    if (!word) continue;
    const rank =
      rankIdx !== -1 ? parseInt(cols[rankIdx], 10) || null : null;
    const isCustom =
      customIdx !== -1
        ? cols[customIdx]?.toLowerCase() === "true"
        : false;
    rows.push({
      word,
      definition: defIdx !== -1 ? (cols[defIdx] ?? "") : "",
      translation_zh: zhIdx !== -1 ? (cols[zhIdx] ?? "") : "",
      ipa: ipaIdx !== -1 ? (cols[ipaIdx] ?? "") : "",
      rank,
      part_of_speech: posIdx !== -1 ? (cols[posIdx] || "").toLowerCase() : "",
      category:
        catIdx !== -1
          ? cols[catIdx] || null
          : rank != null && rank <= 3000
            ? "daily conversation"
            : "academic",
      is_custom: isCustom,
      example_sentences: exIdx !== -1 ? splitList(cols[exIdx]) : [],
      synonyms: synIdx !== -1 ? splitList(cols[synIdx]) : [],
      antonyms: antIdx !== -1 ? splitList(cols[antIdx]) : [],
      collocations: colIdx !== -1 ? splitList(cols[colIdx]) : [],
    });
  }
  return rows;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [supabaseDetail, setSupabaseDetail] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState<
    "all" | "corpus" | "my_words" | null
  >(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(getSettings());
    checkSupabase();
  }, []);

  async function checkSupabase() {
    setSupabaseStatus("checking");
    setSupabaseDetail(null);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = (await res.json()) as {
        connected?: boolean;
        message?: string;
        hint?: string;
      };
      if (data.connected) {
        setSupabaseStatus("connected");
        return;
      }
      setSupabaseStatus("disconnected");
      const parts = [data.message, data.hint].filter(Boolean);
      setSupabaseDetail(parts.length ? parts.join(" ") : "Unknown error from /api/health.");
    } catch (e) {
      setSupabaseStatus("disconnected");
      setSupabaseDetail(
        e instanceof Error ? e.message : "Network error — is npm run dev running?"
      );
    }
  }

  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    const updated = saveSettings({ [key]: value });
    setSettings(updated);
    toast.success("Settings saved");
  };

  const toggleCategory = (cat: string) => {
    if (!settings) return;
    const current = settings.categories;
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    updateSetting("categories", next);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const content = await file.text();
      const words = parseCSV(content);

      if (words.length === 0) {
        toast.error("No words found in the CSV file");
        return;
      }

      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words }),
      });

      if (res.ok) {
        const data = await res.json();
        if ((data.imported ?? 0) === 0 && (data.errors ?? 0) > 0) {
          toast.error(
            data.lastError
              ? `Import failed: ${data.lastError}${data.hint ? ` — ${data.hint}` : ""}`
              : data.hint ?? "Import failed — check CSV format and Supabase logs."
          );
        } else {
          toast.success(`Imported ${data.imported ?? 0} words`);
          if ((data.errors ?? 0) > 0) {
            toast.message(`${data.errors} rows skipped (see server logs)`);
          }
        }
      } else {
        toast.error("Import failed");
      }
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownloadCsv = async (
    scope: "all" | "corpus" | "my_words"
  ) => {
    setExporting(scope);
    try {
      const res = await fetch(`/api/export/csv?scope=${scope}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(err?.error ?? "Download failed");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] ?? `vocab-${scope}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch {
      toast.error("Download failed");
    } finally {
      setExporting(null);
    }
  };

  const handleClearProgress = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    try {
      const res = await fetch("/api/progress", { method: "DELETE" });
      if (res.ok) {
        toast.success("Progress cleared");
      } else {
        toast.error("Failed to clear progress");
      }
    } catch {
      toast.error("Failed to clear progress");
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  if (!settings) return null;

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl mx-auto w-full space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Daily New Words</CardTitle>
            <CardDescription>
              How many new words to introduce each day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={String(settings.daily_new_words)}
              onValueChange={(v) => updateSetting("daily_new_words", Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} words
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Preferences</CardTitle>
            <CardDescription>
              Select categories you&apos;re interested in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const active = settings.categories.includes(cat);
                return (
                  <Badge
                    key={cat}
                    variant={active ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer capitalize transition-colors",
                      active && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vocabulary CSV</CardTitle>
            <CardDescription>
              Import a CoCA-style list or download your vocabulary from the
              database (same columns — you can edit and re-upload).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,text/csv"
              onChange={handleImport}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={importing || exporting !== null}
                className="gap-2"
              >
                {importing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {importing ? "Importing..." : "Upload CSV"}
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Download
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 justify-start"
                  disabled={importing || exporting !== null}
                  onClick={() => void handleDownloadCsv("corpus")}
                >
                  {exporting === "corpus" ? (
                    <Loader2 className="size-4 animate-spin shrink-0" />
                  ) : (
                    <Download className="size-4 shrink-0" />
                  )}
                  CoCA corpus
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 justify-start"
                  disabled={importing || exporting !== null}
                  onClick={() => void handleDownloadCsv("my_words")}
                >
                  {exporting === "my_words" ? (
                    <Loader2 className="size-4 animate-spin shrink-0" />
                  ) : (
                    <Download className="size-4 shrink-0" />
                  )}
                  My Words
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 justify-start"
                  disabled={importing || exporting !== null}
                  onClick={() => void handleDownloadCsv("all")}
                >
                  {exporting === "all" ? (
                    <Loader2 className="size-4 animate-spin shrink-0" />
                  ) : (
                    <Download className="size-4 shrink-0" />
                  )}
                  All vocabulary
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Columns: rank, word, part_of_speech, category, definition,
                translation_zh, ipa, and more. Lists use{" "}
                <span className="font-mono">|</span> between items.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Connection Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {supabaseStatus === "checking" ? (
                <div className="size-3 rounded-full bg-muted-foreground animate-pulse" />
              ) : supabaseStatus === "connected" ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <AlertCircle className="size-4 text-destructive" />
              )}
              <span className="text-sm">
                Supabase:{" "}
                <span
                  className={cn(
                    "font-medium",
                    supabaseStatus === "connected"
                      ? "text-emerald-600"
                      : supabaseStatus === "disconnected"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  )}
                >
                  {supabaseStatus === "checking"
                    ? "Checking..."
                    : supabaseStatus === "connected"
                      ? "Connected"
                      : "Disconnected"}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void checkSupabase()}
                disabled={supabaseStatus === "checking"}
              >
                Retry check
              </Button>
            </div>
            {supabaseStatus === "disconnected" && supabaseDetail && (
              <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-destructive/40 pl-3">
                {supabaseDetail}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              This action cannot be undone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleClearProgress}
              disabled={clearing}
              className="gap-2"
            >
              <Trash2 className="size-4" />
              {confirmClear ? "Confirm Clear" : "Clear All Progress"}
            </Button>
            {confirmClear && (
              <p className="text-xs text-destructive mt-2">
                Click again to confirm. This will reset all learning progress.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
