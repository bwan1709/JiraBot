import type { ReactNode } from 'react';
import { Flex, Typography, Button, Space, Grid, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useDashboard } from '../context';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

interface Props {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  /** Show the per-screen refresh button (default true). */
  showRefresh?: boolean;
  /** Override the refresh handler (e.g. also reload the timeline). */
  onRefresh?: () => void;
}

export default function PageHeader({ icon, title, subtitle, extra, showRefresh = true, onRefresh }: Props) {
  const { doRefresh, refreshing } = useDashboard();
  const screens = useBreakpoint();
  const stack = !screens.md; // compact layout on phones / small tablets

  const titleBlock = (
    <div style={{ minWidth: 0 }}>
      <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon}
        <span>{title}</span>
      </Title>
      {subtitle && (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {subtitle}
        </Text>
      )}
    </div>
  );

  const refreshBtn = showRefresh && (
    <Button
      type="primary"
      icon={<ReloadOutlined />}
      loading={refreshing}
      onClick={onRefresh ?? doRefresh}
    >
      {stack ? '' : 'Cập nhật'}
    </Button>
  );

  // ── Mobile / small: title + icon-only refresh on one row, extra below ──
  if (stack) {
    return (
      <div style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="flex-start" gap={8}>
          {titleBlock}
          {showRefresh && <Tooltip title="Cập nhật">{refreshBtn}</Tooltip>}
        </Flex>
        {extra && <div style={{ marginTop: 12 }}>{extra}</div>}
      </div>
    );
  }

  // ── Desktop: title left, actions right ──
  return (
    <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
      {titleBlock}
      {(extra || showRefresh) && (
        <Space wrap>
          {extra}
          {refreshBtn}
        </Space>
      )}
    </Flex>
  );
}
