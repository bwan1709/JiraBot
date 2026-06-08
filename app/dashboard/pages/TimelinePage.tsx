import { Button, DatePicker, Space, Tag, Tooltip, Flex, Grid } from 'antd';
import { LeftOutlined, RightOutlined, ClockCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDashboard, DataGate } from '../context';
import PageHeader from '../components/PageHeader';
import DailyTimeline from '../components/DailyTimeline';
import { todayStr } from '../../utils/format';

const { useBreakpoint } = Grid;
const WEEKDAYS_VI = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export default function TimelinePage() {
  const { timelineDate, setTimelineDate, timelineReloadSignal, reloadTimeline, doRefresh } = useDashboard();
  const screens = useBreakpoint();
  const stacked = !screens.md;

  const d = timelineDate ? dayjs(timelineDate) : null;
  const today = todayStr();
  const isToday = timelineDate === today;
  const isWeekend = d ? d.day() === 0 || d.day() === 6 : false;
  const weekday = d ? WEEKDAYS_VI[d.day()] : '';

  const shift = (offset: number) => {
    if (!timelineDate) return;
    setTimelineDate(dayjs(timelineDate).add(offset, 'day').format('YYYY-MM-DD'));
  };

  const stepper = (
    <Space.Compact block={stacked}>
      <Tooltip title="Ngày trước đó">
        <Button icon={<LeftOutlined />} onClick={() => shift(-1)} disabled={!timelineDate} />
      </Tooltip>
      <DatePicker
        value={d}
        onChange={(x) => x && setTimelineDate(x.format('YYYY-MM-DD'))}
        allowClear={false}
        format="DD/MM/YYYY"
        variant="outlined"
        inputReadOnly
        style={stacked ? { flex: 1 } : { width: 148 }}
      />
      <Tooltip title="Ngày kế tiếp">
        <Button icon={<RightOutlined />} onClick={() => shift(1)} disabled={!timelineDate} />
      </Tooltip>
    </Space.Compact>
  );

  const weekdayTag = d && (
    <Tag
      icon={<CalendarOutlined />}
      color={isToday ? 'processing' : isWeekend ? 'warning' : 'default'}
      style={{ margin: 0 }}
    >
      {weekday}
      {isToday ? ' · Hôm nay' : ''}
    </Tag>
  );

  const dateNav = stacked ? (
    <Flex vertical gap={8} style={{ width: '100%' }}>
      {stepper}
      <Flex justify="space-between" align="center">
        {weekdayTag}
        <Button
          type="link"
          size="small"
          icon={<ClockCircleOutlined />}
          onClick={() => setTimelineDate(today)}
          disabled={isToday}
        >
          Hôm nay
        </Button>
      </Flex>
    </Flex>
  ) : (
    <Space size={8} wrap>
      {weekdayTag}
      {stepper}
      <Tooltip title="Về ngày hôm nay">
        <Button
          icon={<ClockCircleOutlined />}
          onClick={() => setTimelineDate(today)}
          disabled={isToday}
        >
          Hôm nay
        </Button>
      </Tooltip>
    </Space>
  );

  return (
    <>
      <PageHeader
        icon={<ClockCircleOutlined />}
        title="Timeline ngày"
        subtitle="Phân bổ worklog chi tiết trong khung giờ 8h – 17h"
        extra={dateNav}
        onRefresh={() => {
          doRefresh();
          reloadTimeline();
        }}
      />
      <DataGate>
        <DailyTimeline date={timelineDate} reloadSignal={timelineReloadSignal} />
      </DataGate>
    </>
  );
}
