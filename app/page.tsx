import { getCurrentWeekId, getWeekNumber, formatWeekLabel } from '@/lib/weekUtils';
import { getWeekArticles } from '@/lib/storage';
import { fetchAllArticles } from '@/lib/parser';
import Workspace from '@/components/Workspace';

// Revalidate every 30 minutes — the cron job on Monday morning is primary,
// but this ensures we serve fresh data if someone visits mid-week
export const revalidate = 1800;

export default async function HomePage() {
  const weekId = getCurrentWeekId();
  const weekNumber = getWeekNumber(weekId);
  const dateRange = formatWeekLabel(weekId);

  // Try persisted snapshot first (fastest), fall back to live RSS fetch
  let articles = await getWeekArticles(weekId);
  if (!articles || articles.length === 0) {
    articles = await fetchAllArticles();
  }

  return (
    <Workspace
      articles={articles}
      weekNumber={weekNumber}
      dateRange={dateRange}
    />
  );
}
