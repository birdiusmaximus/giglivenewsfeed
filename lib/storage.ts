import type { Article, WeekData } from './types';
import { getWeekNumber, getWeekYear } from './weekUtils';

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

  const index: string[] = (await kv.get<string[]>('archive:index')) ?? [];
  if (!index.includes(weekId)) {
    await kv.set('archive:index', [weekId, ...index]);
  }

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
  return (await kv.get<string[]>('archive:index')) ?? [];
}

export async function getWeekData(weekId: string): Promise<WeekData | null> {
  const kv = await getKV();
  if (!kv) return null;
  return kv.get<WeekData>(`week:${weekId}`);
}
