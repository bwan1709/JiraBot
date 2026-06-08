import { memo } from 'react';
import type { ReactNode } from 'react';
import { Card, Col, Row, Typography, Flex, theme } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  RiseOutlined,
  AimOutlined,
} from '@ant-design/icons';
import type { MonthData } from '../../types';
import { fmtH } from '../../utils/format';

const { Text } = Typography;

interface Props {
  data: MonthData;
  currentMonth: string;
}

function StatCard({
  icon,
  accent,
  label,
  value,
  sub,
  valueColor,
}: {
  icon: ReactNode;
  accent: string;
  label: string;
  value: ReactNode;
  sub: string;
  valueColor?: string;
}) {
  return (
    <Card style={{ height: '100%' }}>
      <Flex align="flex-start" justify="space-between" gap={8}>
        <div style={{ minWidth: 0 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {label}
          </Text>
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25, color: valueColor }}>
            {value}
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {sub}
          </Text>
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            color: accent,
            background: `${accent}22`,
          }}
        >
          {icon}
        </div>
      </Flex>
    </Card>
  );
}

function StatsGrid({ data, currentMonth }: Props) {
  const { token } = theme.useToken();
  const net = data.net_to_date;
  const netNeg = net < 0;

  const filteredInProgress = (data.in_progress_tasks || []).filter(
    (t) => t.created && t.created.substring(0, 7) === currentMonth,
  ).length;
  const filteredTodo = (data.todo_tasks || []).filter(
    (t) =>
      t.issue_type &&
      t.issue_type.toLowerCase().includes('sub') &&
      (t.status || '').toUpperCase() !== 'IDEA' &&
      t.created &&
      t.created.substring(0, 7) === currentMonth,
  ).length;
  const grandTotal = data.task_count + filteredInProgress + filteredTodo;

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col flex="1 1 200px">
        <StatCard
          icon={<ClockCircleOutlined />}
          accent={token.colorPrimary}
          label="Giờ Chuẩn Tháng"
          value={`${data.standard_hours}h`}
          sub={`Tiêu chuẩn ${data.month_label}`}
        />
      </Col>
      <Col flex="1 1 200px">
        <StatCard
          icon={<CheckCircleOutlined />}
          accent={token.colorSuccess}
          label="Đã Log"
          value={fmtH(data.total_logged)}
          sub="Tổng tháng tính đến hôm nay"
        />
      </Col>
      <Col flex="1 1 200px">
        <StatCard
          icon={netNeg ? <WarningOutlined /> : <CheckCircleOutlined />}
          accent={netNeg ? token.colorError : token.colorSuccess}
          label={netNeg ? 'Đang Thiếu' : 'Đang Thừa'}
          value={`${netNeg ? '' : '+'}${fmtH(net)}`}
          valueColor={netNeg ? token.colorError : token.colorSuccess}
          sub={`Cần: ${data.required_to_date}h | Đã log: ${fmtH(data.logged_to_date)}`}
        />
      </Col>
      <Col flex="1 1 200px">
        <StatCard
          icon={<RiseOutlined />}
          accent={token.colorInfo}
          label="Tiến Độ Tháng"
          value={`${data.progress_pct}%`}
          sub={`${fmtH(data.total_logged)} / ${data.standard_hours}h`}
        />
      </Col>
      <Col flex="1 1 200px">
        <StatCard
          icon={<AimOutlined />}
          accent={token.colorWarning}
          label="Done / Tổng"
          value={
            <span>
              {data.task_count}
              <span style={{ fontSize: 16, fontWeight: 400, color: token.colorTextTertiary }}>
                {' '}
                / {grandTotal}
              </span>
            </span>
          }
          sub={`${data.task_count} done · ${filteredInProgress} in-progress · ${filteredTodo} to-do (tháng này)`}
        />
      </Col>
    </Row>
  );
}

export default memo(StatsGrid);
