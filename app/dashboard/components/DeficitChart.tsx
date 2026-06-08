import { memo } from 'react';
import { Card, Typography, Flex, Tag, Grid } from 'antd';
import { FundOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import type { MonthData } from '../../types';
import { fmtH } from '../../utils/format';
import { useThemeMode } from '../../theme';

const { Text } = Typography;
const { useBreakpoint } = Grid;

const TEAL = '#2dd4bf';
const ROSE = '#fb7185';
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function DeficitChart({ data }: { data: MonthData }) {
  const { isDark } = useThemeMode();
  const screens = useBreakpoint();
  const chartH = screens.lg ? 240 : screens.sm ? 220 : 190;
  const labelFontSize = screens.sm ? 11 : 9;

  const wds = data.working_days;
  const today = data.today;
  const todayIdx = wds.reduce((acc, d, idx) => (d.date <= today ? idx : acc), -1);
  const pastDays = wds.slice(0, todayIdx + 1);

  const chartData = pastDays.map((d) => ({
    x: String(parseInt(d.date.slice(8, 10), 10)),
    full: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)} · ${WD[new Date(d.date + 'T00:00:00').getDay()]}`,
    value: Math.round((d.logged - d.standard) * 100) / 100,
  }));
  const netTotal = Math.round(chartData.reduce((s, d) => s + d.value, 0) * 100) / 100;

  const config: any = {
    height: chartH,
    theme: isDark ? 'classicDark' : 'classic',
    autoFit: true,
    data: chartData,
    xField: 'x',
    yField: 'value',
    legend: false,
    style: {
      maxWidth: 22,
      radiusTopLeft: 3,
      radiusTopRight: 3,
      radiusBottomLeft: 3,
      radiusBottomRight: 3,
      fill: (d: any) => (d.value >= 0 ? TEAL : ROSE),
    },
    axis: {
      y: { title: 'Giờ', labelFontSize, labelFormatter: (v: number) => (v >= 0 ? `+${v}h` : `${v}h`) },
      x: { title: false, labelFontSize, labelAutoHide: true, labelAutoRotate: false },
    },
    tooltip: {
      title: (d: any) => d.full,
      items: [
        (d: any) => ({
          name: d.value >= 0 ? 'Thừa giờ' : 'Thiếu giờ',
          value: d.value === 0 ? 'Đúng chuẩn' : `${d.value > 0 ? '+' : ''}${fmtH(d.value)}`,
        }),
      ],
    },
  };

  return (
    <Card
      style={{ marginBottom: 16 }}
      title={
        <Flex align="center" gap={10}>
          <FundOutlined />
          <div>
            <div style={{ fontSize: 15 }}>Thiếu / Thừa từng ngày</div>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              + = thừa giờ &nbsp;|&nbsp; − = thiếu giờ
            </Text>
          </div>
        </Flex>
      }
      extra={
        <Tag color={netTotal >= 0 ? 'cyan' : 'red'} style={{ margin: 0, fontWeight: 600 }}>
          Tổng: {netTotal >= 0 ? '+' : ''}
          {fmtH(netTotal)}
        </Tag>
      }
    >
      <Column {...config} />
    </Card>
  );
}

export default memo(DeficitChart);
