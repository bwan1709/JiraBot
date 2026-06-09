import { useEffect, useState } from 'react';
import {
  App,
  Card,
  Form,
  Row,
  Col,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Space,
  InputNumber,
  Typography,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalendarOutlined,
  SaveOutlined,
  PlusOutlined,
  EditOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { Navigate } from 'react-router-dom';
import { api } from '../../api';
import type { MonthlyPlan } from '../../types';
import { useDashboard } from '../context';
import PageHeader from '../components/PageHeader';

const { useBreakpoint } = Grid;

export default function PlansPage() {
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const { isPmOrAdmin, user } = useDashboard();
  const [form] = Form.useForm();
  const selectedProjects = Form.useWatch<string[]>('projects', form) || [];
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [jiraProjects, setJiraProjects] = useState<{ id: string; key: string; name: string }[]>([]);
  const [editingYm, setEditingYm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const reset = () => {
    setEditingYm(null);
    form.resetFields();
    const now = new Date();
    form.setFieldsValue({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      projects: [],
      items: [],
    });
  };

  const loadPlans = async () => {
    setLoadingList(true);
    try {
      const d = await api.get<{ plans: MonthlyPlan[] }>('/api/monthly-plans');
      setPlans(d.plans || []);
    } catch (e: any) {
      message.error(`Lỗi tải danh sách kế hoạch: ${e.message}`);
    } finally {
      setLoadingList(false);
    }
  };

  const loadJiraProjects = async () => {
    try {
      const d = await api.get<{ projects: { id: string; key: string; name: string }[] }>('/api/projects');
      setJiraProjects(d.projects || []);
    } catch (e: any) {
      console.error('Lỗi tải dự án Jira:', e);
    }
  };

  useEffect(() => {
    loadPlans();
    if (isPmOrAdmin) {
      reset();
      loadJiraProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPmOrAdmin]);

  const startEdit = (p: MonthlyPlan) => {
    const [yStr, mStr] = p.year_month.split('-');
    setEditingYm(p.year_month);
    form.setFieldsValue({
      year: parseInt(yStr),
      month: parseInt(mStr),
      projects: p.projects || [],
      items: p.items || [],
    });
  };

  const onSubmit = async () => {
    const v = await form.validateFields();
    const ym = `${v.year}-${String(v.month).padStart(2, '0')}`;
    
    // Auto-generate title and description for legacy compatibility
    const title = (v.items || [])
      .map((it: any) => `[${it.project_key}] ${it.content}`)
      .join('\n');

    const payload = {
      year_month: ym,
      projects: v.projects || [],
      title,
      description: title,
      items: v.items || [],
    };
    setSaving(true);
    try {
      await api.post('/api/monthly-plans', payload);
      message.success(`Đã thiết lập kế hoạch cho tháng ${ym} thành công!`);
      await loadPlans();
      reset();
    } catch (e: any) {
      message.error(`Lỗi lưu kế hoạch: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<MonthlyPlan> = [
    {
      title: 'Tháng / Năm',
      dataIndex: 'year_month',
      key: 'ym',
      render: (v) => {
        const [y, m] = v.split('-');
        return <strong>Tháng {m}/{y}</strong>;
      },
    },
    {
      title: 'Chi tiết kế hoạch',
      dataIndex: 'items',
      key: 'items',
      render: (items: any[]) => {
        const userProjects = new Set((user?.projects || []).map(p => p.trim().toUpperCase()));
        const displayedItems = isPmOrAdmin
          ? (items || [])
          : (items || []).filter(it => userProjects.size === 0 || userProjects.has(it.project_key.toUpperCase()));

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: isPmOrAdmin ? 350 : '100%' }}>
            {Array.isArray(displayedItems) && displayedItems.length > 0 ? (
              displayedItems.map((it, idx) => (
                <div key={idx} style={{ fontSize: 13 }}>
                  • <strong style={{ color: '#1890ff' }}>[{it.project_key}]</strong> {it.content}
                </div>
              ))
            ) : (
              <span style={{ color: '#aaa' }}>Chưa cấu hình</span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Dự án áp dụng',
      dataIndex: 'projects',
      key: 'projects',
      render: (projs: string[]) => (
        <Space size={4} wrap style={{ maxWidth: 200 }}>
          {Array.isArray(projs) && projs.length > 0 ? (
            projs.map((p) => <Tag color="blue" key={p}>{p}</Tag>)
          ) : (
            <span style={{ color: '#aaa' }}>Chưa chọn dự án</span>
          )}
        </Space>
      ),
    },
    {
      title: 'Thao tác',
      key: 'act',
      width: 100,
      align: 'center',
      render: (_v, p) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(p)}>
          Sửa
        </Button>
      ),
    },
  ];

  const activeColumns = isPmOrAdmin ? columns : columns.filter(col => col.key !== 'act');

  return (
    <>
      <PageHeader
        icon={<CalendarOutlined />}
        title={isPmOrAdmin ? 'Quản lý kế hoạch tháng' : 'Kế hoạch tháng'}
        subtitle={isPmOrAdmin ? 'PM và Admin thiết lập danh sách dự án hoạt động cho từng tháng' : 'Xem kế hoạch chi tiết của các dự án bạn tham gia'}
        showRefresh={false}
      />

      <Row gutter={[16, 16]}>
        {isPmOrAdmin && (
          <Col xs={24} lg={10}>
            <Card
              title={
                <>
                  {editingYm ? (
                    <EditOutlined style={{ marginInlineEnd: 8 }} />
                  ) : (
                    <PlusOutlined style={{ marginInlineEnd: 8 }} />
                  )}
                  {editingYm ? 'Cập nhật kế hoạch' : 'Tạo kế hoạch tháng'}
                </>
              }
            >
              <Form form={form} layout="vertical">
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      name="year"
                      label="Năm"
                      rules={[{ required: true, message: 'Nhập năm' }]}
                    >
                      <InputNumber min={2024} max={2030} style={{ width: '100%' }} disabled={editingYm !== null} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="month"
                      label="Tháng"
                      rules={[{ required: true, message: 'Nhập tháng (1-12)' }]}
                    >
                      <InputNumber min={1} max={12} style={{ width: '100%' }} disabled={editingYm !== null} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="Chi tiết các đầu mục công việc kế hoạch" required>
                  <Form.List name="items">
                    {(fields, { add, remove }) => (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {fields.map(({ key, name, ...restField }) => (
                          <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <Form.Item
                                {...restField}
                                name={[name, 'content']}
                                rules={[{ required: true, message: 'Nhập nội dung công việc' }]}
                                style={{ marginBottom: 0 }}
                              >
                                <Input placeholder="Nội dung công việc (ví dụ: Triển khai Loyalty)" />
                              </Form.Item>
                            </div>
                            <div style={{ width: 120 }}>
                              <Form.Item
                                {...restField}
                                name={[name, 'project_key']}
                                rules={[{ required: true, message: 'Chọn dự án' }]}
                                style={{ marginBottom: 0 }}
                              >
                                <Select
                                  placeholder="Dự án"
                                  options={selectedProjects.map((p) => ({ value: p, label: p }))}
                                />
                              </Form.Item>
                            </div>
                            <Button
                              type="text"
                              danger
                              icon={<MinusCircleOutlined />}
                              onClick={() => remove(name)}
                              style={{ marginTop: 4 }}
                            />
                          </div>
                        ))}
                        <Form.Item style={{ marginBottom: 0 }}>
                          <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                            Thêm đầu mục kế hoạch
                          </Button>
                        </Form.Item>
                      </div>
                    )}
                  </Form.List>
                </Form.Item>

                <Form.Item
                  name="projects"
                  label="Các dự án hoạt động trong tháng"
                  rules={[{ required: true, message: 'Chọn ít nhất 1 dự án' }]}
                >
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="Chọn các dự án"
                    options={jiraProjects.map((p) => ({ value: p.key, label: `${p.name} (${p.key})` }))}
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 8 }}>
                  💡 <em>Lưu ý:</em> Đây là thông tin kế hoạch nội bộ để nhân viên theo dõi và thực hiện.
                </Typography.Paragraph>

                <Space style={{ justifyContent: 'flex-end', width: '100%', marginTop: 16 }}>
                  <Button onClick={reset}>Hủy</Button>
                  <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSubmit}>
                    Lưu kế hoạch
                  </Button>
                </Space>
              </Form>
            </Card>
          </Col>
        )}

        <Col xs={24} lg={isPmOrAdmin ? 14 : 24}>
          <Card
            title={
              <>
                <CalendarOutlined style={{ marginInlineEnd: 8 }} />
                Kế hoạch đã tạo
              </>
            }
          >
            <Table<MonthlyPlan>
              rowKey="year_month"
              size="small"
              loading={loadingList}
              columns={activeColumns}
              dataSource={plans}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
