import type { Article } from './types';

export interface Subscriber {
  email: string;
  bookmarks: Article[];
  subscribedAt: string;
  lastDigestSentAt?: string;
}

function isKVAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function getKV() {
  if (!isKVAvailable()) return null;
  try {
    const { kv } = await import('@vercel/kv');
    return kv;
  } catch {
    return null;
  }
}

const SUBSCRIBER_KEY = (email: string) => `subscriber:${email.toLowerCase()}`;
const INDEX_KEY = 'subscribers:index';

export async function saveSubscriber(email: string, bookmarks: Article[]): Promise<boolean> {
  const kv = await getKV();
  if (!kv) return false;

  const key = SUBSCRIBER_KEY(email);
  const existing = await kv.get<Subscriber>(key);
  const subscriber: Subscriber = {
    email: email.toLowerCase(),
    bookmarks,
    subscribedAt: existing?.subscribedAt ?? new Date().toISOString(),
    lastDigestSentAt: existing?.lastDigestSentAt,
  };

  await kv.set(key, subscriber);

  // Maintain a lightweight index for the cron to iterate
  const index = (await kv.get<string[]>(INDEX_KEY)) ?? [];
  if (!index.includes(subscriber.email)) {
    await kv.set(INDEX_KEY, [...index, subscriber.email]);
  }
  return true;
}

export async function removeSubscriber(email: string): Promise<boolean> {
  const kv = await getKV();
  if (!kv) return false;
  await kv.del(SUBSCRIBER_KEY(email));
  const index = (await kv.get<string[]>(INDEX_KEY)) ?? [];
  await kv.set(INDEX_KEY, index.filter((e) => e !== email.toLowerCase()));
  return true;
}

export async function getSubscriber(email: string): Promise<Subscriber | null> {
  const kv = await getKV();
  if (!kv) return null;
  return kv.get<Subscriber>(SUBSCRIBER_KEY(email));
}

export async function listSubscribers(): Promise<Subscriber[]> {
  const kv = await getKV();
  if (!kv) return [];
  const emails = (await kv.get<string[]>(INDEX_KEY)) ?? [];
  if (emails.length === 0) return [];
  const subs = await Promise.all(
    emails.map((e) => kv.get<Subscriber>(SUBSCRIBER_KEY(e)))
  );
  return subs.filter((s): s is Subscriber => s !== null);
}

export async function markDigestSent(email: string): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  const sub = await kv.get<Subscriber>(SUBSCRIBER_KEY(email));
  if (sub) {
    await kv.set(SUBSCRIBER_KEY(email), { ...sub, lastDigestSentAt: new Date().toISOString() });
  }
}
