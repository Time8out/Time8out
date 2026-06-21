/**
 * getTimezone.ts
 * Detects the user's timezone from their internet connection
 * using the WorldTimeAPI IP lookup endpoint.
 * Falls back to the browser's Intl API if the request fails.
 */

export async function getTimezone(): Promise<string> {
  try {
    const res = await fetch('https://worldtimeapi.org/api/ip', { cache: 'no-store' });
    if (!res.ok) throw new Error(`WorldTimeAPI responded with ${res.status}`);
    const data = await res.json();
    // data.timezone looks like: "Asia/Manila"
    console.log('[getTimezone] Detected timezone from IP:', data.timezone);
    return data.timezone as string;
  } catch (err) {
    const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.warn('[getTimezone] WorldTimeAPI failed — falling back to browser timezone:', fallback, err);
    return fallback;
  }
}