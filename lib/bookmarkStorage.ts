'use client';

import type { Article } from './types';

/**
 * Bookmarks are stored as full Article snapshots (not just IDs) so they
 * remain viewable even after the article falls out of RSS history or
 * the source feed gets removed.
 */
export interface BookmarkedArticle extends Article {
  bookmarkedAt: string;
}

const STORAGE_KEY = 'gig-weekly-bookmarks';
const EMAIL_KEY = 'gig-weekly-subscriber-email';

export function loadBookmarks(): BookmarkedArticle[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks: BookmarkedArticle[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // quota exceeded etc. — silently ignore
  }
}

export function loadSubscriberEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(EMAIL_KEY);
}

export function saveSubscriberEmail(email: string | null): void {
  if (typeof window === 'undefined') return;
  if (email) localStorage.setItem(EMAIL_KEY, email);
  else localStorage.removeItem(EMAIL_KEY);
}

/**
 * Sync the current bookmark list to the server for the given subscriber email.
 * Called after any add/remove so the weekly digest cron has fresh data.
 * Silently fails if no email is registered or the network is down.
 */
export async function syncBookmarksToServer(
  email: string | null,
  bookmarks: BookmarkedArticle[]
): Promise<void> {
  if (!email) return;
  try {
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, bookmarks }),
    });
  } catch {
    // sync is best-effort
  }
}
