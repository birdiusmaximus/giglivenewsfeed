'use client';

import Image from 'next/image';
import { useTheme } from './ThemeProvider';

interface Props {
  /** Pixel size for the logo (square) */
  size?: number;
  className?: string;
}

/**
 * GIG Health logo — automatically swaps between primary (Paper wordmark on
 * Night) and secondary (Night wordmark on Paper) variants based on the
 * active theme. Per the brand guidelines:
 *   - Light mode → Secondary (Night wordmark) reads on Paper
 *   - Dark mode  → Primary (Paper wordmark) reads on Night
 *
 * The Flame tittle dot is identical across both variants.
 */
export default function Logo({ size = 56, className }: Props) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? '/logo-primary.svg' : '/logo-secondary.svg';

  return (
    <Image
      src={src}
      alt="GIG Health"
      width={size}
      height={size}
      priority
      className={className}
    />
  );
}
