"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Flame, Target, Brain, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MyWordListCard } from "@/components/my-word-list-card";
import { AppShell } from "@/components/app-shell";
import type { DailyStats, WordWithProgress } from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [recentWords, setRecentWords] = useState<WordWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, wordsRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/words?in_my_words=1&limit=5&sort=added"),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (wordsRes.ok) {
          const data = await wordsRes.json();
          const fetched = Array.isArray(data) ? data : (data.data ?? data.words ?? []);
          setRecentWords(fetched);
        }
      } catch {
        // API not available yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const statCards = [
    {
      label: "Due Today",
      value: stats?.due_today ?? 0,
      icon: Target,
      color: "text-orange-500",
    },
    {
      label: "Reviewed Today",
      value: stats?.reviewed_today ?? 0,
      icon: BookOpen,
      color: "text-emerald-500",
    },
    {
      label: "Total Learned",
      value: stats?.total_learned ?? 0,
      icon: Brain,
      color: "text-blue-500",
    },
    {
      label: "Retention",
      value: `${stats?.retention_rate ?? 0}%`,
      icon: TrendingUp,
      color: "text-purple-500",
    },
  ];

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting()}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
        </div>

        {(stats?.streak ?? 0) > 0 && (
          <div className="flex items-center gap-2 text-orange-500">
            <Flame className="size-5" />
            <span className="font-semibold text-sm">
              {stats!.streak} day streak
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} size="sm">
              <CardContent className="flex items-center gap-3">
                <div className={`${color} shrink-0`}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {(stats?.due_today ?? 0) > 0 && (
          <Link href="/review">
            <Button className="w-full h-12 text-base font-semibold">
              <BookOpen className="size-5 mr-2" />
              Start Review ({stats!.due_today} cards)
            </Button>
          </Link>
        )}

        {recentWords.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Recently Added
            </h2>
            <div className="space-y-3">
              {recentWords.map((w) => (
                <MyWordListCard key={w.id} word={w} />
              ))}
            </div>
          </div>
        )}

        {!loading && !stats && (
          <div className="text-center py-12 space-y-3">
            <Brain className="size-12 mx-auto text-muted-foreground/30" />
            <h2 className="text-lg font-medium">Welcome to VocabMaster</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Start by searching and adding words to your collection.
            </p>
            <Link href="/search">
              <Button variant="outline">Search Words</Button>
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
