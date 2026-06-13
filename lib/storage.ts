import type { Article, WeekData } from './types';
import { getWeekNumber, getWeekYear } from './weekUtils';

// Legacy list key — read once during migration, no longer written to.
const LEGACY_INDEX_KEY = 'archive:index';
// New Set-backed index. sadd is atomic, so concurrent writes can't lose
// each other the way the old read-modify-write pattern could.
const INDEX_KEY = 'archive:index:set';

function isKVAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function getKV() {
  if (!isKVAvailable()) return null;
  try {
    const { kv } = await import('@vercel/kv');
    return kv;
  } catch {
    return null;
  }
}

export async function saveWeekData(weekId: string, articles: Article[]): Promise<boolean> {
  const kv = await getKV();
  if (!kv) return false;

  const data: WeekData = {
    weekId,
    weekNumber: getWeekNumber(weekId),
    year: getWeekYear(weekId),
    articles,
    fetchedAt: new Date().toISOString(),
  };

  await kv.set(`week:${weekId}`, data);
  // Atomic add — concurrent backfill + cron writes can't step on each other
  await kv.sadd(INDEX_KEY, weekId);

  return true;
}

export async function getWeekArticles(weekId: string): Promise<Article[] | null> {
  const kv = await getKV();
  if (!kv) return null;
  const data = await kv.get<WeekData>(`week:${weekId}`);
  return data?.articles ?? null;
}

export async function getArchiveIndex(): Promise<string[]> {
  const kv = await getKV();
  if (!kv) return [];

  // Read both the new Set and the legacy list, union them. On the first
  // read after deploy this also lifts any legacy-list-only weekIds into
  // the Set so future reads can drop the legacy fetch eventually.
  const [setMembers, legacyList] = await Promise.all([
    kv.smembers(INDEX_KEY).catch(() => [] as string[]),
    kv.get<string[]>(LEGACY_INDEX_KEY).catch(() => null),
  ]);

  const merged = new Set<string>(setMembers ?? []);
  if (Array.isArray(legacyList) && legacyList.length > 0) {
    const newOnes = legacyList.filter((id) => !merged.has(id));
    for (const id of legacyList) merged.add(id);
    // Best-effort lift legacy entries into the Set, one at a time so the
    // overload signature doesn't need a tuple type
    for (const id of newOnes) {
      kv.sadd(INDEX_KEY, id).catch(() => {});
    }
  }

  // Sort by weekId desc — YYYY-Wnn strings sort naturally
  return Array.from(merged).sort((a, b) => b.localeCompare(a));
}

export async function getWeekData(weekId: string): Promise<WeekData | null> {
  const kv = await getKV();
  if (!kv) return null;
  return kv.get<WeekData>(`week:${weekId}`);
}
