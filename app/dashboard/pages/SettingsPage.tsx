import { useEffect, useState } from 'react';
import { App, Card, Form, Input, Row, Col, Divider, Button, Typography, InputNumber, Space, Flex, Select } from 'antd';
import {
  QuestionCircleOutlined,
  SaveOutlined,
  SettingOutlined,
  UserOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { api } from '../../api';
import type { User } from '../../types';
import { useDashboard } from '../context';
import PageHeader from '../components/PageHeader';

const { Text } = Typography;

export default function SettingsPage() {
  const { message } = App.useApp();
  const { user, reloadUser, openGuide, autoReloadMinutes, setAutoReloadMinutes } = useDashboard();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [minutes, setMinutes] = useState(autoReloadMinutes);
  const [jiraProjects, setJiraProjects] = useState<{ id: string; key: string; name: string }[]>([]);

  useEffect(() => {
    api
      .get<{ projects: { id: string; key: string; name: string }[] }>('/api/projects')
      .then((res) => setJiraProjects(res.projects || []))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!user) return;
    form.setFieldsValue({
      email: user.email || '',
      full_name: user.full_name || '',
      department: user.department || '',
      job_title: user.job_title || '',
      password: '',
      confirm: '',
    });
    api
      .get<{ user: User }>('/api/me?full=1')
      .then((d) => {
        const me = d.user || ({} as User);
        form.setFieldsValue({
          email_jira: me.email_jira || me.email || '',
          token: me.token || '',
          account_id: me.account_id || '',
          cloud_id: me.cloud_id || '',
          base_url: me.base_url || '',
          projects: me.projects || [],
        });
      })
      .catch(() => { });
  }, [user, form]);

  const onSave = async () => {
    const v = await form.validateFields();
    const payload: Record<string, unknown> = {
      full_name: v.full_name.trim(),
      department: (v.department || '').trim(),
      job_title: (v.job_title || '').trim(),
      email_jira: (v.email_jira || '').trim(),
      token: (v.token || '').trim(),
      account_id: (v.account_id || '').trim(),
      cloud_id: (v.cloud_id || '').trim(),
      base_url: (v.base_url || '').trim(),
      projects: v.projects || [],
    };
    if (v.password) payload.password = v.password;
    setLoading(true);
    try {
      await api.put('/api/profile', payload);
      message.success('Cập nhật thông tin thành công!');
      await reloadUser();
    } catch (e: any) {
      message.error(`${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveReload = () => {
    setAutoReloadMinutes(minutes);
    message.success(
      minutes > 0
        ? `Đã đặt tự động đồng bộ mỗi ${minutes} phút.`
        : 'Đã tắt tự động đồng bộ.',
    );
  };

  return (
    <>
      {/* <PageHeader
        icon={<SettingOutlined />}
        title="Cài đặt cá nhân"
        subtitle="Thông tin tài khoản & kết nối Jira"
        showRefresh={false}
      /> */}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <>
                <UserOutlined style={{ marginInlineEnd: 8 }} />
                Thông tin & Kết nối Jira
              </>
            }
          >
            <Form form={form} layout="vertical" className="compact-form">
              <Divider orientation="left" plain style={{ margin: '2px 0 14px' }}>
                Thông tin cá nhân
              </Divider>
              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="full_name"
                    label="Họ & Tên"
                    rules={[{ required: true, message: 'Vui lòng nhập Họ & Tên.' }]}
                  >
                    <Input placeholder="Ví dụ: Nguyễn Văn A" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="department" label="Bộ phận">
                    <Input placeholder="Ví dụ: Acorneri IT" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="job_title" label="Chức danh">
                    <Input placeholder="Ví dụ: Backend Developer" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="email" label="Email (không thể thay đổi)">
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="projects" label="Dự án tham gia">
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder="Chọn các dự án tham gia"
                      options={jiraProjects.map((p) => ({ value: p.key, label: `${p.name} (${p.key})` }))}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" plain style={{ margin: '2px 0 14px' }}>
                Đổi mật khẩu <Text type="secondary">(để trống nếu không đổi)</Text>
              </Divider>
              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="password"
                    label="Mật khẩu mới"
                    rules={[{ min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự.' }]}
                  >
                    <Input.Password placeholder="••••••••" autoComplete="new-password" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="confirm"
                    label="Xác nhận mật khẩu"
                    dependencies={['password']}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!getFieldValue('password') || getFieldValue('password') === value)
                            return Promise.resolve();
                          return Promise.reject(new Error('Mật khẩu xác nhận không khớp.'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password placeholder="••••••••" autoComplete="new-password" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" plain style={{ margin: '2px 0 14px' }}>
                Kết nối Jira{' '}
                <Button type="link" size="small" icon={<QuestionCircleOutlined />} onClick={openGuide}>
                  Hướng dẫn
                </Button>
              </Divider>
              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item name="email_jira" label="Email Jira">
                    <Input placeholder="email@cty.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="token" label="Jira API Token">
                    <Input.Password placeholder="ATATT3xFf..." />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="account_id" label="Account ID">
                    <Input placeholder="712020:abc..." />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="cloud_id" label="Cloud ID">
                    <Input placeholder="eb9eb013-..." />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="base_url" label="Jira Base URL">
                    <Input placeholder="https://yourcompany.atlassian.net" />
                  </Form.Item>
                </Col>
              </Row>

              <Flex justify="flex-end">
                <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={onSave}>
                  Lưu thay đổi
                </Button>
              </Flex>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <>
                <SyncOutlined style={{ marginInlineEnd: 8 }} />
                Tùy chọn ứng dụng
              </>
            }
          >
            <Text type="secondary" style={{ fontSize: 13 }}>
              Tự động đồng bộ dữ liệu với Jira sau mỗi khoảng thời gian. Đặt <strong>0</strong> để tắt.
            </Text>
            <div style={{ marginTop: 12 }}>
              <Text strong>Tự động tải lại API mỗi</Text>
              <Space style={{ marginTop: 6, width: '100%' }} align="center" wrap>
                <InputNumber
                  min={0}
                  max={120}
                  value={minutes}
                  onChange={(v) => setMinutes(Number(v ?? 0))}
                  suffix="phút"
                  style={{ width: 140 }}
                />
                <Button type="primary" onClick={saveReload}>
                  Áp dụng
                </Button>
              </Space>
              <div style={{ marginTop: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Hiện tại:{' '}
                  <strong>
                    {autoReloadMinutes > 0 ? `mỗi ${autoReloadMinutes} phút` : 'đã tắt'}
                  </strong>
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </>
  );
}
