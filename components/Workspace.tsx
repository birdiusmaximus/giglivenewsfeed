'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Article, Category, KeywordFilter } from '@/lib/types';
import { KEYWORD_FILTERS } from '@/lib/types';
import { loadSourcePrefs, saveSourcePrefs, type SourcePrefs } from '@/lib/sourceStorage';
import Sidebar from './Sidebar';
import ArticleList from './ArticleList';
import ArticlePreview from './ArticlePreview';
import SourceSelector from './SourceSelector';

interface Props {
  articles: Article[];
  weekNumber: number;
  dateRange: string;
  isArchive?: boolean;
}

export default function Workspace({
  articles,
  weekNumber,
  dateRange,
  isArchive = false,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [activeKeywordId, setActiveKeywordId] = useState<string | null>(null);
  const [customFilters, setCustomFilters] = useState<KeywordFilter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Source preferences (built-in toggles + custom feeds)
  const [sourcePrefs, setSourcePrefs] = useState<SourcePrefs>({ disabledIds: [], custom: [] });
  const [sourceSelectorOpen, setSourceSelectorOpen] = useState(false);
  const [customArticles, setCustomArticles] = useState<Article[]>([]);
  const [customLoading, setCustomLoading] = useState(false);

  // Hydrate prefs from localStorage on mount
  useEffect(() => {
    setSourcePrefs(loadSourcePrefs());
  }, []);

  // Persist prefs whenever they change (skip the initial empty default)
  const handlePrefsChange = (next: SourcePrefs) => {
    setSourcePrefs(next);
    saveSourcePrefs(next);
  };

  // Fetch articles from custom sources whenever the custom list changes
  useEffect(() => {
    if (sourcePrefs.custom.length === 0) {
      setCustomArticles([]);
      return;
    }
    let cancelled = false;
    setCustomLoading(true);
    fetch('/api/sources/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeds: sourcePrefs.custom }),
    })
      .then((r) => r.json())
      .then((data: { articles?: Article[] }) => {
        if (!cancelled) setCustomArticles(Array.isArray(data.articles) ? data.articles : []);
      })
      .catch(() => {
        if (!cancelled) setCustomArticles([]);
      })
      .finally(() => {
        if (!cancelled) setCustomLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourcePrefs.custom]);

  // Merge built-in (filtered to enabled sources) + custom, sort newest first
  const mergedArticles = useMemo(() => {
    const builtIn = articles.filter((a) => !sourcePrefs.disabledIds.includes(a.source));
    const all = [...builtIn, ...customArticles];
    // Dedupe by id in case a custom source overlaps with a built-in
    const seen = new Set<string>();
    const deduped = all.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    deduped.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    return deduped;
  }, [articles, customArticles, sourcePrefs.disabledIds]);

  const allKeywordFilters = useMemo(
    () => [...KEYWORD_FILTERS, ...customFilters],
    [customFilters]
  );

  const filtered = useMemo(() => {
    if (activeKeywordId) {
      const kf = allKeywordFilters.find((f) => f.id === activeKeywordId);
      if (kf) {
        return mergedArticles.filter((a) => {
          const text = `${a.title} ${a.description}`.toLowerCase();
          return kf.keywords.some((kw) => text.includes(kw.toLowerCase()));
        });
      }
    }
    return activeCategory === 'all'
      ? mergedArticles
      : mergedArticles.filter((a) => a.category === activeCategory);
  }, [mergedArticles, activeCategory, activeKeywordId, allKeywordFilters]);

  const selectedArticle = useMemo(() => {
    if (selectedId) {
      const found = filtered.find((a) => a.id === selectedId);
      if (found) return found;
    }
    return filtered[0] ?? null;
  }, [filtered, selectedId]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of mergedArticles) {
      map[a.category] = (map[a.category] ?? 0) + 1;
    }
    return map;
  }, [mergedArticles]);

  const keywordCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const kf of allKeywordFilters) {
      map[kf.id] = mergedArticles.filter((a) => {
        const text = `${a.title} ${a.description}`.toLowerCase();
        return kf.keywords.some((kw) => text.includes(kw.toLowerCase()));
      }).length;
    }
    return map;
  }, [mergedArticles, allKeywordFilters]);

  const handleCategoryChange = (c: Category) => {
    setActiveCategory(c);
    setActiveKeywordId(null);
    setSelectedId(null);
  };

  const handleKeywordFilterChange = (id: string | null) => {
    setActiveKeywordId(id);
    setActiveCategory('all');
    setSelectedId(null);
  };

  const handleAddCustomFilter = (label: string, keyword: string) => {
    const id = `custom-${Date.now()}`;
    setCustomFilters((prev) => [
      ...prev,
      { id, label, keywords: [keyword], custom: true },
    ]);
    handleKeywordFilterChange(id);
  };

  const handleRemoveCustomFilter = (id: string) => {
    setCustomFilters((prev) => prev.filter((f) => f.id !== id));
    if (activeKeywordId === id) setActiveKeywordId(null);
  };

  return (
    <div className="lg:h-screen lg:overflow-hidden bg-paper dark:bg-night transition-colors">
      <div className="lg:h-full flex flex-col lg:flex-row gap-3 lg:gap-4 p-3 lg:p-4">
        <Sidebar
          weekNumber={weekNumber}
          dateRange={dateRange}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          counts={counts}
          totalCount={mergedArticles.length}
          isArchive={isArchive}
          keywordFilters={allKeywordFilters}
          activeKeywordId={activeKeywordId}
          keywordCounts={keywordCounts}
          onKeywordFilterChange={handleKeywordFilterChange}
          onAddCustomFilter={handleAddCustomFilter}
          onRemoveCustomFilter={handleRemoveCustomFilter}
        />
        <ArticleList
          articles={filtered}
          selectedId={selectedArticle?.id ?? null}
          onSelect={setSelectedId}
          onOpenSourceSelector={() => setSourceSelectorOpen(true)}
          customLoading={customLoading}
        />
        <ArticlePreview article={selectedArticle} />
      </div>

      <SourceSelector
        open={sourceSelectorOpen}
        onClose={() => setSourceSelectorOpen(false)}
        prefs={sourcePrefs}
        onChange={handlePrefsChange}
      />
    </div>
  );
}
