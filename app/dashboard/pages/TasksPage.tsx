import { UnorderedListOutlined } from '@ant-design/icons';
import { useDashboard, DataGate } from '../context';
import PageHeader from '../components/PageHeader';
import TaskTable from '../components/TaskTable';

export default function TasksPage() {
  const { data, currentMonth, openWorklog, openStatus, openEdit } = useDashboard();
  return (
    <>
      <PageHeader
        icon={<UnorderedListOutlined />}
        title="Danh sách Tasks"
        subtitle="To-do · In Progress · Done · Thiếu thông tin"
      />
      <DataGate>
        <TaskTable
          data={data!}
          currentMonth={currentMonth!}
          onWorklog={openWorklog}
          onStatus={openStatus}
          onEdit={openEdit}
        />
      </DataGate>
    </>
  );
}
