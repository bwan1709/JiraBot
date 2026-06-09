import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import { useDashboard, DataGate } from '../context';
import PageHeader from '../components/PageHeader';
import StatsGrid from '../components/StatsGrid';
import ProgressBars from '../components/ProgressBars';

const ChartsRow = lazy(() => import('../components/ChartsRow'));
const DeficitChart = lazy(() => import('../components/DeficitChart'));

const fallback = (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
    <Spin />
  </div>
);

export default function OverviewPage() {
  const { data, currentMonth, selectTimelineDate } = useDashboard();

  return (
    <>
      <PageHeader
        icon={<DashboardOutlined />}
        title="Tổng quan"
        subtitle="Tiến độ & phân bổ giờ công trong tháng"
      />
      <DataGate>
        <StatsGrid data={data!} currentMonth={currentMonth!} />
        <ProgressBars data={data!} />
        <Suspense fallback={fallback}>
          <ChartsRow data={data!} onSelectDate={selectTimelineDate} />
          <DeficitChart data={data!} />
        </Suspense>
      </DataGate>
    </>
  );
}
