export type Category =
  | 'all'
  | 'campaigns'
  | 'design-branding'
  | 'motion-animation'
  | 'digital-tech'
  | 'awards'
  | 'industry-news'
  | 'opinion-insight'
  | 'events';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all',              label: 'All' },
  { id: 'campaigns',        label: 'Campaigns' },
  { id: 'design-branding',  label: 'Design & Branding' },
  { id: 'motion-animation', label: 'Motion & Animation' },
  { id: 'digital-tech',     label: 'Digital & Tech' },
  { id: 'awards',           label: 'Awards' },
  { id: 'opinion-insight',  label: 'Opinion & Insight' },
  { id: 'events',           label: 'Events' },
];

export type VideoType = 'youtube' | 'vimeo' | 'video';

export interface Article {
  id: string;
  title: string;
  url: string;
  description: string;
  imageUrl?: string;
  /** Embeddable video URL (YouTube/Vimeo iframe URL or direct mp4) */
  videoUrl?: string;
  videoType?: VideoType;
  publishedAt: string;
  source: string;
  sourceName: string;
  sourceColor: string;
  category: Category;
}

export interface KeywordFilter {
  id: string;
  label: string;
  /** Article matches if title or description contains ANY of these terms */
  keywords: string[];
  custom?: boolean;
}

export const KEYWORD_FILTERS: KeywordFilter[] = [
  {
    id: 'ai-automation',
    label: 'AI & Automation',
    keywords: ['ai', 'artificial intelligence', 'automation', 'machine learning', 'generative', 'chatgpt', 'gpt', 'llm'],
  },
  {
    id: 'creativity',
    label: 'Creativity',
    keywords: ['creativity', 'creative process', 'ideation', 'inspiration', 'brainstorm'],
  },
];

export interface WeekData {
  weekId: string;
  weekNumber: number;
  year: number;
  articles: Article[];
  fetchedAt: string;
}
