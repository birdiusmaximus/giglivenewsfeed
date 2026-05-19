'use client';

import clsx from 'clsx';

interface Props {
  saved: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}

export default function BookmarkButton({ saved, onToggle, size = 'md' }: Props) {
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle();
      }}
      className={clsx(
        dim,
        'rounded-full flex items-center justify-center flex-shrink-0 transition-all border',
        saved
          ? 'bg-flame border-flame text-paper hover:bg-flame/90'
          : 'border-night/15 dark:border-paper/15 text-night/40 dark:text-paper/40 hover:border-flame hover:text-flame'
      )}
      aria-label={saved ? 'Remove bookmark' : 'Save article'}
      title={saved ? 'Saved — click to remove' : 'Save for later'}
    >
      <svg
        viewBox="0 0 16 16"
        className={clsx(icon, 'transition-transform')}
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path d="M4 2.5h8a.5.5 0 0 1 .5.5v11l-4.5-3-4.5 3v-11a.5.5 0 0 1 .5-.5z" />
      </svg>
    </button>
  );
}
