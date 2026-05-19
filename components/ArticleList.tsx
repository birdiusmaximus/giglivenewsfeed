import { Fragment, useMemo } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Article } from '@/lib/types';
import { timeAgo } from '@/lib/weekUtils';
import BookmarkButton from './BookmarkButton';

interface Props {
  articles: Article[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenSourceSelector?: () => void;
  customLoading?: boolean;
  bookmarkIds?: Set<string>;
  onToggleBookmark?: (article: Article) => void;
  emptyMessage?: string;
}

export default function ArticleList({
  articles,
  selectedId,
  onSelect,
  onOpenSourceSelector,
  customLoading,
  bookmarkIds,
  onToggleBookmark,
  emptyMessage,
}: Props) {
  const rows = useMemo(() => {
    let prevDay = '';
    return articles.map((article) => {
      const date = new Date(article.publishedAt);
      const dayKey = format(date, 'yyyy-MM-dd');
      const showDay = dayKey !== prevDay;
      prevDay = dayKey;
      return {
        article,
        date,
        showDay,
        // Friendly section header: "Tuesday · May 19"
        dayLabel: format(date, 'EEEE · MMMM d'),
      };
    });
  }, [articles]);

  return (
    <section className="lg:w-[440px] lg:flex-shrink-0 bg-white dark:bg-dusk rounded-lg lg:h-full flex flex-col overflow-hidden border border-night/5 dark:border-paper/5">
      {/* Header */}
      <div className="px-6 py-5 border-b border-night/8 dark:border-paper/10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-6">
            <span className="text-night dark:text-paper font-black text-base relative pb-1">
              Latest
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-flame rounded-full" />
            </span>
          </div>
          <div className="flex items-center gap-3">
            {customLoading && (
              <span className="text-[10px] uppercase tracking-brand font-black text-flame animate-pulse">
                Loading…
              </span>
            )}
            {onOpenSourceSelector && (
              <button
                onClick={onOpenSourceSelector}
                className="text-[10px] uppercase tracking-brand font-black text-night/60 dark:text-paper/60 border border-night/15 dark:border-paper/15 hover:border-flame hover:text-flame px-3 py-1.5 rounded-md transition-colors"
              >
                Sources
              </button>
            )}
            <span className="text-[10px] uppercase tracking-brand font-black text-night/40 dark:text-paper/40">
              {articles.length === 0
                ? '0 results'
                : `${articles.length} ${articles.length === 1 ? 'article' : 'articles'}`}
            </span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {articles.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-night/30 dark:text-paper/30 text-xs leading-relaxed font-bold max-w-[280px] mx-auto">
              {emptyMessage ?? 'No articles in this category'}
            </p>
          </div>
        ) : (
          <ul>
            {rows.map(({ article, showDay, dayLabel }, idx) => {
              const isSelected = article.id === selectedId;
              const isFirstOverall = idx === 0;
              return (
                <Fragment key={article.id}>
                  {/* Day section header — replaces the per-row day marker.
                      Renders before the first article of each day; thin line
                      runs to the right edge to create a clean visual break. */}
                  {showDay && (
                    <li
                      aria-hidden
                      className={clsx(
                        'px-5 pb-2 flex items-center gap-3',
                        isFirstOverall ? 'pt-4' : 'pt-7'
                      )}
                    >
                      <span className="text-[10px] uppercase tracking-brand font-black text-night/40 dark:text-paper/40 flex-shrink-0">
                        {dayLabel}
                      </span>
                      <span className="flex-1 h-px bg-night/10 dark:bg-paper/10" />
                    </li>
                  )}

                  <li
                    className={clsx(
                      'relative',
                      // Border between articles WITHIN the same day.
                      // No border immediately under a day header (the header
                      // itself is the visual separator).
                      !showDay && 'border-t border-night/6 dark:border-paper/8'
                    )}
                  >
                    <button
                      onClick={() => onSelect(article.id)}
                      className={clsx(
                        'w-full text-left px-5 py-4 flex gap-3 items-start transition-colors group',
                        isSelected
                          ? 'bg-paper dark:bg-night'
                          : 'hover:bg-paper/50 dark:hover:bg-night/40'
                      )}
                    >
                      {isSelected && (
                        <span className="absolute left-0 top-3 bottom-3 w-0.5 bg-flame rounded-r" />
                      )}

                      {/* Thumbnail */}
                      <div
                        className="w-14 h-14 rounded-md flex-shrink-0 overflow-hidden bg-night/5 dark:bg-paper/5"
                        style={{
                          boxShadow: `inset 0 2px 0 ${article.sourceColor}`,
                        }}
                      >
                        {article.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={article.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ backgroundColor: article.sourceColor + '18' }}
                          >
                            <span
                              className="text-[10px] font-black uppercase tracking-wider"
                              style={{ color: article.sourceColor }}
                            >
                              {article.sourceName.slice(0, 2)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-8">
                        <p className="text-[10px] uppercase tracking-wider font-black mb-1 truncate text-night/35 dark:text-paper/35">
                          {timeAgo(article.publishedAt)}
                        </p>
                        <h3
                          className={clsx(
                            'font-bold text-sm leading-snug line-clamp-2 transition-colors',
                            isSelected
                              ? 'text-night dark:text-paper'
                              : 'text-night/85 dark:text-paper/85 group-hover:text-night dark:group-hover:text-paper'
                          )}
                        >
                          {article.title}
                        </h3>
                        <p
                          className="text-xs mt-1.5 font-bold uppercase tracking-wider truncate"
                          style={{ color: article.sourceColor }}
                        >
                          by {article.sourceName}
                        </p>
                      </div>

                      {/* Arrow indicator pointing to preview */}
                      {isSelected && (
                        <div
                          aria-hidden
                          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[7px] w-3 h-3 bg-paper dark:bg-night rotate-45 border-r border-t border-night/8 dark:border-paper/10 hidden lg:block"
                        />
                      )}
                    </button>

                    {/* Bookmark — outside the row button to avoid invalid nested buttons */}
                    {bookmarkIds && onToggleBookmark && (
                      <div className="absolute right-3 top-3 z-10">
                        <BookmarkButton
                          size="sm"
                          saved={bookmarkIds.has(article.id)}
                          onToggle={() => onToggleBookmark(article)}
                        />
                      </div>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
