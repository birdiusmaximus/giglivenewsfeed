import { getArchiveIndex } from '@/lib/storage';
import { getWeekNumber, formatWeekLabel } from '@/lib/weekUtils';
import Link from 'next/link';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';

// Always read fresh from KV — the archive index only changes on cron/backfill,
// but those changes must appear immediately, not after a 1-hour cache window.
export const revalidate = 0;

export default async function ArchivePage() {
  const index = await getArchiveIndex();

  return (
    <div className="min-h-screen flex flex-col bg-paper dark:bg-night transition-colors">
      {/* Header bar */}
      <header className="bg-white dark:bg-dusk border-b border-night/8 dark:border-paper/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={40} className="h-10 w-auto" />
            <span className="text-night/40 dark:text-paper/40 text-[10px] uppercase tracking-brand font-bold">
              Weekly · Archive
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-night/50 dark:text-paper/50 text-[10px] uppercase tracking-brand font-black hover:text-flame transition-colors"
            >
              ← This Week
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Page header */}
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-8 w-full">
        <div className="flex items-end gap-3">
          <span className="text-night dark:text-paper text-5xl sm:text-7xl font-black uppercase tracking-tight leading-none">
            Archive
          </span>
          <span className="w-3 h-3 rounded-full bg-flame mb-2" />
        </div>
        <p className="text-night/50 dark:text-paper/50 text-xs uppercase tracking-brand font-bold mt-3">
          Every week since we started
        </p>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-6 pb-16 w-full">
        {index.length === 0 ? (
          <div className="text-center py-24 bg-white dark:bg-dusk rounded-lg border border-night/8 dark:border-paper/10">
            <p className="text-night/50 dark:text-paper/50 text-sm uppercase tracking-brand font-black">
              Archive builds automatically
            </p>
            <p className="text-night/35 dark:text-paper/35 text-xs mt-3 max-w-md mx-auto">
              Each Monday the feed is saved here. Come back after the first Monday to see your archive.
            </p>
            {!process.env.KV_REST_API_URL && (
              <p className="block mt-4 text-flame/80 text-[11px] uppercase tracking-brand font-bold">
                Set up Vercel KV to enable archive — see SETUP.md
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {index.map((weekId) => {
              const weekNumber = getWeekNumber(weekId);
              const dateRange = formatWeekLabel(weekId);
              return (
                <Link
                  key={weekId}
                  href={`/archive/${weekId}`}
                  className="group bg-white dark:bg-dusk border border-night/8 dark:border-paper/10 rounded-lg p-6 hover:border-flame hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-night/40 dark:text-paper/40 text-xs uppercase tracking-brand font-bold">
                      Week
                    </span>
                    <span className="text-night dark:text-paper text-3xl font-black">
                      {weekNumber}
                    </span>
                  </div>
                  <p className="text-night/50 dark:text-paper/50 text-xs uppercase tracking-wider">
                    {dateRange}
                  </p>
                  <p className="text-flame text-xs uppercase tracking-brand font-bold mt-4 group-hover:underline">
                    View →
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
