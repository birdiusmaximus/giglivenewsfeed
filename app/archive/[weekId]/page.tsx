import { notFound } from 'next/navigation';
import { getWeekData } from '@/lib/storage';
import { getWeekNumber, formatWeekLabel } from '@/lib/weekUtils';
import Workspace from '@/components/Workspace';

interface Props {
  params: { weekId: string };
}

export default async function ArchiveWeekPage({ params }: Props) {
  const { weekId } = params;

  if (!/^\d{4}-W\d{2}$/.test(weekId)) notFound();

  const data = await getWeekData(weekId);
  if (!data) notFound();

  const weekNumber = getWeekNumber(weekId);
  const dateRange = formatWeekLabel(weekId);

  return (
    <Workspace
      articles={data.articles}
      weekNumber={weekNumber}
      dateRange={dateRange}
      isArchive
    />
  );
}
