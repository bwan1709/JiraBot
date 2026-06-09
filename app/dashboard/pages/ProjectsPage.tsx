import { useEffect, useState } from 'react';
import {
  App,
  Card,
  Form,
  Input,
  Row,
  Col,
  Button,
  Table,
  Space,
  Popconfirm,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ProjectOutlined,
  SaveOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
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
  const screens = useBreakpoint();
  const mobile = !screens.sm;
  const { isAdmin } = useDashboard();
  const [form] = Form.useForm();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  function useBreakpoint() {
    return Grid.useBreakpoint();
  }

  const reset = () => {
    setEditingId(null);
    form.resetFields();
  };

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
      reset();
      loadProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const startEdit = (p: ProjectItem) => {
    setEditingId(p.id);
    form.setFieldsValue({
      key: p.key,
      name: p.name,
    });
  };

  const onDelete = async (id: number) => {
    try {
      await api.del(`/api/projects/${id}`);
      message.success('Xóa dự án thành công!');
      await loadProjects();
      if (editingId === id) reset();
    } catch (e: any) {
      message.error(`Lỗi xóa dự án: ${e.message}`);
    }
  };

  const onSubmit = async () => {
    const v = await form.validateFields();
    const payload = {
      key: v.key.trim().toUpperCase(),
      name: v.name.trim(),
    };
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/projects/${editingId}`, payload);
        message.success('Cập nhật dự án thành công!');
      } else {
        await api.post('/api/projects', payload);
        message.success('Thêm dự án thành công!');
      }
      await loadProjects();
      reset();
    } catch (e: any) {
      message.error(`Lỗi lưu dự án: ${e.message}`);
    } finally {
      setSaving(false);
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
    {
      title: 'Thao tác',
      key: 'act',
      width: 150,
      align: 'center',
      render: (_v, p) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(p)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa dự án này?"
            description="Điều này có thể ảnh hưởng đến các báo cáo của tháng."
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(p.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
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

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            title={
              <>
                {editingId ? (
                  <EditOutlined style={{ marginInlineEnd: 8 }} />
                ) : (
                  <PlusOutlined style={{ marginInlineEnd: 8 }} />
                )}
                {editingId ? 'Cửa sổ cập nhật' : 'Thêm dự án mới'}
              </>
            }
          >
            <Form form={form} layout="vertical">
              <Form.Item
                name="key"
                label="Mã Dự án (Jira Project Key)"
                rules={[{ required: true, message: 'Nhập mã dự án (VD: ABC)' }]}
              >
                <Input placeholder="Ví dụ: PROJ" style={{ textTransform: 'uppercase' }} />
              </Form.Item>

              <Form.Item
                name="name"
                label="Tên Dự án"
                rules={[{ required: true, message: 'Nhập tên dự án' }]}
              >
                <Input placeholder="Ví dụ: Dự án Phát triển API" />
              </Form.Item>

              <Space style={{ justifyContent: 'flex-end', width: '100%', marginTop: 16 }}>
                <Button onClick={reset}>Hủy</Button>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSubmit}>
                  Lưu dự án
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={
              <>
                <ProjectOutlined style={{ marginInlineEnd: 8 }} />
                Danh sách dự án
              </>
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
        </Col>
      </Row>
    </>
  );
}
