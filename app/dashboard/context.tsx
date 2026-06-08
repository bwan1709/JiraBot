import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { App, Spin, Empty, Button, theme } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api, bust } from '../api';
import type { MonthData, Task, User } from '../types';
import { todayStr } from '../utils/format';

const AddMonthModal = lazy(() => import('./modals/AddMonthModal'));
const WorklogModal = lazy(() => import('./modals/WorklogModal'));
const StatusModal = lazy(() => import('./modals/StatusModal'));
const EditFieldsModal = lazy(() => import('./modals/EditFieldsModal'));
const JiraGuideModal = lazy(() => import('./modals/JiraGuideModal'));

const RELOAD_KEY = 'jb-reload-min';
function initialReloadMinutes(): number {
  try {
    const v = parseInt(localStorage.getItem(RELOAD_KEY) || '', 10);
    if (!Number.isNaN(v) && v >= 0 && v <= 120) return v;
  } catch {
    /* ignore */
  }
  return 5;
}

interface DashboardCtx {
  user: User | null;
  months: string[];
  currentMonth: string | null;
  data: MonthData | null;
  emptyMsg: { title: string; desc: string } | null;
  refreshing: boolean;
  exporting: boolean;
  timelineDate: string | null;
  timelineReloadSignal: number;
  autoReloadMinutes: number;
  setAutoReloadMinutes: (m: number) => void;
  isAdmin: boolean;
  switchMonth: (ym: string) => void;
  doRefresh: () => void;
  reloadTimeline: () => void;
  setTimelineDate: (d: string) => void;
  selectTimelineDate: (d: string) => void;
  openAddMonth: () => void;
  openWorklog: (key: string) => void;
  openStatus: (t: Task) => void;
  openEdit: (t: Task) => void;
  openGuide: () => void;
  handleExport: (type: 'daily' | 'excel' | 'word') => void;
  logout: () => void;
  reloadUser: () => Promise<void>;
}

const Ctx = createContext<DashboardCtx | null>(null);

export function useDashboard(): DashboardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDashboard must be used within <DashboardProvider>');
  return ctx;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState<string | null>(null);
  const [data, setData] = useState<MonthData | null>(null);
  const [emptyMsg, setEmptyMsg] = useState<{ title: string; desc: string } | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [timelineDate, setTimelineDateState] = useState<string | null>(null);
  const [timelineReloadSignal, setTimelineReloadSignal] = useState(0);
  const [autoReloadMinutes, setAutoReloadMinutesState] = useState<number>(initialReloadMinutes);

  // Contextual modals
  const [addMonthOpen, setAddMonthOpen] = useState(false);
  const [worklogKey, setWorklogKey] = useState<string | null>(null);
  const [statusTask, setStatusTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [jiraGuideOpen, setJiraGuideOpen] = useState(false);

  const currentMonthRef = useRef<string | null>(null);
  const dataRef = useRef<MonthData | null>(null);
  const userRef = useRef<User | null>(null);
  currentMonthRef.current = currentMonth;
  dataRef.current = data;
  userRef.current = user;

  const applyData = useCallback((d: MonthData) => {
    const prev = dataRef.current;
    if (prev && prev.year_month === d.year_month && prev.last_updated === d.last_updated) return;
    setEmptyMsg(null);
    setData(d);
  }, []);

  const loadData = useCallback(
    async (ym: string, silent = false) => {
      try {
        const d = await api.get<MonthData>(`/api/data/${ym}?${bust()}`);
        applyData(d);
      } catch (e: any) {
        if (e.code === 'no_data') {
          if (!silent) {
            setData(null);
            setEmptyMsg({
              title: 'Chưa có dữ liệu',
              desc: `Nhấn "Cập nhật" để tải dữ liệu tháng ${ym} từ Jira.`,
            });
          }
        } else if (!silent) {
          setEmptyMsg({ title: 'Lỗi tải dữ liệu', desc: e.message });
        }
      }
    },
    [applyData],
  );

  const reloadMonths = useCallback(async (keep: string) => {
    try {
      const { months: m } = await api.get<{ months: string[] }>(`/api/months?${bust()}`);
      setMonths(m.includes(keep) ? m : [keep, ...m].sort().reverse());
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(
    async (ymArg?: string) => {
      const ym = ymArg || currentMonthRef.current;
      if (!ym) {
        message.info('Vui lòng chọn hoặc thêm tháng trước.');
        return;
      }
      setRefreshing(true);
      try {
        const d = await api.post<MonthData>(`/api/refresh/${ym}`);
        applyData(d);
        message.success(`Cập nhật thành công! ${d.task_count} tasks · ${d.total_logged}h logged`);
        await reloadMonths(ym);
      } catch (e: any) {
        if (e.code === 'JIRA_401' || e.code === 'JIRA_MISSING_INFO') {
          message.error('Vui lòng cung cấp đầy đủ thông tin Jira trong mục Cài đặt cá nhân.');
        } else {
          message.error(`Lỗi: ${e.message}`);
        }
      } finally {
        setRefreshing(false);
      }
    },
    [applyData, message, reloadMonths],
  );

  const init = useCallback(async () => {
    try {
      const me = await api.get<{ user: User }>('/api/me');
      setUser(me.user);
    } catch {
      window.location.href = '/login.html';
      return;
    }
    try {
      const { months: m } = await api.get<{ months: string[] }>(`/api/months?${bust()}`);
      setMonths(m);
      if (m.length > 0) {
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const pick = m.includes(thisMonth) ? thisMonth : m[0];
        setCurrentMonth(pick);
        await loadData(pick);
      } else {
        setCurrentMonth(null);
        setEmptyMsg({ title: 'Chưa có tháng nào', desc: 'Nhấn "Thêm tháng" trên thanh trên để bắt đầu.' });
      }
    } catch (e: any) {
      message.error('Không thể kết nối đến server hoặc lỗi xác thực.');
      setEmptyMsg({ title: 'Lỗi kết nối', desc: 'Chi tiết: ' + e.message });
    } finally {
      setBooting(false);
    }
  }, [loadData, message]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Configurable auto-reload: silently re-sync from Jira every N minutes (0 = off).
  useEffect(() => {
    if (autoReloadMinutes <= 0) return;
    const t = setInterval(async () => {
      if (!currentMonthRef.current || document.hidden) return;
      try {
        const d = await api.post<MonthData>(`/api/refresh/${currentMonthRef.current}`);
        applyData(d);
      } catch {
        /* silent */
      }
    }, autoReloadMinutes * 60 * 1000);
    return () => clearInterval(t);
  }, [autoReloadMinutes, applyData]);

  // Default the timeline date whenever the month/data changes.
  useEffect(() => {
    if (!currentMonth) return;
    if (timelineDate && timelineDate.substring(0, 7) === currentMonth) return;
    const today = todayStr();
    if (today.substring(0, 7) === currentMonth) {
      setTimelineDateState(today);
    } else if (data && data.working_days.length > 0) {
      const lastPast = [...data.working_days].reverse().find((d) => d.date <= today);
      setTimelineDateState(lastPast ? lastPast.date : data.working_days[0].date);
    } else {
      setTimelineDateState(today);
    }
  }, [currentMonth, data, timelineDate]);

  const setAutoReloadMinutes = useCallback((m: number) => {
    const v = Math.max(0, Math.min(120, Math.round(m || 0)));
    setAutoReloadMinutesState(v);
    try {
      localStorage.setItem(RELOAD_KEY, String(v));
    } catch {
      /* ignore */
    }
  }, []);

  const switchMonth = useCallback(
    (ym: string) => {
      if (ym === currentMonthRef.current) return;
      setCurrentMonth(ym);
      loadData(ym);
    },
    [loadData],
  );

  const addMonth = useCallback(
    async (ym: string) => {
      setAddMonthOpen(false);
      setCurrentMonth(ym);
      setMonths((prev) => (prev.includes(ym) ? prev : [ym, ...prev].sort().reverse()));
      await refresh(ym);
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/logout');
      window.location.href = '/login.html';
    } catch (e: any) {
      message.error(`Lỗi đăng xuất: ${e.message}`);
    }
  }, [message]);

  const setTimelineDate = useCallback((d: string) => setTimelineDateState(d), []);
  const reloadTimeline = useCallback(() => setTimelineReloadSignal((s) => s + 1), []);

  const selectTimelineDate = useCallback(
    (date: string) => {
      setTimelineDateState(date);
      navigate('/timeline');
    },
    [navigate],
  );

  const doRefresh = useCallback(() => refresh(), [refresh]);
  const openAddMonth = useCallback(() => setAddMonthOpen(true), []);
  const openWorklog = useCallback((key: string) => setWorklogKey(key), []);
  const openStatus = useCallback((t: Task) => setStatusTask(t), []);
  const openEdit = useCallback((t: Task) => setEditTask(t), []);
  const openGuide = useCallback(() => setJiraGuideOpen(true), []);

  const handleExport = useCallback(
    async (type: 'daily' | 'excel' | 'word') => {
      setExporting(true);
      try {
        if (type === 'daily') {
          const { exportDailyExcel } = await import('./export/exportDailyExcel');
          await exportDailyExcel(message);
        } else if (type === 'excel') {
          const { exportExcel } = await import('./export/exportExcel');
          await exportExcel(currentMonthRef.current, applyData, message);
        } else {
          const { exportWord } = await import('./export/exportWord');
          await exportWord(currentMonthRef.current, userRef.current, applyData, message);
        }
      } finally {
        setExporting(false);
      }
    },
    [applyData, message],
  );

  const value = useMemo<DashboardCtx>(
    () => ({
      user,
      months,
      currentMonth,
      data,
      emptyMsg,
      refreshing,
      exporting,
      timelineDate,
      timelineReloadSignal,
      autoReloadMinutes,
      setAutoReloadMinutes,
      isAdmin: user?.role === 'admin',
      switchMonth,
      doRefresh,
      reloadTimeline,
      setTimelineDate,
      selectTimelineDate,
      openAddMonth,
      openWorklog,
      openStatus,
      openEdit,
      openGuide,
      handleExport,
      logout,
      reloadUser: init,
    }),
    [
      user,
      months,
      currentMonth,
      data,
      emptyMsg,
      refreshing,
      exporting,
      timelineDate,
      timelineReloadSignal,
      autoReloadMinutes,
      setAutoReloadMinutes,
      switchMonth,
      doRefresh,
      reloadTimeline,
      setTimelineDate,
      selectTimelineDate,
      openAddMonth,
      openWorklog,
      openStatus,
      openEdit,
      openGuide,
      handleExport,
      logout,
      init,
    ],
  );

  if (booting) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Đang tải dữ liệu..." />
      </div>
    );
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        {addMonthOpen && <AddMonthModal open onClose={() => setAddMonthOpen(false)} onSubmit={addMonth} />}
        {worklogKey && (
          <WorklogModal taskKey={worklogKey} onClose={() => setWorklogKey(null)} onDone={doRefresh} />
        )}
        {statusTask && <StatusModal task={statusTask} onClose={() => setStatusTask(null)} onDone={doRefresh} />}
        {editTask && <EditFieldsModal task={editTask} onClose={() => setEditTask(null)} onDone={doRefresh} />}
        {jiraGuideOpen && <JiraGuideModal open onClose={() => setJiraGuideOpen(false)} />}
      </Suspense>
    </Ctx.Provider>
  );
}

/** Renders children only when month data is loaded; otherwise an empty/refresh state. */
export function DataGate({ children }: { children: ReactNode }) {
  const { data, emptyMsg, refreshing, currentMonth, doRefresh } = useDashboard();
  const { token } = theme.useToken();
  if (data) return <>{children}</>;
  return (
    <Empty
      style={{ marginTop: 64 }}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{emptyMsg?.title ?? 'Chưa có dữ liệu'}</div>
          <div style={{ color: token.colorTextSecondary, marginTop: 6 }}>{emptyMsg?.desc ?? ''}</div>
        </div>
      }
    >
      {currentMonth && (
        <Button type="primary" icon={<ReloadOutlined />} loading={refreshing} onClick={doRefresh}>
          Cập nhật ngay
        </Button>
      )}
    </Empty>
  );
}
