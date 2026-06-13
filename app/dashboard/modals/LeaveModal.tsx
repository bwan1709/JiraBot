import { useEffect, useState } from 'react';
import { App, Modal, Form, DatePicker, InputNumber, Input, Button, Table, Popconfirm, Row, Col, Space, Divider } from 'antd';
import { CalendarOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, bust } from '../../api';
import { useDashboard } from '../context';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface LeaveDay {
  date: string;
  hours: number;
  comment?: string;
}

export default function LeaveModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const { currentMonth, applyData } = useDashboard();
  const [form] = Form.useForm();
  const [leaves, setLeaves] = useState<LeaveDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchLeaves = async () => {
    if (!currentMonth) return;
    setLoading(true);
    try {
      const res = await api.get<{ leaves: LeaveDay[] }>(`/api/leaves?month=${currentMonth}&${bust()}`);
      setLeaves(res.leaves || []);
    } catch (e: any) {
      message.error(`Lỗi tải danh sách nghỉ phép: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && currentMonth) {
      fetchLeaves();
      form.setFieldsValue({
        date: null,
        hours: 8,
        comment: '',
      });
    }
  }, [open, currentMonth]);

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        date: values.date.format('YYYY-MM-DD'),
        hours: values.hours,
        comment: values.comment || '',
      };
      const res = await api.post<{ success: boolean; data: any }>('/api/leaves', payload);
      if (res.data) {
        applyData(res.data);
      }
      message.success('Đã lưu ngày nghỉ phép!');
      form.resetFields(['date', 'comment']);
      form.setFieldsValue({ hours: 8 });
      fetchLeaves();
    } catch (e: any) {
      message.error(`Lỗi lưu ngày nghỉ phép: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (date: string) => {
    try {
      const res = await api.del<{ success: boolean; data: any }>(`/api/leaves/${date}`);
      if (res.data) {
        applyData(res.data);
      }
      message.success('Đã xóa ngày nghỉ phép!');
      fetchLeaves();
    } catch (e: any) {
      message.error(`Lỗi xóa ngày nghỉ phép: ${e.message}`);
    }
  };

  const disabledDate = (current: any) => {
    if (!currentMonth) return false;
    return current && current.format('YYYY-MM') !== currentMonth;
  };

  const columns = [
    {
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
      render: (text: string) => dayjs(text).format('DD/MM/YYYY'),
    },
    {
      title: 'Số giờ',
      dataIndex: 'hours',
      key: 'hours',
      render: (h: number) => `${h}h`,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: any, record: LeaveDay) => (
        <Popconfirm
          title="Xóa ngày nghỉ phép này?"
          okText="Xóa"
          cancelText="Hủy"
          onConfirm={() => handleDelete(record.date)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={
        <Space>
          <CalendarOutlined />
          <span>Quản lý Ngày nghỉ phép - Tháng {currentMonth}</span>
        </Space>
      }
      width={780}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>,
      ]}
      destroyOnClose
    >
      <Row gutter={24} style={{ marginTop: 16 }}>
        <Col xs={24} md={14}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Danh sách ngày nghỉ phép</div>
          <Table
            dataSource={leaves}
            columns={columns}
            rowKey="date"
            loading={loading}
            size="small"
            pagination={{ pageSize: 6, hideOnSinglePage: true }}
            locale={{ emptyText: 'Chưa đăng ký ngày nghỉ nào trong tháng này' }}
          />
        </Col>
        
        <Col xs={24} md={10}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Divider type="vertical" style={{ height: '100%', display: 'none' }} className="md-divider" />
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Thêm ngày nghỉ phép</div>
            <Form form={form} layout="vertical" onFinish={handleAdd}>
              <Form.Item
                name="date"
                label="Ngày nghỉ"
                rules={[{ required: true, message: 'Vui lòng chọn ngày nghỉ' }]}
              >
                <DatePicker style={{ width: '100%' }} disabledDate={disabledDate} format="DD/MM/YYYY" />
              </Form.Item>
              
              <Form.Item
                name="hours"
                label="Số giờ nghỉ"
                rules={[{ required: true, message: 'Vui lòng nhập số giờ nghỉ' }]}
              >
                <InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item style={{ marginBottom: 12 }}>
                <Space wrap>
                  <Button size="small" onClick={() => form.setFieldsValue({ hours: 8 })}>
                    Cả ngày (8h)
                  </Button>
                  <Button size="small" onClick={() => form.setFieldsValue({ hours: 4 })}>
                    Nửa ngày (4h)
                  </Button>
                </Space>
              </Form.Item>

              <Form.Item name="comment" label="Ghi chú / Lý do">
                <Input placeholder="Ví dụ: Nghỉ phép năm, nghỉ ốm..." />
              </Form.Item>

              <Form.Item style={{ marginTop: 8 }}>
                <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={submitting} block>
                  Thêm ngày nghỉ
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Col>
      </Row>
    </Modal>
  );
}
