import { memo } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Tabs, Segmented, Tag, Button, Space, Typography, theme, List, Grid, Flex } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ReactNode } from 'react';
import {
  EditOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  UnorderedListOutlined,
  GlobalOutlined,
  FolderOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  BugOutlined,
  ThunderboltOutlined,
  BookOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { MonthData, Task, TaskTabKey } from '../../types';
import { fmtH, getDoneDateDisplay } from '../../utils/format';

function typeIcon(t?: string | null): ReactNode {
  const s = (t || '').toLowerCase();
  if (s.includes('bug')) return <BugOutlined />;
  if (s.includes('epic')) return <ThunderboltOutlined />;
  if (s.includes('story')) return <BookOutlined />;
  return <ToolOutlined />;
}

const { Text, Link } = Typography;
const { useBreakpoint } = Grid;
const PAGE_SIZE = 20;

function statusColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s.includes('done') || s.includes('complete') || s.includes('resolved')) return 'green';
  if (s.includes('in progress') || s.includes('inprogress') || s.includes('running')) return 'blue';
  if (s.includes('qa') || s.includes('testing') || s.includes('review')) return 'purple';
  if (s.includes('cancelled') || s.includes('cancel') || s.includes('closed') || s.includes('rejected'))
    return 'red';
  return 'default';
}

interface Props {
  data: MonthData;
  currentMonth: string;
  onWorklog: (key: string) => void;
  onStatus: (task: Task) => void;
  onEdit: (task: Task) => void;
}

function TaskTable({ data, currentMonth, onWorklog, onStatus, onEdit }: Props) {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const mobile = !screens.sm;
  const [activeTab, setActiveTab] = useState<TaskTabKey>('todo');
  const [activeProject, setActiveProject] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Reset project filter + page when the month changes (matches original switchMonth behaviour)
  useEffect(() => {
    setActiveProject('all');
    setPage(1);
  }, [currentMonth]);

  const doneTasks = data.tasks || [];
  const inProgressTasks = useMemo(
    () =>
      (data.in_progress_tasks || []).filter(
        (t) => t.created && t.created.substring(0, 7) === currentMonth,
      ),
    [data, currentMonth],
  );
  const todoTasks = useMemo(
    () =>
      (data.todo_tasks || []).filter((t) => {
        const isSubtask = t.issue_type.toLowerCase().includes('sub');
        const isIdea = (t.status || '').toUpperCase() === 'IDEA';
        if (!(isSubtask && !isIdea)) return false;
        if (!t.created) return false;
        return t.created.substring(0, 7) === currentMonth;
      }),
    [data, currentMonth],
  );
  const missingTasks = useMemo(
    () => doneTasks.filter((t) => t.missing_fields && t.missing_fields.length > 0),
    [doneTasks],
  );

  const listFor = (tab: TaskTabKey): Task[] => {
    if (tab === 'done') return doneTasks;
    if (tab === 'inprogress') return inProgressTasks;
    if (tab === 'todo') return todoTasks;
    return missingTasks;
  };

  // Project sub-filter options (across all lists)
  const projectMap: Record<string, string> = {};
  [...doneTasks, ...inProgressTasks, ...todoTasks].forEach((t) => {
    if (t.project) projectMap[t.project] = t.project_key || t.project;
  });
  const projects = Object.keys(projectMap).sort();

  let activeTasks = listFor(activeTab);
  if (activeProject !== 'all') activeTasks = activeTasks.filter((t) => t.project === activeProject);

  const totalLogged =
    Math.round(
      activeTasks.filter((t) => t.has_worklog).reduce((s, t) => s + t.time_spent_hours, 0) * 100,
    ) / 100;
  const noLog = activeTasks.filter((t) => !t.has_worklog).length;

  const footerSub = (() => {
    const n = activeTasks.length;
    if (activeTab === 'done')
      return noLog > 0 ? `(${n} tasks · ${noLog} chưa có worklog)` : `(${n} tasks · tất cả đã log)`;
    if (activeTab === 'inprogress')
      return noLog > 0 ? `(${n} tasks đang làm · ${noLog} chưa log giờ)` : `(${n} tasks đang làm · tất cả đã log)`;
    if (activeTab === 'todo')
      return noLog > 0 ? `(${n} tasks To-do · ${noLog} chưa log giờ)` : `(${n} tasks To-do · tất cả đã log)`;
    return `(${n} tasks Done thiếu trường bắt buộc)`;
  })();

  // ── Columns (shared + per-tab) ──
  const idxCol: ColumnsType<Task>[number] = {
    title: '#',
    key: 'idx',
    width: 48,
    render: (_v, _r, i) => (
      <Text type="secondary" style={{ fontSize: 11 }}>
        {(page - 1) * PAGE_SIZE + i + 1}
      </Text>
    ),
  };
  const keyCol: ColumnsType<Task>[number] = {
    title: 'Key',
    dataIndex: 'key',
    width: 120,
    render: (_v, t) => (
      <Link href={t.url} target="_blank">
        {t.key}
      </Link>
    ),
  };
  const summaryCol: ColumnsType<Task>[number] = {
    title: 'Summary',
    dataIndex: 'summary',
    ellipsis: true,
  };
  const projectCol: ColumnsType<Task>[number] = {
    title: 'Project',
    dataIndex: 'project',
    width: 150,
    ellipsis: true,
    render: (v) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {v}
      </Text>
    ),
  };
  const typeCol: ColumnsType<Task>[number] = {
    title: 'Loại',
    dataIndex: 'issue_type',
    width: 130,
    render: (v) => <Tag icon={typeIcon(v)}>{v}</Tag>,
  };
  const timeCol: ColumnsType<Task>[number] = {
    title: 'Time Spent',
    key: 'time',
    width: 130,
    render: (_v, t) =>
      t.has_worklog ? (
        <Text style={{ color: '#52c41a' }}>
          <CheckCircleOutlined style={{ marginInlineEnd: 4 }} />
          {t.time_spent_display}
        </Text>
      ) : (
        <Text style={{ color: '#faad14' }}>
          <ExclamationCircleOutlined style={{ marginInlineEnd: 4 }} />
          Chưa log
        </Text>
      ),
  };

  let columns: ColumnsType<Task>;
  if (activeTab === 'done') {
    columns = [
      idxCol,
      keyCol,
      summaryCol,
      projectCol,
      typeCol,
      {
        title: 'Ngày Done',
        key: 'done',
        width: 150,
        render: (_v, t) => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{getDoneDateDisplay(t)}</span>,
      },
      timeCol,
      {
        title: 'Thao tác',
        key: 'act',
        width: 100,
        align: 'center',
        render: (_v, t) => (
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(t)}>
            Sửa
          </Button>
        ),
      },
    ];
  } else if (activeTab === 'inprogress' || activeTab === 'todo') {
    columns = [
      idxCol,
      keyCol,
      summaryCol,
      projectCol,
      typeCol,
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        width: 130,
        render: (v) => <Tag color={statusColor(v)}>{v}</Tag>,
      },
      timeCol,
      {
        title: 'Thao tác',
        key: 'act',
        width: 230,
        align: 'center',
        render: (_v, t) => (
          <Space size={4}>
            <Button size="small" icon={<ClockCircleOutlined />} onClick={() => onWorklog(t.key)}>
              Log
            </Button>
            <Button size="small" icon={<SwapOutlined />} onClick={() => onStatus(t)}>
              Status
            </Button>
            <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(t)}>
              Sửa
            </Button>
          </Space>
        ),
      },
    ];
  } else {
    columns = [
      idxCol,
      keyCol,
      summaryCol,
      projectCol,
      typeCol,
      {
        title: 'Thông tin thiếu (Bắt buộc khi Done)',
        key: 'missing',
        render: (_v, t) => (
          <Space size={[4, 4]} wrap>
            {t.missing_fields.map((f) => (
              <Tag key={f} color="red">
                {f}
              </Tag>
            ))}
          </Space>
        ),
      },
      timeCol,
      {
        title: 'Thao tác',
        key: 'act',
        width: 100,
        align: 'center',
        render: (_v, t) => (
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(t)}>
            Sửa
          </Button>
        ),
      },
    ];
  }

  const tabLabel = (
    key: TaskTabKey,
    text: string,
    count: number,
    opts: { icon?: ReactNode; danger?: boolean } = {},
  ) => {
    const active = activeTab === key;
    const danger = !!opts.danger && count > 0;
    const textColor = danger ? token.colorError : active ? token.colorPrimary : undefined;
    const pillBg = danger
      ? token.colorError
      : active
        ? token.colorPrimary
        : token.colorFillSecondary;
    const pillColor = danger || active ? '#fff' : token.colorTextSecondary;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: textColor, fontWeight: active ? 600 : 400 }}>
        {opts.icon}
        {text}
        <span
          style={{
            minWidth: 20,
            height: 18,
            padding: '0 6px',
            borderRadius: 9,
            fontSize: 11,
            fontWeight: 600,
            lineHeight: '18px',
            textAlign: 'center',
            background: pillBg,
            color: pillColor,
          }}
        >
          {count}
        </span>
      </span>
    );
  };

  const tabItems = [
    { key: 'todo', label: tabLabel('todo', 'To-do', todoTasks.length) },
    { key: 'inprogress', label: tabLabel('inprogress', 'In Progress', inProgressTasks.length) },
    { key: 'done', label: tabLabel('done', 'Done', doneTasks.length) },
    {
      key: 'missing',
      label: tabLabel('missing', 'Thiếu thông tin', missingTasks.length, {
        icon: <WarningOutlined />,
        danger: true,
      }),
    },
  ];

  // Mobile card representation of a task (replaces the table row on xs).
  const renderTaskCard = (t: Task) => {
    const isProg = activeTab === 'inprogress' || activeTab === 'todo';
    const isDone = activeTab === 'done';
    const isMissing = activeTab === 'missing';
    return (
      <Card size="small" style={{ marginBottom: 8 }} styles={{ body: { padding: 12 } }}>
        <Flex justify="space-between" align="flex-start" gap={8}>
          <Link href={t.url} target="_blank" style={{ fontWeight: 600 }}>
            {t.key}
          </Link>
          <Tag icon={typeIcon(t.issue_type)} style={{ margin: 0 }}>
            {t.issue_type}
          </Tag>
        </Flex>
        <div style={{ margin: '6px 0', fontSize: 13 }}>{t.summary}</div>
        <Flex gap={8} wrap align="center" style={{ marginBottom: isMissing ? 8 : 10 }}>
          {t.project && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t.project}
            </Text>
          )}
          {isProg && <Tag color={statusColor(t.status)}>{t.status}</Tag>}
          {isDone && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {getDoneDateDisplay(t)}
            </Text>
          )}
          {t.has_worklog ? (
            <Text style={{ color: '#52c41a', fontSize: 12 }}>
              <CheckCircleOutlined style={{ marginInlineEnd: 4 }} />
              {t.time_spent_display}
            </Text>
          ) : (
            <Text style={{ color: '#faad14', fontSize: 12 }}>
              <ExclamationCircleOutlined style={{ marginInlineEnd: 4 }} />
              Chưa log
            </Text>
          )}
        </Flex>
        {isMissing && (
          <Space size={[4, 4]} wrap style={{ marginBottom: 10 }}>
            {t.missing_fields.map((f) => (
              <Tag key={f} color="red">
                {f}
              </Tag>
            ))}
          </Space>
        )}
        <Flex gap={6} wrap>
          {isProg && (
            <Button size="small" icon={<ClockCircleOutlined />} onClick={() => onWorklog(t.key)}>
              Log
            </Button>
          )}
          {isProg && (
            <Button size="small" icon={<SwapOutlined />} onClick={() => onStatus(t)}>
              Status
            </Button>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(t)}>
            Sửa
          </Button>
        </Flex>
      </Card>
    );
  };

  return (
    <Card
      size="default"
      title={
        <span style={{ fontSize: 15 }}>
          <UnorderedListOutlined style={{ marginInlineEnd: 8 }} />
          Danh sách Tasks
        </span>
      }
      styles={{
        extra: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        },
      }}
      extra={
        <>
          <Space>
            <Text type="secondary">{activeTasks.length} tasks</Text>
            {totalLogged > 0 && (
              <Text style={{ color: token.colorPrimary }}>
                {fmtH(totalLogged)} <Text type="secondary">({footerSub})</Text>
              </Text>
            )}
          </Space>
        </>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k as TaskTabKey);
          setActiveProject('all');
          setPage(1);
        }}
        type='card'
        items={tabItems.map((t) => ({ ...t, children: null }))}
      />

      {projects.length > 1 && (
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <Segmented
            value={activeProject}
            onChange={(v) => {
              setActiveProject(v as string);
              setPage(1);
            }}
            options={[
              {
                label: (
                  <span>
                    <GlobalOutlined style={{ marginInlineEnd: 6 }} />
                    Tất cả dự án
                  </span>
                ),
                value: 'all',
              },
              ...projects.map((p) => ({
                label: (
                  <span>
                    <FolderOutlined style={{ marginInlineEnd: 6 }} />
                    {p} ({projectMap[p]})
                  </span>
                ),
                value: p,
              })),
            ]}
          />
        </div>
      )}

      {mobile ? (
        <List<Task>
          dataSource={activeTasks}
          locale={{ emptyText: 'Không có task nào trong danh sách' }}
          split={false}
          pagination={
            activeTasks.length > PAGE_SIZE
              ? { current: page, pageSize: PAGE_SIZE, onChange: setPage, align: 'center', showSizeChanger: false }
              : false
          }
          renderItem={(t) => renderTaskCard(t)}
        />
      ) : (
        <Table<Task>
          rowKey="key"
          size="small"
          columns={columns}
          dataSource={activeTasks}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total) => `Tổng ${total} tasks`,
          }}
          locale={{ emptyText: 'Không có task nào trong danh sách' }}
          scroll={{ x: 'max-content' }}
        />
      )}
    </Card>
  );
}

export default memo(TaskTable);
