"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MyWordsList } from "@/components/my-words-list";

function ListFallback() {
  return (
    <div className="p-4 text-sm text-muted-foreground animate-pulse">
      Loading…
    </div>
  );
}

function WordsLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const detailMatch = pathname.match(/^\/words\/([^/]+)$/);
  const editMatch = pathname.match(/^\/words\/([^/]+)\/edit(?:\/|$)/);
  const selectedWordId = detailMatch?.[1] ?? editMatch?.[1];
  const isListPage = pathname === "/words";
  const panelOpen = Boolean(selectedWordId);

  return (
    <AppShell>
      <div className="flex h-dvh min-h-0 overflow-hidden">
        {isListPage && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Suspense fallback={<ListFallback />}>
              <MyWordsList variant="page" />
            </Suspense>
          </div>
        )}

        {panelOpen && (
          <>
            <aside className="hidden md:flex md:h-full md:min-h-0 md:w-[min(520px,48vw)] md:max-w-2xl md:shrink-0 md:flex-col md:border-r md:overflow-hidden">
              <Suspense fallback={<ListFallback />}>
                <MyWordsList
                  variant="sidebar"
                  selectedWordId={selectedWordId}
                />
              </Suspense>
            </aside>
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden max-md:hidden">
              {children}
            </div>
          </>
        )}

        {!isListPage && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:hidden">
            {children}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function WordsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WordsLayoutInner>{children}</WordsLayoutInner>;
}
