import { useEffect, useState } from 'react';
import {
  App,
  Card,
  Form,
  Input,
  Row,
  Col,
  Select,
  Button,
  Table,
  Tag,
  Space,
  Popconfirm,
  Divider,
  Typography,
  List,
  Grid,
  Flex,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  TeamOutlined,
  UserAddOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Navigate } from 'react-router-dom';
import { api } from '../../api';
import type { User } from '../../types';
import { useDashboard } from '../context';
import PageHeader from '../components/PageHeader';

const { Text } = Typography;
const { useBreakpoint } = Grid;

export default function UsersPage() {
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const mobile = !screens.sm;
  const { user: currentUser, isAdmin, reloadUser } = useDashboard();
  const [form] = Form.useForm();
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const reset = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ role: 'client' });
  };

  const loadUsers = async () => {
    setLoadingList(true);
    try {
      const d = await api.get<{ users: User[] }>('/api/users');
      setUsers(d.users);
    } catch (e: any) {
      message.error(`Lỗi: ${e.message}`);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      reset();
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const startEdit = (u: User) => {
    setEditingId(u.id);
    form.setFieldsValue({
      email: u.email,
      password: '',
      full_name: u.full_name || '',
      department: u.department || '',
      job_title: u.job_title || '',
      role: u.role || 'client',
      token: u.token || '',
      account_id: u.account_id || '',
      cloud_id: u.cloud_id || '',
      base_url: u.base_url || '',
    });
  };

  const onSubmit = async () => {
    const v = await form.validateFields();
    const payload: Record<string, unknown> = {
      email: v.email.trim(),
      token: v.token.trim(),
      cloud_id: v.cloud_id.trim(),
      account_id: v.account_id.trim(),
      base_url: v.base_url.trim(),
      full_name: v.full_name.trim(),
      role: v.role,
      department: v.department.trim(),
      job_title: (v.job_title || '').trim(),
    };
    if (!editingId || (v.password && v.password.trim() !== '')) {
      payload.password = v.password || 'ilovecds';
    }
    setSaving(true);
    try {
      if (editingId) await api.put(`/api/users/${editingId}`, payload);
      else await api.post('/api/users', payload);
      message.success(`${editingId ? 'Cập nhật' : 'Thêm mới'} người dùng thành công!`);
      if (editingId && currentUser && editingId === currentUser.id) await reloadUser();
      await loadUsers();
      reset();
    } catch (e: any) {
      message.error(`Lỗi: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (currentUser && id === currentUser.id) {
      message.error('Không thể tự xóa tài khoản của chính mình!');
      return;
    }
    try {
      await api.del(`/api/users/${id}`);
      message.success('Xóa người dùng thành công!');
      await loadUsers();
    } catch (e: any) {
      message.error(`Lỗi: ${e.message}`);
    }
  };

  const columns: ColumnsType<User> = [
    { title: 'Họ & Tên', dataIndex: 'full_name', render: (v) => <strong>{v || '—'}</strong> },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Quyền',
      dataIndex: 'role',
      render: (v) => <Tag color={v === 'admin' ? 'green' : 'default'}>{v === 'admin' ? 'Admin' : 'Client'}</Tag>,
    },
    {
      title: 'Chức danh / Bộ phận',
      key: 'jd',
      render: (_v, u) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {u.job_title || '—'} / {u.department || '—'}
        </Text>
      ),
    },
    {
      title: 'Thao tác',
      key: 'act',
      width: 150,
      align: 'center',
      render: (_v, u) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(u)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa người dùng này?"
            description="Thao tác này không thể hoàn tác."
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(u.id)}
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
        icon={<TeamOutlined />}
        title="Quản lý Users"
        subtitle="Thêm, chỉnh sửa hoặc xóa tài khoản hệ thống"
        showRefresh={false}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card
            title={
              <>
                {editingId ? (
                  <EditOutlined style={{ marginInlineEnd: 8 }} />
                ) : (
                  <UserAddOutlined style={{ marginInlineEnd: 8 }} />
                )}
                {editingId ? 'Sửa người dùng' : 'Thêm người dùng'}
              </>
            }
          >
            <Form form={form} layout="vertical" initialValues={{ role: 'client' }}>
              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { required: true, message: 'Nhập email' },
                      { type: 'email', message: 'Email không hợp lệ' },
                    ]}
                  >
                    <Input placeholder="nhanvien@aconneri.vn" autoComplete="off" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="password" label="Mật khẩu (mặc định: ilovecds)">
                    <Input.Password placeholder="Để trống nếu giữ nguyên" autoComplete="new-password" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="full_name" label="Họ & Tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
                    <Input placeholder="Nguyễn Văn A" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="department" label="Bộ phận" rules={[{ required: true, message: 'Nhập bộ phận' }]}>
                    <Input placeholder="Acorneri IT" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="job_title" label="Chức danh" rules={[{ required: true, message: 'Nhập chức danh' }]}>
                    <Input placeholder="Backend Developer" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="role" label="Quyền hệ thống">
                    <Select
                      options={[
                        { value: 'client', label: 'Client' },
                        { value: 'admin', label: 'Admin' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" plain>
                Kết nối Jira
              </Divider>
              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item name="token" label="Jira API Token" rules={[{ required: true, message: 'Nhập token' }]}>
                    <Input.Password placeholder="API Token Jira" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="account_id" label="Account ID" rules={[{ required: true, message: 'Nhập Account ID' }]}>
                    <Input placeholder="Account ID" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="cloud_id" label="Cloud ID" rules={[{ required: true, message: 'Nhập Cloud ID' }]}>
                    <Input placeholder="Cloud ID" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="base_url" label="Base URL" rules={[{ required: true, message: 'Nhập Base URL' }]}>
                    <Input placeholder="https://x.atlassian.net" />
                  </Form.Item>
                </Col>
              </Row>

              <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                <Button onClick={reset}>Reset</Button>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSubmit}>
                  {editingId ? 'Cập nhật User' : 'Lưu User'}
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card
            title={
              <>
                <UnorderedListOutlined style={{ marginInlineEnd: 8 }} />
                Danh sách người dùng
              </>
            }
          >
            {mobile ? (
              <List<User>
                loading={loadingList}
                dataSource={users}
                split={false}
                locale={{ emptyText: 'Chưa có người dùng' }}
                renderItem={(u) => (
                  <Card size="small" style={{ marginBottom: 8 }} styles={{ body: { padding: 12 } }}>
                    <Flex justify="space-between" align="flex-start" gap={8}>
                      <div style={{ minWidth: 0 }}>
                        <strong>{u.full_name || '—'}</strong>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {u.email}
                          </Text>
                        </div>
                      </div>
                      <Tag color={u.role === 'admin' ? 'green' : 'default'} style={{ margin: 0 }}>
                        {u.role === 'admin' ? 'Admin' : 'Client'}
                      </Tag>
                    </Flex>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {u.job_title || '—'} / {u.department || '—'}
                    </Text>
                    <Flex gap={6} style={{ marginTop: 10 }}>
                      <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(u)}>
                        Sửa
                      </Button>
                      <Popconfirm
                        title="Xóa người dùng này?"
                        description="Thao tác này không thể hoàn tác."
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => onDelete(u.id)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />}>
                          Xóa
                        </Button>
                      </Popconfirm>
                    </Flex>
                  </Card>
                )}
              />
            ) : (
              <Table<User>
                rowKey="id"
                size="small"
                loading={loadingList}
                columns={columns}
                dataSource={users}
                pagination={false}
                scroll={{ x: 'max-content' }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
