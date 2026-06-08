import { memo } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Card, Flex, Space, Tag, Typography, Spin, theme, Grid } from 'antd';
import { CloseCircleOutlined, CoffeeOutlined, FieldTimeOutlined } from '@ant-design/icons';
import { api } from '../../api';
import type { DailyReport, DailyTask, Worklog } from '../../types';
import { formatISOToDateTime, pad } from '../../utils/format';

const { Text } = Typography;
const START_HOUR = 8;
const END_HOUR = 17;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60; // 540

interface Block {
  key: string;
  summary: string;
  url: string;
  actual_start: string | null;
  actual_end: string | null;
  s: Date;
  e: Date;
  visStartMin: number;
  visEndMin: number;
  comments: string;
  timeSpentTodaySec: number;
}

function extractCommentText(comment: unknown): string {
  if (!comment) return '';
  if (typeof comment === 'string') return comment;
  if (typeof comment === 'object') {
    try {
      const c = comment as any;
      if (c.type === 'doc' && Array.isArray(c.content)) {
        return c.content
          .map((p: any) =>
            p.content && Array.isArray(p.content)
              ? p.content.map((ch: any) => ch.text || '').join('')
              : '',
          )
          .filter(Boolean)
          .join('\n');
      }
    } catch {
      /* ignore */
    }
    return JSON.stringify(comment);
  }
  return String(comment);
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtTimeMs(ms: number): string {
  return fmtTime(new Date(ms));
}
function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Props {
  date: string | null;
  /** Bump to force a re-fetch of the day's worklogs (per-screen refresh). */
  reloadSignal?: number;
}

const { useBreakpoint } = Grid;

function DailyTimeline({ date, reloadSignal }: Props) {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const timelineMinW = screens.md ? undefined : 660;
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [worklogs, setWorklogs] = useState<Worklog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<DailyReport>(`/api/daily-report?date=${date}`)
      .then((d) => {
        if (cancelled) return;
        setTasks(d.tasks || []);
        setWorklogs(d.worklogs || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Không thể tải dữ liệu ngày');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, reloadSignal]);

  const computed = useMemo(() => {
    if (!date) return null;
    const dayStartMin = START_HOUR * 60;
    const dayEndMin = END_HOUR * 60;
    const dayMidnightMs = new Date(date + 'T00:00:00').getTime();
    const dayStartMs = new Date(date + 'T08:00:00').getTime();
    const dayEndMs = new Date(date + 'T17:00:00').getTime();
    const dayLunchStartMs = new Date(date + 'T12:00:00').getTime();
    const dayLunchEndMs = new Date(date + 'T13:00:00').getTime();

    const validBlocks: Block[] = [];
    const outsideBlocks: Block[] = [];

    tasks.forEach((t) => {
      const taskWorklogs = worklogs.filter((wl) => wl.key === t.key);
      const comments = taskWorklogs
        .map((wl) => extractCommentText(wl.comment))
        .filter((c) => c && c.trim() !== '')
        .join(' | ');
      const timeSpentTodaySec = taskWorklogs.reduce((sum, wl) => sum + wl.timeSpentSeconds, 0);

      let s: Date | null = null;
      if (t.actual_start) s = new Date(t.actual_start);
      else if (taskWorklogs.length > 0) {
        const sorted = [...taskWorklogs].sort(
          (a, b) => new Date(a.started).getTime() - new Date(b.started).getTime(),
        );
        s = new Date(sorted[0].started);
      }
      let e: Date | null = null;
      if (t.actual_end) e = new Date(t.actual_end);
      else if (taskWorklogs.length > 0) {
        const sorted = [...taskWorklogs].sort(
          (a, b) => new Date(a.started).getTime() - new Date(b.started).getTime(),
        );
        const last = sorted[sorted.length - 1];
        e = new Date(new Date(last.started).getTime() + last.timeSpentSeconds * 1000);
      }
      if (!s) s = new Date(dayStartMs);
      if (!e) e = new Date(s.getTime() + (timeSpentTodaySec > 0 ? timeSpentTodaySec * 1000 : 3600 * 1000));
      if (s.getTime() >= e.getTime()) e = new Date(s.getTime() + 30 * 60 * 1000);

      const startMinFromMidnight = Math.round((s.getTime() - dayMidnightMs) / 60000);
      const endMinFromMidnight = Math.round((e.getTime() - dayMidnightMs) / 60000);
      const visStartMin = Math.max(dayStartMin, startMinFromMidnight);
      const visEndMin = Math.min(dayEndMin, endMinFromMidnight);

      const block: Block = {
        key: t.key,
        summary: t.summary,
        url: t.url,
        actual_start: t.actual_start,
        actual_end: t.actual_end,
        s,
        e,
        visStartMin,
        visEndMin,
        comments,
        timeSpentTodaySec,
      };
      if (visEndMin > visStartMin) validBlocks.push(block);
      else outsideBlocks.push(block);
    });

    validBlocks.sort((a, b) => a.visStartMin - b.visStartMin);

    // Greedy track assignment for overlapping blocks
    const tracks: Block[][] = [];
    validBlocks.forEach((block) => {
      let idx = -1;
      for (let i = 0; i < tracks.length; i++) {
        const overlaps = tracks[i].some(
          (ex) => block.visStartMin < ex.visEndMin && block.visEndMin > ex.visStartMin,
        );
        if (!overlaps) {
          idx = i;
          break;
        }
      }
      if (idx === -1) tracks.push([block]);
      else tracks[idx].push(block);
    });

    // Free slots within standard sessions [8-12], [13-17]
    const standardSessions = [
      { s: dayStartMs, e: dayLunchStartMs },
      { s: dayLunchEndMs, e: dayEndMs },
    ];
    const freeIntervals: { s: number; e: number }[] = [];
    let totalBusyMins = 0;
    standardSessions.forEach((session) => {
      const busy: { s: number; e: number }[] = [];
      validBlocks.forEach((block) => {
        const sMs = Math.max(session.s, block.s.getTime());
        const eMs = Math.min(session.e, block.e.getTime());
        if (sMs < eMs) busy.push({ s: sMs, e: eMs });
      });
      busy.sort((a, b) => a.s - b.s);
      const merged: { s: number; e: number }[] = [];
      busy.forEach((curr) => {
        if (merged.length === 0) merged.push({ ...curr });
        else {
          const last = merged[merged.length - 1];
          if (curr.s <= last.e) last.e = Math.max(last.e, curr.e);
          else merged.push({ ...curr });
        }
      });
      let cur = session.s;
      merged.forEach((iv) => {
        if (iv.s > cur) freeIntervals.push({ s: cur, e: iv.s });
        cur = Math.max(cur, iv.e);
      });
      if (cur < session.e) freeIntervals.push({ s: cur, e: session.e });
      merged.forEach((iv) => {
        totalBusyMins += (iv.e - iv.s) / 60000;
      });
    });
    const totalFreeMins = Math.max(0, 8 * 60 - totalBusyMins);

    return { tracks, freeIntervals, totalBusyMins, totalFreeMins, outsideBlocks, dayStartMin };
  }, [date, tasks, worklogs]);

  const HOUR_AXIS_H = 22;
  const TRACK_H = 46;
  const TRACK_GAP = 10;
  const MIN_AREA = 188;
  const lunchLeft = ((12 - START_HOUR) / (END_HOUR - START_HOUR)) * 100;
  const lunchWidth = (1 / (END_HOUR - START_HOUR)) * 100;
  const hourMarks: number[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) hourMarks.push(h);

  const body = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: 56 }}>
          <Spin />
        </div>
      );
    }
    if (error) {
      return (
        <div style={{ textAlign: 'center', padding: 40, color: token.colorError, fontSize: 13 }}>
          <CloseCircleOutlined style={{ marginInlineEnd: 6 }} />
          Lỗi: {error}
        </div>
      );
    }

    const tracks = computed?.tracks ?? [];
    const freeIntervals = computed?.freeIntervals ?? [];
    const totalBusyMins = computed?.totalBusyMins ?? 0;
    const totalFreeMins = computed?.totalFreeMins ?? 8 * 60;
    const outsideBlocks = computed?.outsideBlocks ?? [];
    const areaHeight = Math.max(MIN_AREA, tracks.length * (TRACK_H + TRACK_GAP) - TRACK_GAP);

    return (
      <>
        <div style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: timelineMinW ? 4 : 0 }}>
        <div style={{ minWidth: timelineMinW }}>
        <HourAxis hourMarks={hourMarks} height={HOUR_AXIS_H} />
        <div style={{ position: 'relative', height: areaHeight, marginTop: 4 }}>
          <GridOverlay lunchLeft={lunchLeft} lunchWidth={lunchWidth} hourMarks={hourMarks} />

          {tracks.length === 0 && (
            <Flex
              vertical
              align="center"
              justify="center"
              style={{ position: 'absolute', inset: 0, color: token.colorTextSecondary }}
            >
              <CoffeeOutlined style={{ fontSize: 30, marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Không có task nào trong ngày này</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                Bạn hoàn toàn trống lịch làm việc.
              </div>
            </Flex>
          )}

          {tracks.map((track, ti) => (
            <div
              key={ti}
              style={{
                position: 'absolute',
                top: ti * (TRACK_H + TRACK_GAP),
                left: 0,
                right: 0,
                height: TRACK_H,
                zIndex: 2,
              }}
            >
              {track.map((block) => {
                const leftPct = ((block.visStartMin - START_HOUR * 60) / TOTAL_MINUTES) * 100;
                const widthPct = ((block.visEndMin - block.visStartMin) / TOTAL_MINUTES) * 100;
                const startDayStr = localDate(block.s);
                const endDayStr = localDate(block.e);
                let startStr = fmtTime(block.s);
                let endStr = fmtTime(block.e);
                if (startDayStr !== date)
                  startStr += ` (${pad(block.s.getDate())}/${pad(block.s.getMonth() + 1)})`;
                if (endDayStr !== date)
                  endStr += ` (${pad(block.e.getDate())}/${pad(block.e.getMonth() + 1)})`;
                const totalDurSec = Math.round((block.e.getTime() - block.s.getTime()) / 1000);
                const durationStr =
                  totalDurSec >= 3600
                    ? `${(totalDurSec / 3600).toFixed(1)}h`
                    : `${Math.round(totalDurSec / 60)}m`;
                const todayLogged =
                  block.timeSpentTodaySec >= 3600
                    ? `${(block.timeSpentTodaySec / 3600).toFixed(1)}h`
                    : `${Math.round(block.timeSpentTodaySec / 60)}m`;
                const tooltip =
                  `${block.key}: ${block.summary}\n` +
                  `Actual Start: ${block.actual_start ? formatISOToDateTime(block.actual_start) : 'N/A'}\n` +
                  `Actual End: ${block.actual_end ? formatISOToDateTime(block.actual_end) : 'N/A'}\n` +
                  `Tổng thời gian thực tế: ${durationStr}\n` +
                  `Đã log hôm nay: ${block.timeSpentTodaySec > 0 ? todayLogged : '0h'}\n` +
                  `Comment: ${block.comments || '(Không có comment)'}`;
                return (
                  <div
                    key={block.key}
                    className="tl-block"
                    title={tooltip}
                    onClick={() => window.open(block.url, '_blank')}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `calc(${widthPct}% - 2px)`,
                      height: TRACK_H,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: '#fff',
                      borderRadius: 6,
                      padding: '6px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 1,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      fontSize: 11,
                      boxShadow: '0 2px 6px rgba(99,102,241,0.35)',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {block.key}
                    </div>
                    <div
                      style={{
                        opacity: 0.9,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {startStr} – {endStr} · {durationStr}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        </div>
        </div>

        <Footer
          busy={formatDuration(totalBusyMins)}
          free={formatDuration(totalFreeMins)}
          freeBadges={freeIntervals.map(
            (iv) => `${fmtTimeMs(iv.s)} - ${fmtTimeMs(iv.e)} (${formatDuration((iv.e - iv.s) / 60000)})`,
          )}
          outside={
            outsideBlocks.length > 0
              ? outsideBlocks.map((b) => `${b.key} (${fmtTime(b.s)} - ${fmtTime(b.e)})`).join(', ')
              : null
          }
        />
      </>
    );
  };

  return (
    <Card styles={{ body: { padding: 24 } }}>
      <div>{body()}</div>
    </Card>
  );
}

/** Hour labels row rendered above the tracks so blocks never overlap them. */
function HourAxis({ hourMarks, height }: { hourMarks: number[]; height: number }) {
  const { token } = theme.useToken();
  return (
    <div style={{ position: 'relative', height }}>
      {hourMarks.map((h) => {
        const pct = ((h - START_HOUR) / (END_HOUR - START_HOUR)) * 100;
        const isFirst = h === START_HOUR;
        const isLast = h === END_HOUR;
        const bold = isFirst || isLast || h === 12;
        const posStyle = isFirst
          ? { left: 0 }
          : isLast
            ? { right: 0 }
            : { left: `${pct}%`, transform: 'translateX(-50%)' };
        return (
          <div
            key={h}
            style={{
              position: 'absolute',
              top: 0,
              fontSize: 11,
              fontWeight: bold ? 600 : 400,
              color: token.colorTextTertiary,
              ...posStyle,
            }}
          >
            {h}h
          </div>
        );
      })}
    </div>
  );
}

/** Vertical hour grid lines + lunch-break band, filling the tracks area height. */
function GridOverlay({
  lunchLeft,
  lunchWidth,
  hourMarks,
}: {
  lunchLeft: number;
  lunchWidth: number;
  hourMarks: number[];
}) {
  const { token } = theme.useToken();
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: `${lunchLeft}%`,
          width: `${lunchWidth}%`,
          top: 0,
          bottom: 0,
          background: `${token.colorWarning}14`,
          borderLeft: `1px dashed ${token.colorWarning}66`,
          borderRight: `1px dashed ${token.colorWarning}66`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 10, color: token.colorWarningText, marginTop: 4 }}>Nghỉ trưa</span>
      </div>
      {hourMarks.map((h) => {
        const pct = ((h - START_HOUR) / (END_HOUR - START_HOUR)) * 100;
        const bold = h === START_HOUR || h === END_HOUR || h === 12;
        return (
          <div
            key={h}
            style={{
              position: 'absolute',
              left: `${pct}%`,
              top: 0,
              bottom: 0,
              borderLeft: `1px ${bold ? 'solid' : 'dashed'} ${
                bold ? token.colorBorder : token.colorBorderSecondary
              }`,
            }}
          />
        );
      })}
    </div>
  );
}

function Footer({
  busy,
  free,
  freeBadges,
  outside,
}: {
  busy: string;
  free: string;
  freeBadges: string[];
  outside: string | null;
}) {
  const { token } = theme.useToken();
  return (
    <div style={{ borderTop: `1px solid ${token.colorSplit}`, marginTop: 12, paddingTop: 10 }}>
      <Flex justify="space-between" align="center" wrap gap={12}>
        <Space size={16}>
          <Text style={{ fontSize: 12 }}>
            Đã làm (trong chuẩn 8h-17h): <strong style={{ color: token.colorPrimary }}>{busy}</strong>
          </Text>
          <Text style={{ fontSize: 12 }}>
            Trống: <strong style={{ color: token.colorSuccess }}>{free}</strong>
          </Text>
        </Space>
        <Space size={4} wrap>
          {freeBadges.length === 0 ? (
            <Text style={{ fontSize: 12 }}>Không còn thời gian trống!</Text>
          ) : (
            <>
              <Text strong style={{ fontSize: 12 }}>
                Khoảng trống (8h-17h):
              </Text>
              {freeBadges.map((b, i) => (
                <Tag key={i} color="green" style={{ marginInlineEnd: 0 }}>
                  {b}
                </Tag>
              ))}
            </>
          )}
        </Space>
      </Flex>
      {outside && (
        <div style={{ fontSize: 10, color: token.colorTextTertiary, marginTop: 8 }}>
          <FieldTimeOutlined style={{ marginInlineEnd: 4 }} />
          Làm ngoài giờ (8h-17h): {outside}
        </div>
      )}
    </div>
  );
}

export default memo(DailyTimeline);
