import { useEffect, useState } from 'react';
import {
  App,
  Card,
  Button,
  Table,
  Space,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ProjectOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { Navigate } from 'react-router-dom';
import { api } from '../../api';
import { useDashboard } from '../context';
import PageHeader from '../components/PageHeader';

interface ProjectItem {
  id: number;
  key: string;
  name: string;
}

export default function ProjectsPage() {
  const { message } = App.useApp();
  const { isAdmin } = useDashboard();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadProjects = async () => {
    setLoadingList(true);
    try {
      const d = await api.get<{ projects: ProjectItem[] }>('/api/projects');
      setProjects(d.projects || []);
    } catch (e: any) {
      message.error(`Lỗi tải danh sách dự án: ${e.message}`);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const onSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post<{ success: boolean; count: number }>('/api/projects/sync');
      if (res.success) {
        message.success(`Đồng bộ thành công ${res.count} dự án từ Jira!`);
        await loadProjects();
      }
    } catch (e: any) {
      message.error(`Lỗi đồng bộ dự án: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const columns: ColumnsType<ProjectItem> = [
    {
      title: 'Mã Dự án (Key)',
      dataIndex: 'key',
      key: 'key',
      render: (v) => <strong>{v}</strong>,
    },
    {
      title: 'Tên Dự án',
      dataIndex: 'name',
      key: 'name',
    },
  ];

  return (
    <>
      <PageHeader
        icon={<ProjectOutlined />}
        title="Quản lý dự án"
        subtitle="Quản trị viên cấu hình danh sách dự án cho hệ thống"
        showRefresh={false}
      />

      <Card
        title={
          <Space>
            <ProjectOutlined />
            <span>Danh sách dự án</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<SyncOutlined />}
            loading={syncing}
            onClick={onSync}
          >
            Đồng bộ từ Jira
          </Button>
        }
      >
        <Table<ProjectItem>
          rowKey="id"
          size="small"
          loading={loadingList}
          columns={columns}
          dataSource={projects}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </>
  );
}

