import type { Metadata } from 'next';
import { Barlow } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['100', '300', '400', '600', '700', '900'],
  variable: '--font-barlow',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GIG Weekly — Creative Industry Briefing',
  description:
    "Your weekly edit of what's moving in advertising, design, motion, and digital creativity.",
  openGraph: {
    title: 'GIG Weekly',
    description: 'Weekly creative industry briefing from GIG Health',
    siteName: 'GIG Weekly',
  },
};

// Inline script — sets the dark class BEFORE first paint to prevent flash
const themeBootstrap = `
(function(){try{
  var t = localStorage.getItem('gig-weekly-theme');
  if(!t){t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';}
  if(t === 'dark'){document.documentElement.classList.add('dark');}
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={barlow.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        {/* Adobe Fonts — Motiva Sans (GIG Health brand typeface) */}
        <link rel="stylesheet" href="https://use.typekit.net/wek0eum.css" />
      </head>
      <body className="font-sans bg-paper text-night antialiased dark:bg-night dark:text-paper">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
