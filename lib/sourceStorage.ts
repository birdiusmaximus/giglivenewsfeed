'use client';

import type { FeedSource } from './feeds';

export interface SourcePrefs {
  /** IDs of built-in sources the user has hidden */
  disabledIds: string[];
  /** User-added custom sources */
  custom: FeedSource[];
}

const STORAGE_KEY = 'gig-weekly-sources';

const EMPTY: SourcePrefs = { disabledIds: [], custom: [] };

export function loadSourcePrefs(): SourcePrefs {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SourcePrefs>;
    return {
      disabledIds: Array.isArray(parsed.disabledIds) ? parsed.disabledIds : [],
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
    };
  } catch {
    return EMPTY;
  }
}

export function saveSourcePrefs(prefs: SourcePrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable (private mode, quota exceeded) — silently ignore
  }
}

/** Color palette assigned round-robin to user-added custom sources */
const CUSTOM_COLORS = ['#F45347', '#00AE97', '#DEA8F4', '#FFBF3F'];

export function nextCustomColor(existingCustomCount: number): string {
  return CUSTOM_COLORS[existingCustomCount % CUSTOM_COLORS.length];
}

export function generateSourceId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return `custom-${slug || 'source'}-${Date.now().toString(36)}`;
}
