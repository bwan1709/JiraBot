// Formatting helpers ported 1:1 from the original public/index.html so behaviour matches exactly.

import type { Task } from '../types';

export const pad = (n: number): string => String(n).padStart(2, '0');

/** Hours -> "2h 30m" (handles negatives and 0). */
export function fmtH(h: number | null | undefined): string {
  if (h == null || h === 0) return '0h';
  const hh = Math.floor(Math.abs(h));
  const mm = Math.round((Math.abs(h) - hh) * 60);
  const prefix = h < 0 ? '-' : '';
  return mm === 0 ? `${prefix}${hh}h` : `${prefix}${hh}h ${mm}m`;
}

/** "2026-06-01" -> "01/06/2026". */
export function fmtDate(str: string | null | undefined): string {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

/** Display the "done" date range for a task (actual start/end preferred, else resolved date). */
export function getDoneDateDisplay(t: Task): string {
  const formatISO = (isoStr: string | null): string => {
    if (!isoStr) return '';
    const datePart = isoStr.substring(0, 10);
    const [y, m, d] = datePart.split('-');
    return `${d}/${m}/${y}`;
  };
  if (t.actual_start && t.actual_end) {
    const sStr = formatISO(t.actual_start);
    const eStr = formatISO(t.actual_end);
    return sStr === eStr ? eStr : `${sStr} - ${eStr}`;
  }
  if (t.actual_end) return formatISO(t.actual_end);
  return fmtDate(t.resolved_date);
}

/** Seconds -> Jira estimate string ("1h 30m"); empty string when falsy. */
export function secondsToJiraEstimate(sec: number | null | undefined): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return '';
}

/** Same as above but returns "—" when falsy (used in the daily Excel export). */
export function secondsToJiraEstimateDash(sec: number | null | undefined): string {
  return secondsToJiraEstimate(sec) || '—';
}

/** ISO -> "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
export function formatDateTimeLocal(isoStr: string | null | undefined): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

/** ISO -> "dd/mm/yyyy hh:mm" (or "—"). */
export function formatISOToDateTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '—';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return '—';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" (local input value) -> Jira ISO with +0700 offset. */
export function toJiraIsoDateTime(localVal: string | null | undefined): string | null {
  if (!localVal) return null;
  return `${localVal}:00.000+0700`;
}

/** Date object -> local "YYYY-MM-DD". */
export function getLocalDateStr(dateVal: Date | string | null): string | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local date as "YYYY-MM-DD". */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-06" -> "T6/2026" for the month tabs. */
const MO_VI = ['', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
export function monthTabLabel(ym: string): string {
  const [y, mo] = ym.split('-');
  return `${MO_VI[parseInt(mo)]}/${y}`;
}
