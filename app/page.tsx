import { getCurrentWeekId, getWeekNumber, formatWeekLabel } from '@/lib/weekUtils';
import { fetchAllArticles } from '@/lib/parser';
import Workspace from '@/components/Workspace';

// Always live-fetch the current week. KV is reserved for the archive of
// completed weeks; the home page should reflect what publishers shipped in
// the last hour, not a snapshot from an earlier manual refresh.
//
// 10-minute ISR cache: balances freshness with not hammering RSS sources on
// every request. Articles surface within ~10 min of being published.
export const revalidate = 600;

export default async function HomePage() {
  const weekId = getCurrentWeekId();
  const weekNumber = getWeekNumber(weekId);
  const dateRange = formatWeekLabel(weekId);

  const articles = await fetchAllArticles();

  return (
    <Workspace
      articles={articles}
      weekNumber={weekNumber}
      dateRange={dateRange}
    />
  );
}
