'use client';

import { useEffect, useRef, useState } from 'react';
import type { BookmarkedArticle } from '@/lib/bookmarkStorage';

interface Props {
  open: boolean;
  onClose: () => void;
  currentEmail: string | null;
  bookmarks: BookmarkedArticle[];
  onSubscribed: (email: string) => void;
  onUnsubscribed: () => void;
}

export default function SubscribeModal({
  open,
  onClose,
  currentEmail,
  bookmarks,
  onSubscribed,
  onUnsubscribed,
}: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setConfirmed(false);
      setEmail(currentEmail ?? '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, currentEmail]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const subscribe = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, bookmarks }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Subscription failed');
      }
      onSubscribed(trimmed);
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed');
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    if (!currentEmail) return;
    setBusy(true);
    try {
      await fetch('/api/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail }),
      });
      onUnsubscribed();
      onClose();
    } catch {
      setError('Unsubscribe failed — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-night/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-dusk rounded-lg shadow-2xl border border-night/10 dark:border-paper/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-night/8 dark:border-paper/10 flex items-center justify-between">
          <h2 className="text-night dark:text-paper text-lg font-black tracking-tight">
            Weekly digest
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-night/40 dark:text-paper/40 hover:text-flame hover:bg-paper dark:hover:bg-night transition-colors text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-6">
          {confirmed ? (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-flame mx-auto mb-4 flex items-center justify-center">
                <svg viewBox="0 0 16 16" className="w-6 h-6 text-paper" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-night dark:text-paper text-sm font-bold mb-1">You&apos;re subscribed</p>
              <p className="text-night/50 dark:text-paper/50 text-xs leading-relaxed">
                Every Monday morning, {email} will receive your saved articles from the past week.
              </p>
            </div>
          ) : currentEmail ? (
            <>
              <p className="text-night dark:text-paper text-sm font-bold mb-1.5">Currently subscribed</p>
              <p className="text-night/55 dark:text-paper/55 text-xs leading-relaxed mb-5">
                <span className="text-flame font-bold">{currentEmail}</span> receives a weekly digest every Monday morning. Whenever you save an article it&apos;s included in the next digest automatically.
              </p>
              <button
                onClick={unsubscribe}
                disabled={busy}
                className="w-full px-4 py-2.5 rounded-md border border-night/15 dark:border-paper/15 text-night/60 dark:text-paper/60 text-[11px] font-black uppercase tracking-brand hover:text-flame hover:border-flame transition-colors disabled:opacity-50"
              >
                {busy ? 'Removing…' : 'Unsubscribe'}
              </button>
            </>
          ) : (
            <>
              <p className="text-night/65 dark:text-paper/65 text-sm leading-relaxed mb-5">
                Every Monday morning, get your saved articles delivered as a clean email roundup. No spam, just what you bookmarked.
              </p>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !busy && subscribe()}
                  placeholder="you@example.com"
                  className="flex-1 min-w-0 bg-paper dark:bg-night border border-night/10 dark:border-paper/10 rounded-md px-3 py-2.5 text-sm text-night dark:text-paper placeholder:text-night/30 dark:placeholder:text-paper/30 focus:outline-none focus:border-flame transition-colors"
                />
                <button
                  onClick={subscribe}
                  disabled={busy || !email.trim()}
                  className="px-5 py-2.5 rounded-md bg-flame text-paper text-[11px] font-black uppercase tracking-brand hover:bg-flame/85 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {busy ? '…' : 'Subscribe'}
                </button>
              </div>
              {error && <p className="text-flame text-xs mt-2">{error}</p>}
              <p className="text-night/40 dark:text-paper/40 text-[11px] mt-3 leading-relaxed">
                You can unsubscribe at any time. No account needed — your email is used only for the digest.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
