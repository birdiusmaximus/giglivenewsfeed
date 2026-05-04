export interface FeedSource {
  id: string;
  name: string;
  url: string;
  rssUrl: string;
  color: string;
  paywallPhrases?: string[];
  /**
   * Source type — 'rss' for direct feeds, 'google-news' for sites that
   * blocked or removed RSS, where we use Google News as a proxy.
   */
  type?: 'rss' | 'google-news';
}

// Google News provides RSS for any site via:
// https://news.google.com/rss/search?q=site:DOMAIN+when:7d
// We use this for sites whose direct RSS feeds are 404 or stale.
// The `when:7d` operator constrains results to the last 7 days —
// without it, Google orders by relevance and may return 15-year-old
// articles first (Ads of the World, etc.).
const gnews = (host: string) =>
  `https://news.google.com/rss/search?q=site:${encodeURIComponent(host)}+when:7d&hl=en-US&gl=US&ceid=US:en`;

export const FEEDS: FeedSource[] = [
  {
    id: 'jeremy-utley',
    name: 'Jeremy Utley',
    url: 'https://www.jeremyutley.com/blog',
    rssUrl: 'https://www.jeremyutley.com/blog?format=rss',
    color: '#F45347', // Flame — thought leadership
  },
  {
    id: 'adweek',
    name: 'Adweek',
    url: 'https://www.adweek.com',
    rssUrl: 'https://www.adweek.com/feed/',
    color: '#00AE97', // Copper
    paywallPhrases: ['adweek pro', 'subscriber exclusive', 'subscribe to read'],
  },
  {
    id: 'the-drum',
    name: 'The Drum',
    url: 'https://www.thedrum.com',
    rssUrl: gnews('thedrum.com'),
    color: '#00AE97',
    type: 'google-news',
  },
  {
    id: 'creative-review',
    name: 'Creative Review',
    url: 'https://www.creativereview.co.uk',
    rssUrl: 'https://www.creativereview.co.uk/feed/',
    color: '#DEA8F4', // Potassium
    paywallPhrases: ['cr subscribers', 'subscribers only', 'cr members'],
  },
  {
    id: 'motionographer',
    name: 'Motionographer',
    url: 'https://motionographer.com',
    rssUrl: 'https://motionographer.com/feed/',
    color: '#FFBF3F', // Sodium
  },
  {
    id: 'abduzeedo',
    name: 'Abduzeedo',
    url: 'https://abduzeedo.com',
    // Their /feed/ endpoint is stale (last update Nov 2020 — Drupal cache?);
    // /rss.xml is the live one.
    rssUrl: 'https://abduzeedo.com/rss.xml',
    color: '#DEA8F4',
  },
  {
    id: 'its-nice-that',
    name: "It's Nice That",
    url: 'https://www.itsnicethat.com',
    // Direct RSS endpoints are 404; Feedburner mirror was also stale.
    // Google News proxy is the only reliable source of fresh content.
    rssUrl: gnews('itsnicethat.com'),
    color: '#DEA8F4',
    type: 'google-news',
  },
  // Removed: Clios and The One Club. Both sit behind Cloudflare bot
  // protection that returns HTTP 403 to all server-side requests
  // (including third-party scraping services). Without a paid
  // headless-browser service we can't extract images for their articles,
  // and the design needs working thumbnails. Awards content is still
  // covered by Adweek, The Drum, and Creative Review when relevant.
  {
    id: 'ads-of-the-world',
    name: 'Ads of the World',
    url: 'https://www.adsoftheworld.com',
    rssUrl: gnews('adsoftheworld.com'),
    color: '#F45347',
    type: 'google-news',
  },
];
