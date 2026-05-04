'use client';

import clsx from 'clsx';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={clsx(
        'group relative inline-flex items-center w-14 h-7 rounded-full p-0.5 transition-colors',
        'border focus:outline-none focus:ring-2 focus:ring-flame',
        isDark
          ? 'bg-night border-paper/15 hover:border-paper/35'
          : 'bg-paper border-night/15 hover:border-night/35',
        className
      )}
    >
      {/* Sun icon */}
      <span
        aria-hidden
        className={clsx(
          'absolute left-1.5 top-1/2 -translate-y-1/2 transition-opacity',
          isDark ? 'opacity-30' : 'opacity-0'
        )}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-paper/70">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      </span>
      {/* Moon icon */}
      <span
        aria-hidden
        className={clsx(
          'absolute right-1.5 top-1/2 -translate-y-1/2 transition-opacity',
          isDark ? 'opacity-0' : 'opacity-30'
        )}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-night/70">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>
      {/* Knob — Flame, like the tittle dot */}
      <span
        className={clsx(
          'relative w-6 h-6 rounded-full bg-flame shadow-sm transform transition-transform duration-200',
          isDark ? 'translate-x-7' : 'translate-x-0'
        )}
      />
    </button>
  );
}
