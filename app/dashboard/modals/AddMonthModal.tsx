import { useEffect } from 'react';
import { Modal, Form, InputNumber, Typography } from 'antd';
import { CalendarOutlined, PlusOutlined } from '@ant-design/icons';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (ym: string) => void;
}

export default function AddMonthModal({ open, onClose, onSubmit }: Props) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      const now = new Date();
      form.setFieldsValue({ year: now.getFullYear(), month: now.getMonth() + 1 });
    }
  }, [open, form]);

  const handleOk = async () => {
    const { year, month } = await form.validateFields();
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    onSubmit(ym);
  };

  return (
    <Modal
      open={open}
      title={
        <>
          <CalendarOutlined style={{ marginInlineEnd: 8 }} />
          Thêm tháng mới
        </>
      }
      okText="Thêm & Cập nhật"
      okButtonProps={{ icon: <PlusOutlined /> }}
      cancelText="Hủy"
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
    >
      <Typography.Text type="secondary">
        Nhập tháng muốn theo dõi. Dữ liệu sẽ được tải từ Jira.
      </Typography.Text>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="year" label="Năm" rules={[{ required: true, message: 'Nhập năm' }]}>
          <InputNumber min={2024} max={2030} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="month"
          label="Tháng"
          rules={[{ required: true, message: 'Nhập tháng (1–12)' }]}
        >
          <InputNumber min={1} max={12} placeholder="1–12" style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
