'use client';

import type { KeywordFilter } from './types';

export interface KeywordFilterPrefs {
  /** User-added custom keyword filters */
  customFilters: KeywordFilter[];
  /** IDs of predefined filters the user has dismissed (so they don't reappear) */
  dismissedDefaultIds: string[];
}

const STORAGE_KEY = 'gig-weekly-keywords';
const EMPTY: KeywordFilterPrefs = { customFilters: [], dismissedDefaultIds: [] };

export function loadKeywordPrefs(): KeywordFilterPrefs {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<KeywordFilterPrefs>;
    return {
      customFilters: Array.isArray(parsed.customFilters) ? parsed.customFilters : [],
      dismissedDefaultIds: Array.isArray(parsed.dismissedDefaultIds) ? parsed.dismissedDefaultIds : [],
    };
  } catch {
    return EMPTY;
  }
}

export function saveKeywordPrefs(prefs: KeywordFilterPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Escape regex metacharacters in a user-supplied keyword so they're matched literally.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary keyword match. Matches whole words only, so "ai" matches "AI"
 * but NOT "rain", "air", "creative", etc. Multi-word phrases match as phrases.
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegex(keyword.toLowerCase())}\\b`, 'i');
  return pattern.test(text);
}
