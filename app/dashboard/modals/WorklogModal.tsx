import { useEffect, useState } from 'react';
import { App, Modal, Form, Input } from 'antd';
import { ClockCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '../../api';

interface Props {
  taskKey: string | null;
  onClose: () => void;
  onDone: () => void;
}

export default function WorklogModal({ taskKey, onClose, onDone }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (taskKey) form.resetFields();
  }, [taskKey, form]);

  const handleOk = async () => {
    const { timeSpent, comment } = await form.validateFields();
    setLoading(true);
    try {
      await api.post(`/api/issue/${taskKey}/worklog`, {
        timeSpent: timeSpent.trim(),
        comment: (comment || '').trim(),
      });
      message.success(`Ghi nhận ${timeSpent.trim()} thành công cho task ${taskKey}!`);
      onClose();
      onDone();
    } catch (e: any) {
      message.error(`Lỗi: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!taskKey}
      title={
        <>
          <ClockCircleOutlined style={{ marginInlineEnd: 8 }} />
          Ghi nhận thời gian (Log Work)
        </>
      }
      okText="Xác nhận"
      okButtonProps={{ icon: <SaveOutlined /> }}
      cancelText="Hủy"
      confirmLoading={loading}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
    >
      <div style={{ color: '#888', marginBottom: 12 }}>Log work cho task {taskKey}</div>
      <Form form={form} layout="vertical">
        <Form.Item
          name="timeSpent"
          label="Thời gian làm việc"
          rules={[{ required: true, message: 'Vui lòng nhập thời gian làm việc (ví dụ: 1h 30m, 45m)' }]}
        >
          <Input placeholder="Ví dụ: 2h, 45m, 1.5h, 1d" />
        </Form.Item>
        <Form.Item name="comment" label="Ghi chú (Comment)">
          <Input.TextArea rows={3} placeholder="Mô tả công việc đã làm..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
