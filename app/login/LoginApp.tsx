import { useState } from 'react';
import { App, Button, Card, Form, Input, Tabs, Typography, Alert, Flex, Tooltip, theme } from 'antd';
import {
  ClockCircleOutlined,
  MailOutlined,
  LockOutlined,
  BulbOutlined,
  BulbFilled,
} from '@ant-design/icons';
import { api } from '../api';
import { useThemeMode } from '../theme';

const { Title, Text } = Typography;

type LoginValues = { email: string; password: string };
type RegisterValues = { email: string; password: string; confirm: string };

export default function LoginApp() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { isDark, toggle } = useThemeMode();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loginLoading, setLoginLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  const onLogin = async (values: LoginValues) => {
    setLoginLoading(true);
    try {
      await api.post('/api/login', { email: values.email.trim(), password: values.password });
      message.success('Đăng nhập thành công! Đang chuyển hướng...');
      setTimeout(() => {
        window.location.href = '/';
      }, 600);
    } catch (e: any) {
      message.error(e.message || 'Đăng nhập không thành công.');
      setLoginLoading(false);
    }
  };

  const onRegister = async (values: RegisterValues) => {
    setRegLoading(true);
    try {
      await api.post('/api/register', { email: values.email.trim(), password: values.password });
      message.success('Đăng ký thành công! Đang chuyển hướng...');
      setTimeout(() => {
        window.location.href = '/';
      }, 800);
    } catch (e: any) {
      message.error(e.message || 'Đăng ký không thành công.');
      setRegLoading(false);
    }
  };

  return (
    <Flex
      align="center"
      justify="center"
      style={{
        minHeight: '100vh',
        padding: 20,
        position: 'relative',
        background: isDark
          ? 'radial-gradient(circle 600px at 30% 20%, rgba(139,92,246,0.12), transparent), #0b0d14'
          : 'radial-gradient(circle 600px at 30% 20%, rgba(99,102,241,0.10), transparent), #f4f5f8',
      }}
    >
      <Tooltip title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}>
        <Button
          type="text"
          shape="circle"
          icon={isDark ? <BulbFilled /> : <BulbOutlined />}
          onClick={toggle}
          style={{ position: 'absolute', top: 20, right: 20 }}
        />
      </Tooltip>
      <Card style={{ width: 420, maxWidth: '100%' }}>
        <Flex vertical align="center" gap={4} style={{ marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              color: '#fff',
              background: `linear-gradient(135deg, ${token.colorPrimary}, #8b5cf6)`,
            }}
          >
            <ClockCircleOutlined />
          </div>
          <Title level={3} style={{ margin: '8px 0 0' }}>
            JiraBot
          </Title>
          <Text type="secondary">Hệ thống báo cáo hiệu quả công việc</Text>
        </Flex>

        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'login' | 'register')}
          centered
          items={[
            {
              key: 'login',
              label: 'Đăng nhập',
              children: (
                <Form layout="vertical" requiredMark={false} onFinish={onLogin}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { required: true, message: 'Vui lòng nhập email.' },
                      { type: 'email', message: 'Email không hợp lệ.' },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined />}
                      placeholder="nhanvien@aconneri.vn"
                      autoComplete="username"
                      size="large"
                    />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="Mật khẩu"
                    rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      size="large"
                    />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 8 }}>
                    <Button type="primary" htmlType="submit" block size="large" loading={loginLoading}>
                      Đăng nhập
                    </Button>
                  </Form.Item>
                  <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
                    Chưa có tài khoản?{' '}
                    <a onClick={() => setTab('register')}>Đăng ký ngay</a>
                  </Text>
                </Form>
              ),
            },
            {
              key: 'register',
              label: 'Đăng ký',
              children: (
                <>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Sau khi đăng ký, hãy cập nhật thông tin Jira (Token, Cloud ID...) trong phần Cài đặt cá nhân để sử dụng đầy đủ tính năng."
                  />
                  <Form layout="vertical" requiredMark={false} onFinish={onRegister}>
                    <Form.Item
                      name="email"
                      label="Email"
                      rules={[
                        { required: true, message: 'Vui lòng nhập email.' },
                        { type: 'email', message: 'Email không hợp lệ.' },
                      ]}
                    >
                      <Input
                        prefix={<MailOutlined />}
                        placeholder="nhanvien@aconneri.vn"
                        autoComplete="username"
                        size="large"
                      />
                    </Form.Item>
                    <Form.Item
                      name="password"
                      label="Mật khẩu"
                      rules={[
                        { required: true, message: 'Vui lòng nhập mật khẩu.' },
                        { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự.' },
                      ]}
                    >
                      <Input.Password
                        prefix={<LockOutlined />}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        size="large"
                      />
                    </Form.Item>
                    <Form.Item
                      name="confirm"
                      label="Xác nhận mật khẩu"
                      dependencies={['password']}
                      rules={[
                        { required: true, message: 'Vui lòng xác nhận mật khẩu.' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('password') === value) return Promise.resolve();
                            return Promise.reject(new Error('Mật khẩu xác nhận không khớp.'));
                          },
                        }),
                      ]}
                    >
                      <Input.Password
                        prefix={<LockOutlined />}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        size="large"
                      />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 8 }}>
                      <Button type="primary" htmlType="submit" block size="large" loading={regLoading}>
                        Tạo tài khoản
                      </Button>
                    </Form.Item>
                    <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
                      Đã có tài khoản? <a onClick={() => setTab('login')}>Đăng nhập</a>
                    </Text>
                  </Form>
                </>
              ),
            },
          ]}
        />
      </Card>
    </Flex>
  );
}
