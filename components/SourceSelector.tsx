'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { FEEDS, type FeedSource } from '@/lib/feeds';
import {
  type SourcePrefs,
  nextCustomColor,
  generateSourceId,
} from '@/lib/sourceStorage';

interface Props {
  open: boolean;
  onClose: () => void;
  prefs: SourcePrefs;
  onChange: (prefs: SourcePrefs) => void;
}

interface ValidateOk {
  ok: true;
  rssUrl: string;
  type: 'rss' | 'google-news';
  name: string;
  host: string;
  sampleCount: number;
}
interface ValidateErr { ok: false; error: string }

export default function SourceSelector({ open, onClose, prefs, onChange }: Props) {
  const [urlInput, setUrlInput] = useState('');
  const [nameOverride, setNameOverride] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ValidateOk | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset transient state when reopening
  useEffect(() => {
    if (open) {
      setError(null);
      setPreview(null);
      setUrlInput('');
      setNameOverride('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const toggleBuiltIn = (id: string) => {
    const disabled = prefs.disabledIds.includes(id);
    onChange({
      ...prefs,
      disabledIds: disabled
        ? prefs.disabledIds.filter((x) => x !== id)
        : [...prefs.disabledIds, id],
    });
  };

  const removeCustom = (id: string) => {
    onChange({ ...prefs, custom: prefs.custom.filter((c) => c.id !== id) });
  };

  const validate = async () => {
    if (!urlInput.trim()) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch('/api/sources/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data: ValidateOk | ValidateErr = await res.json();
      if (data.ok) {
        setPreview(data);
        setNameOverride(data.name);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmAdd = () => {
    if (!preview) return;
    const name = nameOverride.trim() || preview.name;
    const newSource: FeedSource = {
      id: generateSourceId(name),
      name,
      url: `https://${preview.host}`,
      rssUrl: preview.rssUrl,
      color: nextCustomColor(prefs.custom.length),
      type: preview.type,
    };
    onChange({ ...prefs, custom: [...prefs.custom, newSource] });
    setPreview(null);
    setUrlInput('');
    setNameOverride('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-night/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] bg-white dark:bg-dusk rounded-lg shadow-2xl flex flex-col overflow-hidden border border-night/10 dark:border-paper/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-night/8 dark:border-paper/10 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-night dark:text-paper text-lg font-black tracking-tight">
              Sources
            </h2>
            <p className="text-night/50 dark:text-paper/50 text-xs mt-0.5">
              Choose what feeds your weekly briefing.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-night/40 dark:text-paper/40 hover:text-flame hover:bg-paper dark:hover:bg-night transition-colors text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Source list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="px-2 pt-1 pb-2">
            <span className="text-night/30 dark:text-paper/30 text-[10px] uppercase tracking-brand font-black">
              Built-in
            </span>
          </div>
          {FEEDS.map((feed) => {
            const enabled = !prefs.disabledIds.includes(feed.id);
            return (
              <SourceRow
                key={feed.id}
                feed={feed}
                enabled={enabled}
                onToggle={() => toggleBuiltIn(feed.id)}
              />
            );
          })}

          {prefs.custom.length > 0 && (
            <>
              <div className="px-2 pt-4 pb-2 flex items-center gap-2">
                <span className="text-night/30 dark:text-paper/30 text-[10px] uppercase tracking-brand font-black">
                  Custom
                </span>
                <span className="flex-1 h-px bg-night/8 dark:bg-paper/8" />
              </div>
              {prefs.custom.map((feed) => (
                <SourceRow
                  key={feed.id}
                  feed={feed}
                  enabled
                  custom
                  onRemove={() => removeCustom(feed.id)}
                />
              ))}
            </>
          )}
        </div>

        {/* Add new */}
        <div className="border-t border-night/8 dark:border-paper/10 px-6 py-5 flex-shrink-0 bg-paper/40 dark:bg-night/40">
          <div className="text-night/30 dark:text-paper/30 text-[10px] uppercase tracking-brand font-black mb-3">
            Add a website
          </div>

          {!preview ? (
            <>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !busy && validate()}
                  placeholder="example.com or full RSS URL"
                  className="flex-1 min-w-0 bg-white dark:bg-dusk border border-night/10 dark:border-paper/10 rounded-md px-3 py-2.5 text-sm text-night dark:text-paper placeholder:text-night/30 dark:placeholder:text-paper/30 focus:outline-none focus:border-flame transition-colors"
                />
                <button
                  onClick={validate}
                  disabled={busy || !urlInput.trim()}
                  className="px-5 py-2.5 rounded-md bg-flame text-paper text-[11px] font-black uppercase tracking-brand hover:bg-flame/85 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {busy ? '…' : 'Find'}
                </button>
              </div>
              {error && (
                <p className="text-flame text-xs mt-2 leading-relaxed">{error}</p>
              )}
              <p className="text-night/40 dark:text-paper/40 text-[11px] mt-2 leading-relaxed">
                We&apos;ll auto-detect the RSS feed, or fall back to a Google News proxy.
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-white dark:bg-dusk rounded-md p-3 border border-night/10 dark:border-paper/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-flame text-[10px] uppercase tracking-brand font-black">
                    Found
                  </span>
                  <span className="text-night/40 dark:text-paper/40 text-[10px] uppercase tracking-brand">
                    {preview.sampleCount} recent · {preview.type === 'google-news' ? 'Google News proxy' : 'Direct RSS'}
                  </span>
                </div>
                <input
                  type="text"
                  value={nameOverride}
                  onChange={(e) => setNameOverride(e.target.value)}
                  className="w-full bg-paper dark:bg-night border border-night/10 dark:border-paper/10 rounded px-2.5 py-1.5 text-sm font-bold text-night dark:text-paper focus:outline-none focus:border-flame mb-1.5"
                />
                <p className="text-night/40 dark:text-paper/40 text-[11px] truncate">
                  {preview.host}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPreview(null); setError(null); }}
                  className="flex-1 px-4 py-2.5 rounded-md border border-night/15 dark:border-paper/15 text-night/60 dark:text-paper/60 text-[11px] font-black uppercase tracking-brand hover:text-flame hover:border-flame transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAdd}
                  className="flex-1 px-4 py-2.5 rounded-md bg-flame text-paper text-[11px] font-black uppercase tracking-brand hover:bg-flame/85 transition-colors"
                >
                  Add Source
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  feed: FeedSource;
  enabled: boolean;
  custom?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
}

function SourceRow({ feed, enabled, custom, onToggle, onRemove }: RowProps) {
  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-paper/60 dark:hover:bg-night/40 group transition-colors">
      <button
        onClick={onToggle}
        disabled={custom}
        className={clsx(
          'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors',
          enabled
            ? 'bg-flame border-flame'
            : 'border-night/25 dark:border-paper/25 hover:border-flame',
          custom && 'cursor-default'
        )}
        aria-label={enabled ? 'Disable source' : 'Enable source'}
      >
        {enabled && (
          <svg viewBox="0 0 16 16" className="w-3 h-3 text-paper" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: feed.color }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-night dark:text-paper text-sm font-bold truncate">
          {feed.name}
        </p>
        <p className="text-night/40 dark:text-paper/40 text-[11px] truncate">
          {feed.url.replace(/^https?:\/\//, '').replace(/^www\./, '')}
          {feed.type === 'google-news' && ' · via Google News'}
        </p>
      </div>
      {custom && onRemove && (
        <button
          onClick={onRemove}
          className="text-night/30 dark:text-paper/30 hover:text-flame text-lg w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove custom source"
        >
          ×
        </button>
      )}
    </div>
  );
}
