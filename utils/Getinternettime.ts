/**
 * getInternetTime.ts
 * Fetches the authoritative current time from Supabase database server (PHT UTC+8).
 * Falls back to device local time if the request fails.
 */

import { supabase } from './supabase';

const TIMEZONE = 'Asia/Manila';

export interface InternetTime {
  date: Date;           // full Date object in PHT
  dateStr: string;      // "YYYY-MM-DD"
  timeStr: string;      // "HH:MM"
  readableDate: string; // "May 23, 2026"
  source: 'server' | 'device';
}

export async function getInternetTime(): Promise<InternetTime> {
  try {
    const { data, error } = await supabase.rpc('get_server_time');

    if (error || !data) throw new Error(error?.message);

    const date = new Date(data);

    const dateStr = date.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const timeStr = date.toLocaleTimeString('en-GB', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const readableDate = date.toLocaleDateString('en-US', {
      timeZone: TIMEZONE,
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    console.log(`[getInternetTime] Time fetched from Supabase server:`, timeStr, dateStr);

    return { date, dateStr, timeStr, readableDate, source: 'server' };

  } catch {
    console.info('[getInternetTime] Server time unreachable — using device time (PHT).');

    const now = new Date();

    const dateStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const timeStr = now.toLocaleTimeString('en-GB', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const readableDate = now.toLocaleDateString('en-US', {
      timeZone: TIMEZONE,
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return { date: now, dateStr, timeStr, readableDate, source: 'device' };
  }
} 