import { memo } from 'react';
import type { ReactNode } from 'react';
import { Card, Progress, Flex, Typography, Grid } from 'antd';
import { BarChartOutlined, CheckCircleOutlined, ClockCircleOutlined, FlagOutlined } from '@ant-design/icons';
import type { MonthData } from '../../types';
import { fmtH } from '../../utils/format';

const { Text } = Typography;
const { useBreakpoint } = Grid;

function Bar({
  icon,
  label,
  pct,
  color,
  labelWidth,
}: {
  icon: ReactNode;
  label: string;
  pct: number;
  color: string;
  labelWidth: number;
}) {
  return (
    <Flex align="center" gap={12} style={{ marginBottom: 10 }}>
      <Text ellipsis style={{ width: labelWidth, fontSize: 13, flexShrink: 0 }}>
        <span style={{ color, marginInlineEnd: 6 }}>{icon}</span>
        {label}
      </Text>
      <div style={{ flex: 1 }}>
        <Progress percent={pct} strokeColor={color} showInfo={false} />
      </div>
      <Text strong style={{ width: 52, textAlign: 'right' }}>
        {pct}%
      </Text>
    </Flex>
  );
}

function ProgressBars({ data }: { data: MonthData }) {
  const screens = useBreakpoint();
  const labelWidth = screens.md ? 230 : 130;
  const pctLogged = Math.round(Math.min(100, (data.total_logged / data.standard_hours) * 100) * 10) / 10;
  const pctRequired =
    Math.round(Math.min(100, (data.required_to_date / data.standard_hours) * 100) * 10) / 10;

  return (
    <Card
      style={{ marginBottom: 16 }}
      title={
        <Flex align="center" gap={10}>
          <BarChartOutlined />
          <div>
            <div style={{ fontSize: 15 }}>Tiến độ tháng</div>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              So sánh giờ đã log vs giờ cần đạt tính đến hôm nay
            </Text>
          </div>
        </Flex>
      }
    >
      <Bar
        icon={<CheckCircleOutlined />}
        label={`Đã log (${fmtH(data.total_logged)})`}
        pct={pctLogged}
        color="#10b981"
        labelWidth={labelWidth}
      />
      <Bar
        icon={<ClockCircleOutlined />}
        label={`Cần đến hôm nay (${data.required_to_date}h)`}
        pct={pctRequired}
        color="#6366f1"
        labelWidth={labelWidth}
      />
      <Bar
        icon={<FlagOutlined />}
        label={`Mục tiêu tháng (${data.standard_hours}h)`}
        pct={100}
        color="#d9d9d9"
        labelWidth={labelWidth}
      />
    </Card>
  );
}

export default memo(ProgressBars);
