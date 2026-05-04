import {
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  endOfISOWeek,
  isWithinInterval,
  format,
} from 'date-fns';

export function getCurrentWeekId(): string {
  const now = new Date();
  const week = getISOWeek(now);
  const year = getISOWeekYear(now);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getWeekNumber(weekId: string): number {
  return parseInt(weekId.split('-W')[1], 10);
}

export function getWeekYear(weekId: string): number {
  return parseInt(weekId.split('-W')[0], 10);
}

export function getWeekStartDate(weekId: string): Date {
  const year = getWeekYear(weekId);
  const week = getWeekNumber(weekId);
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const week1Start = startOfISOWeek(jan4);
  const target = new Date(week1Start);
  target.setDate(week1Start.getDate() + (week - 1) * 7);
  return target;
}

export function formatWeekLabel(weekId: string): string {
  const start = getWeekStartDate(weekId);
  const end = endOfISOWeek(start);
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

export function isCurrentWeek(date: Date): boolean {
  const now = new Date();
  return isWithinInterval(date, {
    start: startOfISOWeek(now),
    end: endOfISOWeek(now),
  });
}

export function isInWeek(date: Date, weekId: string): boolean {
  const start = getWeekStartDate(weekId);
  const end = endOfISOWeek(start);
  return isWithinInterval(date, { start, end });
}

export function timeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days >= 2) return `${days} days ago`;
  if (days === 1) return 'Yesterday';
  if (hours >= 1) return `${hours}h ago`;
  return 'Just now';
}
