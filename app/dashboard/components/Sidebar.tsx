import { memo } from 'react';
import { Layout, Menu, Flex, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  ClockCircleOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  SettingOutlined,
  CalendarOutlined,
  ProjectOutlined,
  EditOutlined,
  FileMarkdownOutlined,
} from '@ant-design/icons';
import { useDashboard } from '../context';

const { Sider } = Layout;
const { Text } = Typography;

/** Logo + nav menu — reused inside the desktop Sider and the mobile Drawer. */
export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { token } = theme.useToken();
  const { isAdmin, isPmOrAdmin } = useDashboard();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items: MenuProps['items'] = [
    { key: 'group-nav', type: 'group', label: collapsed ? '' : 'ĐIỀU HƯỚNG' },
    { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
    { key: '/timeline', icon: <ClockCircleOutlined />, label: 'Timeline ngày' },
    { key: '/tasks', icon: <UnorderedListOutlined />, label: 'Danh sách Tasks' },
    { type: 'divider' },
    { key: 'group-manage', type: 'group', label: collapsed ? '' : 'HỆ THỐNG' },
    { key: '/plans', icon: <CalendarOutlined />, label: isPmOrAdmin ? 'Quản lý kế hoạch' : 'Kế hoạch tháng' },
    ...(isAdmin ? [{ key: '/projects', icon: <ProjectOutlined />, label: 'Quản lý dự án' }] : []),
    ...(isAdmin ? [{ key: '/users', icon: <TeamOutlined />, label: 'Quản lý Users' }] : []),
    { key: '/settings', icon: <SettingOutlined />, label: 'Cài đặt cá nhân' },
    { key: 'group-utility', type: 'group', label: collapsed ? '' : 'TIỆN ÍCH' },
    { key: '/notes', icon: <EditOutlined />, label: 'Ghi chú nhanh' },
    { type: 'divider' },
    { key: 'group-tool', type: 'group', label: collapsed ? '' : 'CÔNG CỤ' },
    { key: '/markdowns', icon: <FileMarkdownOutlined />, label: 'Tài liệu Markdown' },
  ];

  return (
    <>
      <Flex
        align="center"
        gap={10}
        style={{ height: 64, padding: collapsed ? '0 0 0 22px' : '0 20px', overflow: 'hidden' }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 18,
            background: `linear-gradient(135deg, ${token.colorPrimary}, #8b5cf6)`,
          }}
        >
          <ClockCircleOutlined />
        </div>
        {!collapsed && (
          <div style={{ lineHeight: 1.1 }}>
            <Text strong style={{ fontSize: 16 }}>
              JiraBot
            </Text>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Time Tracker
              </Text>
            </div>
          </div>
        )}
      </Flex>

      <Menu
        mode="inline"
        selectedKeys={[pathname]}
        onClick={({ key }) => {
          navigate(key);
          onNavigate?.();
        }}
        items={items}
        style={{ borderInlineEnd: 'none', background: 'transparent' }}
      />
    </>
  );
}

interface Props {
  collapsed: boolean;
  onCollapse: (c: boolean) => void;
}

/** Desktop sticky sider (>= lg). On smaller screens the Layout uses a Drawer instead. */
function Sidebar({ collapsed, onCollapse }: Props) {
  const { token } = theme.useToken();
  return (
    <Sider
      width={232}
      collapsedWidth={80}
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      trigger={null}
      style={{
        borderRight: `1px solid ${token.colorSplit}`,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'auto',
      }}
    >
      <SidebarNav collapsed={collapsed} />
    </Sider>
  );
}

export default memo(Sidebar);
