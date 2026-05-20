"use client";

import { useEffect, useState, useRef } from "react";
import { Upload, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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

  if (wordIdx === -1) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const word = cols[wordIdx]?.trim();
    if (!word) continue;
    rows.push({
      word: word.toLowerCase(),
      definition: "",
      translation_zh: "",
      ipa: "",
      rank: rankIdx !== -1 ? parseInt(cols[rankIdx], 10) || i : i,
      part_of_speech: posIdx !== -1 ? (cols[posIdx] || "").toLowerCase() : "",
      category:
        rankIdx !== -1 && (parseInt(cols[rankIdx], 10) || i) <= 3000
          ? "daily conversation"
          : "academic",
      is_custom: false,
      example_sentences: [],
      synonyms: [],
      antonyms: [],
      collocations: [],
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
            <CardTitle>Import Data</CardTitle>
            <CardDescription>
              Upload a CoCA word list CSV file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="gap-2"
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {importing ? "Importing..." : "Upload CSV"}
            </Button>
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
