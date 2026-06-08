import { memo } from 'react';
import { Layout, Button, Dropdown, Select, Avatar, Flex, Grid, Tooltip, theme, Typography, Switch, Divider } from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  PlusOutlined,
  ExportOutlined,
  LogoutOutlined,
  DownOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  CalendarOutlined,
  UserOutlined,
  SettingOutlined,
  BulbOutlined,
  BulbFilled,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { monthTabLabel } from '../../utils/format';
import { useThemeMode } from '../../theme';
import { useDashboard } from '../context';

const { Header } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

interface Props {
  collapsed: boolean;
  isMobile: boolean;
  onToggle: () => void;
}

function Topbar({ collapsed, isMobile, onToggle }: Props) {
  const { token } = theme.useToken();
  const { isDark, toggle } = useThemeMode();
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const { user, months, currentMonth, data, exporting, switchMonth, openAddMonth, handleExport, logout } =
    useDashboard();

  // On tiny screens (< sm) the export + theme controls fold into the avatar menu
  // to keep the topbar clean.
  const compact = !screens.sm;

  const exportItems: MenuProps['items'] = [
    { key: 'daily', icon: <CalendarOutlined />, label: 'Xuất báo cáo ngày' },
    { key: 'excel', icon: <FileExcelOutlined />, label: 'Xuất Excel (Tháng)' },
    { key: 'word', icon: <FileWordOutlined />, label: 'Xuất báo cáo tháng (Word)' },
  ];

  const userMenu: MenuProps['items'] = [
    {
      key: 'info',
      disabled: true,
      label: (
        <div style={{ lineHeight: 1.3, padding: '2px 0' }}>
          <div style={{ fontWeight: 600, color: token.colorText }}>{user?.full_name || 'User'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {user?.email}
          </Text>
        </div>
      ),
    },
    { type: 'divider' },
    ...(compact
      ? [
          {
            key: 'theme',
            icon: isDark ? <BulbFilled /> : <BulbOutlined />,
            label: isDark ? 'Chế độ sáng' : 'Chế độ tối',
          },
          { key: 'export', icon: <ExportOutlined />, label: 'Xuất báo cáo', children: exportItems },
          { type: 'divider' as const },
        ]
      : []),
    { key: 'settings', icon: <SettingOutlined />, label: 'Cài đặt cá nhân' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
  ];

  const onUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'settings') navigate('/settings');
    else if (key === 'logout') logout();
    else if (key === 'theme') toggle();
    else if (key === 'daily' || key === 'excel' || key === 'word')
      handleExport(key as 'daily' | 'excel' | 'word');
  };

  const lastUpdated = data?.last_updated
    ? new Date(data.last_updated).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    : null;

  const vDivider = <Divider type="vertical" style={{ height: 26, margin: '0 2px', borderColor: token.colorSplit }} />;

  return (
    <Header
      style={{
        background: token.colorBgContainer,
        padding: screens.md ? '0 20px' : '0 10px',
        height: 64,
        lineHeight: 'normal',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderBottom: `1px solid ${token.colorSplit}`,
        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
        position: 'sticky',
        top: 0,
        zIndex: 9,
      }}
    >
      {/* ── Left: nav + month controls ── */}
      <Flex align="center" gap={6} style={{ minWidth: 0, flex: compact ? 1 : undefined }}>
        <Button
          type="text"
          icon={
            isMobile ? <MenuUnfoldOutlined /> : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
          }
          onClick={onToggle}
        />
        {screens.sm && vDivider}
        {screens.sm && (
          <CalendarOutlined style={{ color: token.colorTextTertiary, fontSize: 16 }} />
        )}
        <Select
          value={currentMonth ?? undefined}
          onChange={switchMonth}
          placeholder="Tháng"
          style={compact ? { flex: 1, minWidth: 0 } : { width: 116 }}
          options={months.map((m) => ({ value: m, label: monthTabLabel(m) }))}
          notFoundContent="Chưa có tháng"
        />
        <Tooltip title="Thêm tháng">
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddMonth} />
        </Tooltip>
      </Flex>

      {/* ── Right: status + actions + theme + user ── */}
      <Flex align="center" gap={screens.md ? 10 : 6} style={{ flexShrink: 0 }}>
        {lastUpdated && screens.lg && (
          <Tooltip title="Thời điểm dữ liệu được đồng bộ gần nhất">
            <Flex
              align="center"
              gap={6}
              style={{ color: token.colorTextSecondary, fontSize: 12, whiteSpace: 'nowrap' }}
            >
              <ClockCircleOutlined />
              <span>{lastUpdated}</span>
            </Flex>
          </Tooltip>
        )}

        {!compact && (
          <Dropdown
            menu={{ items: exportItems, onClick: ({ key }) => handleExport(key as 'daily' | 'excel' | 'word') }}
            trigger={['click']}
          >
            {!screens.xl ? (
              <Tooltip title="Xuất báo cáo">
                <Button icon={<ExportOutlined />} loading={exporting} />
              </Tooltip>
            ) : (
              <Button icon={<ExportOutlined />} loading={exporting}>
                Xuất báo cáo <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            )}
          </Dropdown>
        )}

        {/* Theme switch — clearly shows light/dark state (in avatar menu on tiny screens) */}
        {!compact && (
          <Tooltip title={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}>
            <Switch
              checked={isDark}
              onChange={toggle}
              checkedChildren={<BulbFilled />}
              unCheckedChildren={<BulbOutlined />}
              style={{ background: isDark ? token.colorPrimary : token.colorTextQuaternary }}
            />
          </Tooltip>
        )}

        {!compact && vDivider}

        <Dropdown menu={{ items: userMenu, onClick: onUserMenuClick }} trigger={['click']}>
          <Flex
            align="center"
            gap={8}
            className="topbar-user"
            style={{ cursor: 'pointer', padding: '4px 8px 4px 4px', borderRadius: token.borderRadius }}
          >
            <Avatar size={32} style={{ background: token.colorPrimary, flexShrink: 0 }} icon={<UserOutlined />} />
            {screens.lg && (
              <>
                <Text style={{ maxWidth: 120 }} ellipsis>
                  {user?.full_name || 'User'}
                </Text>
                <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
              </>
            )}
          </Flex>
        </Dropdown>
      </Flex>
    </Header>
  );
}

export default memo(Topbar);
