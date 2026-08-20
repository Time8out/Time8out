/**
 * getInternetTime.ts
 * Fetches the authoritative current time from WorldTimeAPI (Asia/Manila / PHT UTC+8).
 * Falls back to device local time if the request fails, and logs a warning.
 */

const TIMEZONE = 'Asia/Manila';
const API_URL  = `https://worldtimeapi.org/api/timezone/${TIMEZONE}`;

export interface InternetTime {
  date: Date;       // full Date object in PHT
  dateStr: string;  // "YYYY-MM-DD"
  timeStr: string;  // "HH:MM"
  readableDate: string; // "May 23, 2026"
  source: 'internet' | 'device'; // so you know which was used
}

export async function getInternetTime(): Promise<InternetTime> {
  try {
    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`WorldTimeAPI responded with ${res.status}`);

    const data = await res.json();

    // data.datetime looks like: "2026-05-23T21:08:45.123456+08:00"
    const date = new Date(data.datetime);

    const dateStr = data.datetime.slice(0, 10); // "YYYY-MM-DD"
    const timeStr = data.datetime.slice(11, 16); // "HH:MM"

    const readableDate = date.toLocaleDateString('en-US', {
      timeZone: TIMEZONE,
      month: 'long',      
      day: 'numeric',
      year: 'numeric',
    });

    console.log(`[getInternetTime] Time fetched from WorldTimeAPI (${TIMEZONE}):`, timeStr, dateStr);

    return { date, dateStr, timeStr, readableDate, source: 'internet' };

  } catch (err) {
    console.warn('[getInternetTime] WorldTimeAPI failed — falling back to device time.', err);

    // Fallback: device time formatted as PHT
    const now = new Date();

    const dateStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // "YYYY-MM-DD"
    const timeStr = now.toLocaleTimeString('en-GB', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }); // "HH:MM"

    const readableDate = now.toLocaleDateString('en-US', {
      timeZone: TIMEZONE,
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return { date: now, dateStr, timeStr, readableDate, source: 'device' };
  }
}