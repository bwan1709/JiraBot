import { useEffect, useState } from 'react';
import { Layout as AntLayout, Grid, Drawer } from 'antd';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar, { SidebarNav } from './components/Sidebar';
import Topbar from './components/Topbar';

const { Content } = AntLayout;
const { useBreakpoint } = Grid;

export default function Layout() {
  const screens = useBreakpoint();
  const { pathname } = useLocation();

  // `lg` is the cut-off: >= lg shows the docked sider, below shows a Drawer.
  const isMobile = !screens.lg;
  const [collapsed, setCollapsed] = useState(false); // desktop collapse
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile drawer

  // Close the drawer when crossing up to desktop.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  const onToggle = () => {
    if (isMobile) setDrawerOpen((o) => !o);
    else setCollapsed((c) => !c);
  };

  const pad = screens.xl ? 24 : screens.md ? 20 : 12;

  return (
    <AntLayout style={{ minHeight: '100vh' }} hasSider>
      {!isMobile && <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />}

      <Drawer
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        width={232}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <SidebarNav onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <AntLayout>
        <Topbar collapsed={collapsed} isMobile={isMobile} onToggle={onToggle} />
        <Content style={{ padding: pad }}>
          {/* key={pathname} re-triggers the fade-in on each route change */}
          <div key={pathname} className="jb-page" style={{ width: '100%' }}>
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
