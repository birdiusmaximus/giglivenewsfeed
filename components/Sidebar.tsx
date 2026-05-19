'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { CATEGORIES, type Category, type KeywordFilter } from '@/lib/types';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

interface Props {
  weekNumber: number;
  dateRange: string;
  activeCategory: Category;
  onCategoryChange: (c: Category) => void;
  counts: Record<string, number>;
  totalCount: number;
  isArchive?: boolean;
  keywordFilters: KeywordFilter[];
  activeKeywordId: string | null;
  keywordCounts: Record<string, number>;
  onKeywordFilterChange: (id: string | null) => void;
  onAddCustomFilter: (label: string, keyword: string) => void;
  /** Remove any keyword filter (predefined gets dismissed; custom gets deleted) */
  onRemoveCustomFilter: (id: string) => void;
  hasDismissedDefaults?: boolean;
  onRestoreDefaults?: () => void;
  savesCount?: number;
  savesViewActive?: boolean;
  onToggleSavesView?: () => void;
  subscriberEmail?: string | null;
  onOpenSubscribe?: () => void;
}

export default function Sidebar({
  weekNumber,
  dateRange,
  activeCategory,
  onCategoryChange,
  counts,
  totalCount,
  isArchive = false,
  keywordFilters,
  activeKeywordId,
  keywordCounts,
  onKeywordFilterChange,
  onAddCustomFilter,
  onRemoveCustomFilter,
  hasDismissedDefaults = false,
  onRestoreDefaults,
  savesCount = 0,
  savesViewActive = false,
  onToggleSavesView,
  subscriberEmail,
  onOpenSubscribe,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const val = inputValue.trim();
    if (!val) return;
    onAddCustomFilter(val, val.toLowerCase());
    setInputValue('');
    inputRef.current?.blur();
  };

  return (
    <aside className="lg:w-64 lg:flex-shrink-0 bg-white dark:bg-dusk rounded-lg lg:h-full flex flex-col overflow-hidden border border-night/5 dark:border-paper/5">
      {/* Logo */}
      <div className="px-6 pt-6 pb-3 flex items-center justify-between">
        <Logo size={48} className="h-12 w-auto" />
        <ThemeToggle />
      </div>

      {/* Week marker */}
      <div className="px-6 pt-2 pb-5 border-b border-night/8 dark:border-paper/10">
        {isArchive && (
          <span className="text-flame text-[10px] uppercase tracking-brand font-black block mb-1">
            Archive
          </span>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-night/30 dark:text-paper/30 text-xs uppercase tracking-brand font-bold">
            Week
          </span>
          <span className="text-night dark:text-paper text-3xl font-black leading-none">
            {weekNumber}
          </span>
        </div>
        <p className="text-night/40 dark:text-paper/40 text-[11px] uppercase tracking-wider mt-1.5">
          {dateRange}
        </p>
      </div>

      {/* Scrollable filter area */}
      <div className="flex-1 overflow-y-auto">
        {/* My Saves button — special filter that shows bookmarked articles */}
        {onToggleSavesView && (
          <div className="px-3 pt-4 pb-1">
            <button
              onClick={onToggleSavesView}
              className={clsx(
                'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-brand transition-all text-left relative',
                savesViewActive
                  ? 'bg-flame text-paper'
                  : 'border border-night/10 dark:border-paper/10 text-night/70 dark:text-paper/70 hover:border-flame hover:text-flame'
              )}
            >
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill={savesViewActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                  <path d="M4 2.5h8a.5.5 0 0 1 .5.5v11l-4.5-3-4.5 3v-11a.5.5 0 0 1 .5-.5z" />
                </svg>
                My Saves
              </span>
              {savesCount > 0 && (
                <span className={clsx('text-[10px] font-black', savesViewActive ? 'text-paper/80' : 'text-flame')}>
                  {savesCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Categories */}
        <div className="px-6 pt-5 pb-2">
          <span className="text-night/30 dark:text-paper/30 text-[10px] uppercase tracking-brand font-black">
            Filter
          </span>
        </div>
        <nav className="px-3 pb-2">
          {CATEGORIES.map((cat) => {
            const count = cat.id === 'all' ? totalCount : counts[cat.id] ?? 0;
            const isActive = activeKeywordId === null && activeCategory === cat.id;
            const disabled = count === 0;
            return (
              <button
                key={cat.id}
                onClick={() => !disabled && onCategoryChange(cat.id)}
                disabled={disabled}
                className={clsx(
                  'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-brand transition-all text-left relative',
                  isActive
                    ? 'bg-paper dark:bg-night text-night dark:text-paper'
                    : disabled
                    ? 'text-night/15 dark:text-paper/15 cursor-not-allowed'
                    : 'text-night/55 dark:text-paper/55 hover:bg-paper/60 dark:hover:bg-night/60 hover:text-night dark:hover:text-paper'
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-flame" />
                )}
                <span className="truncate">{cat.label}</span>
                {count > 0 && (
                  <span
                    className={clsx(
                      'text-[10px] flex-shrink-0',
                      isActive ? 'text-flame font-black' : 'text-night/30 dark:text-paper/30'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Keyword filters */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-2">
          <span className="text-night/30 dark:text-paper/30 text-[10px] uppercase tracking-brand font-black">
            Keywords
          </span>
          <span className="flex-1 h-px bg-night/8 dark:bg-paper/8" />
        </div>
        <div className="px-3 pb-3">
          {keywordFilters.map((kf) => {
            const count = keywordCounts[kf.id] ?? 0;
            const isActive = activeKeywordId === kf.id;
            return (
              <div key={kf.id} className="relative group">
                <button
                  onClick={() => onKeywordFilterChange(isActive ? null : kf.id)}
                  className={clsx(
                    'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-brand transition-all text-left relative',
                    isActive
                      ? 'bg-paper dark:bg-night text-night dark:text-paper'
                      : 'text-night/55 dark:text-paper/55 hover:bg-paper/60 dark:hover:bg-night/60 hover:text-night dark:hover:text-paper'
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-flame" />
                  )}
                  <span className="truncate">{kf.label}</span>
                  {count > 0 && (
                    <span
                      className={clsx(
                        'text-[10px] flex-shrink-0',
                        isActive ? 'text-flame font-black' : 'text-night/30 dark:text-paper/30'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
                {/* Remove button — predefined gets dismissed, custom gets deleted */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveCustomFilter(kf.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-night/30 dark:text-paper/30 hover:text-paper hover:bg-flame opacity-0 group-hover:opacity-100 transition-all bg-white dark:bg-dusk"
                  title={kf.custom ? 'Remove filter' : 'Hide this filter'}
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* Custom filter input */}
          <div className="mt-2 flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Add keyword…"
              className="flex-1 min-w-0 bg-paper dark:bg-night border border-night/10 dark:border-paper/10 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-brand text-night dark:text-paper placeholder:text-night/25 dark:placeholder:text-paper/25 placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-flame transition-colors"
            />
            <button
              onClick={handleAdd}
              disabled={!inputValue.trim()}
              className="w-8 h-8 rounded-md bg-flame text-paper font-black text-base flex items-center justify-center flex-shrink-0 hover:bg-flame/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </div>

          {/* Restore dismissed defaults (only shown when there are any) */}
          {hasDismissedDefaults && onRestoreDefaults && (
            <button
              onClick={onRestoreDefaults}
              className="mt-2 text-night/40 dark:text-paper/40 hover:text-flame text-[10px] uppercase tracking-brand font-bold transition-colors"
            >
              ↺ Restore default filters
            </button>
          )}
        </div>
      </div>

      {/* Weekly digest subscribe button */}
      {onOpenSubscribe && (
        <div className="px-4 pt-3">
          <button
            onClick={onOpenSubscribe}
            className="w-full flex items-center justify-center gap-2 border border-night/15 dark:border-paper/15 rounded-md px-3 py-2.5 text-[10px] uppercase tracking-brand font-black text-night/60 dark:text-paper/60 hover:text-flame hover:border-flame transition-colors"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3.5h12v9H2zM2 4l6 4 6-4" />
            </svg>
            {subscriberEmail ? 'Manage digest' : 'Email me weekly'}
          </button>
        </div>
      )}

      {/* Footer nav */}
      <div className="px-4 py-4">
        {isArchive ? (
          <Link
            href="/"
            className="flex items-center justify-center w-full border border-night/15 dark:border-paper/15 rounded-md px-3 py-2.5 text-[10px] uppercase tracking-brand font-black text-night/60 dark:text-paper/60 hover:text-flame hover:border-flame transition-colors"
          >
            ← This Week
          </Link>
        ) : (
          <Link
            href="/archive"
            className="flex items-center justify-center w-full border border-night/15 dark:border-paper/15 rounded-md px-3 py-2.5 text-[10px] uppercase tracking-brand font-black text-night/60 dark:text-paper/60 hover:text-flame hover:border-flame transition-colors"
          >
            Archive →
          </Link>
        )}
      </div>
    </aside>
  );
}
