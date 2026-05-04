'use client';

import { useState, useEffect } from 'react';
import { CATEGORIES, type Article } from '@/lib/types';
import { timeAgo } from '@/lib/weekUtils';
import { format } from 'date-fns';

interface Props {
  article: Article | null;
}

export default function ArticlePreview({ article }: Props) {
  const [imageFailed, setImageFailed] = useState(false);

  // Reset image error state whenever the selected article changes
  useEffect(() => {
    setImageFailed(false);
  }, [article?.id]);

  if (!article) {
    return (
      <section className="flex-1 bg-white dark:bg-dusk rounded-lg lg:h-full flex items-center justify-center min-h-[400px] border border-night/5 dark:border-paper/5">
        <div className="text-center px-6">
          <div className="w-3 h-3 rounded-full bg-flame/40 mx-auto mb-4" />
          <p className="text-night/30 dark:text-paper/30 text-xs uppercase tracking-brand font-black">
            Select an article to preview
          </p>
        </div>
      </section>
    );
  }

  const categoryLabel =
    CATEGORIES.find((c) => c.id === article.category)?.label ?? article.category;
  const initials = article.sourceName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const fullDate = format(new Date(article.publishedAt), 'EEEE, MMMM d');

  const showImage = article.imageUrl && !imageFailed;

  return (
    <section className="flex-1 bg-white dark:bg-dusk rounded-lg lg:h-full flex flex-col overflow-hidden min-h-[500px] border border-night/5 dark:border-paper/5">
      {/* Top bar */}
      <div className="flex items-center justify-between px-7 py-5 border-b border-night/8 dark:border-paper/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black text-paper flex-shrink-0"
            style={{ backgroundColor: article.sourceColor }}
          >
            {initials}
          </span>
          <div className="leading-tight">
            <span className="text-night/40 dark:text-paper/40 text-xs">via </span>
            <span className="text-flame text-sm font-black">{article.sourceName}</span>
          </div>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-black uppercase tracking-brand text-night/60 dark:text-paper/60 border border-night/15 dark:border-paper/15 hover:border-flame hover:text-flame px-3.5 py-2 rounded-md transition-colors"
        >
          Open ↗
        </a>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-7">
          {/* Hero image */}
          {showImage ? (
            <div className="aspect-[16/10] rounded-lg overflow-hidden bg-night/5 dark:bg-paper/5 mb-6 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.imageUrl}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
              />
              <div
                aria-hidden
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: article.sourceColor }}
              />
            </div>
          ) : (
            <div
              className="aspect-[16/10] rounded-lg mb-6 relative overflow-hidden flex flex-col justify-between p-7"
              style={{
                background: `linear-gradient(135deg, ${article.sourceColor}, ${article.sourceColor}dd 60%, ${article.sourceColor}88)`,
              }}
            >
              {/* GIG-style decorative gradient arcs */}
              <div
                aria-hidden
                className="absolute -right-20 -top-20 w-64 h-64 rounded-full pointer-events-none"
                style={{ border: '1.5px solid rgba(255,255,255,0.35)' }}
              />
              <div
                aria-hidden
                className="absolute -right-10 -top-10 w-44 h-44 rounded-full pointer-events-none"
                style={{ border: '1px solid rgba(255,255,255,0.25)' }}
              />
              {/* Top: source label */}
              <div className="relative">
                <p className="text-paper/70 text-[10px] uppercase tracking-brand font-black">
                  {article.sourceName}
                </p>
              </div>
              {/* Bottom: large category text + flame dot */}
              <div className="relative">
                <div className="flex items-end justify-between">
                  <span className="text-paper text-3xl sm:text-4xl font-black uppercase tracking-tight leading-none">
                    {categoryLabel.split('&')[0].trim()}
                  </span>
                  <span className="w-3 h-3 rounded-full bg-flame mb-1" />
                </div>
              </div>
              {/* Top accent strip */}
              <div
                aria-hidden
                className="absolute top-0 left-0 right-0 h-1 bg-flame"
              />
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span
              className="text-[10px] font-black uppercase tracking-brand px-2.5 py-1 rounded text-paper"
              style={{ backgroundColor: article.sourceColor }}
            >
              {categoryLabel}
            </span>
            <span className="text-night/40 dark:text-paper/40 text-[10px] uppercase tracking-brand font-bold">
              {fullDate} · {timeAgo(article.publishedAt)}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-night dark:text-paper font-black text-2xl sm:text-3xl leading-[1.15] mb-4 tracking-tight">
            {article.title}
          </h1>

          {/* Description */}
          {article.description && (
            <p className="text-night/65 dark:text-paper/65 text-base leading-relaxed mb-7">
              {article.description}
            </p>
          )}

          {/* Primary CTA */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-flame text-paper text-xs font-black uppercase tracking-brand px-6 py-3.5 rounded-md hover:bg-night dark:hover:bg-paper dark:hover:text-night transition-colors"
          >
            Read on {article.sourceName} →
          </a>

          {/* URL preview */}
          <p className="mt-6 text-[10px] uppercase tracking-wider text-night/30 dark:text-paper/30 font-bold truncate">
            {(() => {
              try {
                return new URL(article.url).hostname.replace(/^www\./, '');
              } catch {
                return article.url;
              }
            })()}
          </p>
        </div>
      </div>
    </section>
  );
}
