"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Briefcase,
  FlaskConical,
  Stethoscope,
  Palette,
  Cpu,
  MessageCircle,
  Scale,
  Landmark,
  Trophy,
  Music,
  UtensilsCrossed,
  Plane,
  BookOpen,
  Leaf,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AppShell } from "@/components/app-shell";
import { CATEGORIES } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

const categoryIcons: Record<string, LucideIcon> = {
  academic: GraduationCap,
  business: Briefcase,
  science: FlaskConical,
  medicine: Stethoscope,
  art: Palette,
  technology: Cpu,
  "daily conversation": MessageCircle,
  law: Scale,
  politics: Landmark,
  sports: Trophy,
  music: Music,
  food: UtensilsCrossed,
  travel: Plane,
  education: BookOpen,
  nature: Leaf,
};

interface CategoryCount {
  category: string;
  count: number;
}

export default function CategoriesPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      try {
        /** Count saved study list only (`learning_progress`), not full dictionary rows. */
        const res = await fetch("/api/categories?in_my_words=1");
        if (res.ok) {
          const data: CategoryCount[] = await res.json();
          const map: Record<string, number> = {};
          data.forEach((d) => {
            map[d.category] = d.count;
          });
          setCounts(map);
        }
      } catch {
        // API not available
      }
    }
    load();
  }, []);

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl mx-auto w-full space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Numbers show how many{" "}
          <span className="font-medium text-foreground/85">saved</span> words
          you have in My Words under each topic — not words in the full
          browsing dictionary.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => {
            const Icon = categoryIcons[cat] ?? BookOpen;
            const count = counts[cat] ?? 0;
            return (
              <Link
                key={cat}
                href={`/words?category=${encodeURIComponent(cat)}&in_my_words=1`}
              >
                <Card
                  size="sm"
                  className="hover:ring-primary/20 transition-shadow cursor-pointer h-full"
                >
                  <CardContent className="flex flex-col items-center text-center gap-2 py-2">
                    <Icon className="size-7 text-primary/70" />
                    <div>
                      <p className="text-sm font-medium capitalize">{cat}</p>
                      <p className="text-xs text-muted-foreground">
                        {count} {count === 1 ? "word" : "words"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
