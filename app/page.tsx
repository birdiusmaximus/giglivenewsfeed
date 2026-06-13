import { unstable_cache } from 'next/cache';
import { getCurrentWeekId, getWeekNumber, formatWeekLabel } from '@/lib/weekUtils';
import { fetchAllArticles } from '@/lib/parser';
import Workspace from '@/components/Workspace';

// Skip build-time static generation. With 15 RSS sources + per-article
// Readability + image verification, a cold fetch easily exceeds the 60s
// Vercel build-worker timeout. By forcing dynamic rendering we move the
// expensive work to the first post-deploy request instead of the build.
export const dynamic = 'force-dynamic';

// The cold first request can take 20-40s (15 RSS fetches + Readability +
// image HEAD verification + Vimeo oEmbed). Default Hobby function timeout
// is 10s — that's what was producing the 500s. Allow the maximum 60s.
export const maxDuration = 60;

// At runtime the articles are still cached at the data layer for 10 minutes
// via Next.js's Data Cache. First request after a deploy (or 10 min idle)
// pays the cold-load cost; all subsequent visits within the window hit the
// cache and render instantly. The cache is shared across requests.
const getCachedArticles = unstable_cache(
  async () => fetchAllArticles(),
  ['home-articles'],
  { revalidate: 600, tags: ['articles'] }
);

export default async function HomePage() {
  const weekId = getCurrentWeekId();
  const weekNumber = getWeekNumber(weekId);
  const dateRange = formatWeekLabel(weekId);

  const articles = await getCachedArticles();

  return (
    <Workspace
      articles={articles}
      weekNumber={weekNumber}
      dateRange={dateRange}
    />
  );
}
