import type { Category } from './types';

const SOURCE_CATEGORY_MAP: Record<string, Category> = {
  'motionographer': 'motion-animation',
  'ads-of-the-world': 'campaigns',
  'jeremy-utley':   'opinion-insight',
};

const RULES: Array<{ category: Category; pattern: RegExp }> = [
  {
    category: 'awards',
    pattern: /\b(award|winner|winning|shortlist|shortlisted|cannes lions|clio|d&ad|one show|eurobest|lia|grand prix|gold|silver|bronze lion|honors|honours)\b/i,
  },
  {
    category: 'events',
    pattern: /\b(festival|conference|deadline|call for entries|call for work|summit|award show|register|entries open|jury|judging|ceremony)\b/i,
  },
  {
    category: 'motion-animation',
    pattern: /\b(motion|animation|animated|3d|vfx|visual effects|title sequence|opening titles|after effects|cinema 4d|houdini|reel|showreel|mograph)\b/i,
  },
  {
    category: 'campaigns',
    pattern: /\b(campaign|spot|commercial|ad|advertisement|branded content|brand film|activation|launch|ooh|billboard|print ad|tv spot|creative work)\b/i,
  },
  {
    category: 'design-branding',
    pattern: /\b(design|branding|brand identity|rebrand|rebranding|logo|typography|typeface|font|packaging|illustration|poster|visual identity|art direction|graphic)\b/i,
  },
  {
    category: 'digital-tech',
    pattern: /\b(digital|ai|artificial intelligence|ux|ui|web design|app|technology|tool|software|platform|ar|vr|xr|interactive|generative|machine learning|chatgpt)\b/i,
  },
  {
    category: 'industry-news',
    pattern: /\b(agency|appointed|appoints|hires|hired|merger|acquisition|acquired|revenue|new business|account win|pitch|ceo|cco|cmo|ipo|founded|opens|expands|layoffs|redundanc)\b/i,
  },
  {
    category: 'opinion-insight',
    pattern: /\b(opinion|insight|column|essay|how to|why|future of|trend|analysis|perspective|commentary|interview|in conversation|five questions|lessons from)\b/i,
  },
];

export function detectCategory(title: string, description: string, sourceId: string): Category {
  if (SOURCE_CATEGORY_MAP[sourceId]) return SOURCE_CATEGORY_MAP[sourceId];
  const text = `${title} ${description}`;
  for (const rule of RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return 'industry-news';
}
