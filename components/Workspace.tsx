'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Article, Category, KeywordFilter } from '@/lib/types';
import { KEYWORD_FILTERS } from '@/lib/types';
import { loadSourcePrefs, saveSourcePrefs, type SourcePrefs } from '@/lib/sourceStorage';
import {
  loadKeywordPrefs,
  saveKeywordPrefs,
  matchesKeyword,
  type KeywordFilterPrefs,
} from '@/lib/keywordStorage';
import {
  loadBookmarks,
  saveBookmarks,
  loadSubscriberEmail,
  saveSubscriberEmail,
  syncBookmarksToServer,
  type BookmarkedArticle,
} from '@/lib/bookmarkStorage';
import Sidebar from './Sidebar';
import ArticleList from './ArticleList';
import ArticlePreview from './ArticlePreview';
import SourceSelector from './SourceSelector';
import SubscribeModal from './SubscribeModal';

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
  const [keywordPrefs, setKeywordPrefs] = useState<KeywordFilterPrefs>({
    customFilters: [],
    dismissedDefaultIds: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Source preferences (built-in toggles + custom feeds)
  const [sourcePrefs, setSourcePrefs] = useState<SourcePrefs>({ disabledIds: [], custom: [] });
  const [sourceSelectorOpen, setSourceSelectorOpen] = useState(false);
  const [customArticles, setCustomArticles] = useState<Article[]>([]);
  const [customLoading, setCustomLoading] = useState(false);

  // Bookmarks + email digest subscription
  const [bookmarks, setBookmarks] = useState<BookmarkedArticle[]>([]);
  const [subscriberEmail, setSubscriberEmail] = useState<string | null>(null);
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [savesViewActive, setSavesViewActive] = useState(false);

  // Hydrate prefs from localStorage on mount
  useEffect(() => {
    setSourcePrefs(loadSourcePrefs());
    setKeywordPrefs(loadKeywordPrefs());
    setBookmarks(loadBookmarks());
    setSubscriberEmail(loadSubscriberEmail());
  }, []);

  const toggleBookmark = (article: Article) => {
    const exists = bookmarks.some((b) => b.id === article.id);
    const next = exists
      ? bookmarks.filter((b) => b.id !== article.id)
      : [{ ...article, bookmarkedAt: new Date().toISOString() }, ...bookmarks];
    setBookmarks(next);
    saveBookmarks(next);
    // Best-effort sync to digest server if user has subscribed
    void syncBookmarksToServer(subscriberEmail, next);
  };

  const bookmarkIds = useMemo(() => new Set(bookmarks.map((b) => b.id)), [bookmarks]);

  const updateKeywordPrefs = (next: KeywordFilterPrefs) => {
    setKeywordPrefs(next);
    saveKeywordPrefs(next);
  };

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

  const allKeywordFilters = useMemo(() => {
    // Predefined filters minus any the user has dismissed, plus their custom ones
    const activeDefaults = KEYWORD_FILTERS.filter(
      (f) => !keywordPrefs.dismissedDefaultIds.includes(f.id)
    );
    return [...activeDefaults, ...keywordPrefs.customFilters];
  }, [keywordPrefs]);

  const filtered = useMemo(() => {
    // Saves view trumps all other filters
    if (savesViewActive) return bookmarks;

    if (activeKeywordId) {
      const kf = allKeywordFilters.find((f) => f.id === activeKeywordId);
      if (kf) {
        return mergedArticles.filter((a) => {
          const text = `${a.title} ${a.description}`;
          return kf.keywords.some((kw) => matchesKeyword(text, kw));
        });
      }
    }
    return activeCategory === 'all'
      ? mergedArticles
      : mergedArticles.filter((a) => a.category === activeCategory);
  }, [mergedArticles, activeCategory, activeKeywordId, allKeywordFilters, savesViewActive, bookmarks]);

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
        const text = `${a.title} ${a.description}`;
        return kf.keywords.some((kw) => matchesKeyword(text, kw));
      }).length;
    }
    return map;
  }, [mergedArticles, allKeywordFilters]);

  const handleCategoryChange = (c: Category) => {
    setActiveCategory(c);
    setActiveKeywordId(null);
    setSavesViewActive(false);
    setSelectedId(null);
  };

  const handleKeywordFilterChange = (id: string | null) => {
    setActiveKeywordId(id);
    setActiveCategory('all');
    setSavesViewActive(false);
    setSelectedId(null);
  };

  const handleSavesViewToggle = () => {
    const next = !savesViewActive;
    setSavesViewActive(next);
    if (next) {
      setActiveCategory('all');
      setActiveKeywordId(null);
    }
    setSelectedId(null);
  };

  const handleSubscribed = (email: string) => {
    setSubscriberEmail(email);
    saveSubscriberEmail(email);
  };

  const handleUnsubscribed = () => {
    setSubscriberEmail(null);
    saveSubscriberEmail(null);
  };

  const handleAddCustomFilter = (label: string, keyword: string) => {
    const id = `custom-${Date.now()}`;
    const newFilter: KeywordFilter = { id, label, keywords: [keyword], custom: true };
    updateKeywordPrefs({
      ...keywordPrefs,
      customFilters: [...keywordPrefs.customFilters, newFilter],
    });
    setActiveKeywordId(id);
    setActiveCategory('all');
    setSelectedId(null);
  };

  /**
   * Remove a keyword filter. For predefined filters this records a dismissal
   * (so they don't reappear next reload). For custom filters it deletes them.
   */
  const handleRemoveCustomFilter = (id: string) => {
    const isDefault = KEYWORD_FILTERS.some((f) => f.id === id);
    if (isDefault) {
      updateKeywordPrefs({
        ...keywordPrefs,
        dismissedDefaultIds: [...keywordPrefs.dismissedDefaultIds, id],
      });
    } else {
      updateKeywordPrefs({
        ...keywordPrefs,
        customFilters: keywordPrefs.customFilters.filter((f) => f.id !== id),
      });
    }
    if (activeKeywordId === id) setActiveKeywordId(null);
  };

  const hasDismissedDefaults = keywordPrefs.dismissedDefaultIds.length > 0;

  /** Reset all dismissed defaults so the predefined filters reappear */
  const handleRestoreDefaults = () => {
    updateKeywordPrefs({ ...keywordPrefs, dismissedDefaultIds: [] });
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
          hasDismissedDefaults={hasDismissedDefaults}
          onRestoreDefaults={handleRestoreDefaults}
          savesCount={bookmarks.length}
          savesViewActive={savesViewActive}
          onToggleSavesView={handleSavesViewToggle}
          subscriberEmail={subscriberEmail}
          onOpenSubscribe={() => setSubscribeModalOpen(true)}
        />
        <ArticleList
          articles={filtered}
          selectedId={selectedArticle?.id ?? null}
          onSelect={setSelectedId}
          onOpenSourceSelector={() => setSourceSelectorOpen(true)}
          customLoading={customLoading}
          bookmarkIds={bookmarkIds}
          onToggleBookmark={toggleBookmark}
          emptyMessage={savesViewActive ? 'No saved articles yet — click the bookmark icon on any article to save it.' : undefined}
        />
        <ArticlePreview
          article={selectedArticle}
          isBookmarked={selectedArticle ? bookmarkIds.has(selectedArticle.id) : false}
          onToggleBookmark={selectedArticle ? () => toggleBookmark(selectedArticle) : undefined}
        />
      </div>

      <SourceSelector
        open={sourceSelectorOpen}
        onClose={() => setSourceSelectorOpen(false)}
        prefs={sourcePrefs}
        onChange={handlePrefsChange}
      />
      <SubscribeModal
        open={subscribeModalOpen}
        onClose={() => setSubscribeModalOpen(false)}
        currentEmail={subscriberEmail}
        bookmarks={bookmarks}
        onSubscribed={handleSubscribed}
        onUnsubscribed={handleUnsubscribed}
      />
    </div>
  );
}
