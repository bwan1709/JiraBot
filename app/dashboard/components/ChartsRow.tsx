import { memo } from 'react';
import { Card, Col, Row, Space, Typography, theme, Flex, Grid } from 'antd';
import { CalendarOutlined, LineChartOutlined } from '@ant-design/icons';
import { DualAxes, Line } from '@ant-design/charts';
import type { MonthData } from '../../types';
import { fmtH } from '../../utils/format';
import { useThemeMode } from '../../theme';

const { Text } = Typography;
const { useBreakpoint } = Grid;

const TEAL = '#14b8a6';
const AMBER = '#f59e0b';
const ROSE = '#f43f5e';
const INDIGO = '#6366f1';
const GREEN = '#10b981';

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const dayNum = (date: string) => String(parseInt(date.slice(8, 10), 10));
const fullDay = (date: string) =>
  `${date.slice(8, 10)}/${date.slice(5, 7)} · ${WD[new Date(date + 'T00:00:00').getDay()]}`;

interface Props {
  data: MonthData;
  onSelectDate: (date: string) => void;
}

/** Compact colour legend shown under the daily chart. */
function Legend({ color: textColor }: { color: string }) {
  const item = (color: string, label: string, dashed = false) => (
    <span style={{ fontSize: 11, color: textColor, whiteSpace: 'nowrap' }}>
      <span
        style={{
          display: 'inline-block',
          width: 12,
          height: dashed ? 0 : 10,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
          borderRadius: dashed ? 0 : 2,
          background: dashed ? undefined : color,
          marginRight: 5,
          verticalAlign: 'middle',
        }}
      />
      {label}
    </span>
  );
  return (
    <Space size={[12, 4]} wrap style={{ justifyContent: 'center', width: '100%' }}>
      {item(TEAL, 'Đạt/Thừa')}
      {item(AMBER, 'Thiếu một phần')}
      {item(ROSE, 'Chưa log')}
      {item(INDIGO, 'Mức chuẩn', true)}
    </Space>
  );
}

function CardTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Flex align="center" gap={10}>
      {icon}
      <div>
        <div style={{ fontSize: 15 }}>{title}</div>
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
          {sub}
        </Text>
      </div>
    </Flex>
  );
}

function ChartsRow({ data, onSelectDate }: Props) {
  const { isDark } = useThemeMode();
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const chartH = screens.lg ? 280 : screens.sm ? 250 : 220;
  const labelFontSize = screens.sm ? 11 : 9;
  const chartTheme = isDark ? 'classicDark' : 'classic';

  const wds = data.working_days;
  const today = data.today;
  const todayIdx = wds.reduce((acc, d, idx) => (d.date <= today ? idx : acc), -1);
  const maxY = Math.max(20, ...wds.map((d) => Math.max(d.logged, d.standard))) + 2;

  const statusOf = (logged: number, standard: number) => {
    if (logged === 0) return 'Chưa log';
    if (logged >= standard) return 'Đạt/Thừa';
    return 'Thiếu một phần';
  };

  const colData = wds
    .map((d, i) => {
      const logged = Math.round(d.logged * 100) / 100;
      return {
        x: dayNum(d.date),
        date: d.date,
        full: fullDay(d.date),
        hours: i <= todayIdx ? logged : null,
        standard: d.standard,
        diff: Math.round((d.logged - d.standard) * 100) / 100,
        status: statusOf(d.logged, d.standard),
      };
    })
    .filter((d) => d.hours !== null);

  const lineData = wds.map((d) => ({ x: dayNum(d.date), standard: d.standard }));

  const dailyConfig: any = {
    height: chartH,
    theme: chartTheme,
    autoFit: true,
    xField: 'x',
    legend: false,
    children: [
      {
        data: colData,
        type: 'interval',
        yField: 'hours',
        colorField: 'status',
        scale: {
          color: {
            domain: ['Đạt/Thừa', 'Thiếu một phần', 'Chưa log'],
            range: [TEAL, AMBER, ROSE],
          },
          y: { domainMin: 0, domainMax: maxY },
        },
        style: { maxWidth: 24, radiusTopLeft: 3, radiusTopRight: 3 },
        axis: {
          y: { title: 'Giờ', labelFontSize },
          x: { title: false, labelFontSize, labelAutoHide: true, labelAutoRotate: false },
        },
        tooltip: {
          title: (dd: any) => dd.full,
          items: [
            (dd: any) => ({ name: 'Đã log', value: fmtH(dd.hours) }),
            (dd: any) => ({ name: 'Giờ chuẩn', value: `${dd.standard}h` }),
            (dd: any) => ({
              name: dd.diff >= 0 ? 'Thừa' : 'Thiếu',
              value: `${dd.diff > 0 ? '+' : ''}${fmtH(dd.diff)}`,
            }),
          ],
        },
      },
      {
        data: lineData,
        type: 'line',
        yField: 'standard',
        scale: { y: { domainMin: 0, domainMax: maxY } },
        style: { stroke: INDIGO, lineWidth: 1.5, lineDash: [4, 3] },
        axis: { y: false },
        tooltip: false,
      },
    ],
    onReady: ({ chart }: any) => {
      try {
        chart.on('interval:click', (ev: any) => {
          const datum = ev?.data?.data;
          if (datum?.date) onSelectDate(datum.date);
        });
      } catch {
        /* click wiring is best-effort */
      }
    },
  };

  // ── Cumulative ──
  const pastDays = wds.slice(0, todayIdx + 1);
  let cumStd = 0;
  let cumLog = 0;
  const cumData: { x: string; full: string; value: number; type: string }[] = [];
  pastDays.forEach((d) => {
    cumStd += d.standard;
    cumLog += d.logged;
    cumData.push({ x: dayNum(d.date), full: fullDay(d.date), value: Math.round(cumStd * 100) / 100, type: 'Cần đạt' });
    cumData.push({ x: dayNum(d.date), full: fullDay(d.date), value: Math.round(cumLog * 100) / 100, type: 'Đã log' });
  });

  const cumConfig: any = {
    height: chartH,
    theme: chartTheme,
    autoFit: true,
    data: cumData,
    xField: 'x',
    yField: 'value',
    colorField: 'type',
    scale: { color: { domain: ['Cần đạt', 'Đã log'], range: [INDIGO, GREEN] } },
    legend: { color: { position: 'top', layout: { justifyContent: 'center' } } },
    style: { lineWidth: 2.5 },
    axis: {
      y: { title: 'Giờ lũy kế', labelFontSize },
      x: { title: false, labelFontSize, labelAutoHide: true },
    },
    tooltip: {
      title: (dd: any) => dd.full,
      items: [(dd: any) => ({ name: dd.type, value: fmtH(dd.value) })],
    },
  };

  // Equal-height cards: stretch both columns, fill the card body and centre the chart.
  const cardStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  };
  const bodyStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  };

  return (
    <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
      <Col xs={24} lg={12} style={{ display: 'flex' }}>
        <Card
          style={cardStyle}
          styles={{ body: bodyStyle }}
          title={<CardTitle icon={<CalendarOutlined />} title="Log theo ngày" sub="Giờ chuẩn vs thực tế đã log" />}
        >
          <DualAxes {...dailyConfig} />
          <div style={{ marginTop: 10 }}>
            <Legend color={token.colorTextSecondary} />
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={12} style={{ display: 'flex' }}>
        <Card
          style={cardStyle}
          styles={{ body: bodyStyle }}
          title={<CardTitle icon={<LineChartOutlined />} title="Lũy kế" sub="Tích lũy giờ theo ngày" />}
        >
          <Line {...cumConfig} />
        </Card>
      </Col>
    </Row>
  );
}

export default memo(ChartsRow);
