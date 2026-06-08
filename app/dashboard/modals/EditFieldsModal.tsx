import { useEffect, useState } from 'react';
import { App, Modal, Form, Input, InputNumber, DatePicker, Select, Row, Col } from 'antd';
import { EditOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../api';
import type { Task } from '../../types';
import { secondsToJiraEstimate, toJiraIsoDateTime } from '../../utils/format';

interface Props {
  task: Task | null;
  onClose: () => void;
  onDone: () => void;
}

// Labels rarely change during a session — cache the list so the picker is instant
// after the first open. Reset on a full page reload.
let LABELS_CACHE: string[] | null = null;

export default function EditFieldsModal({ task, onClose, onDone }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [labelOptions, setLabelOptions] = useState<string[]>(LABELS_CACHE ?? []);
  const [labelsLoading, setLabelsLoading] = useState(false);

  const isSubtask = !!task && task.issue_type.toLowerCase().includes('sub');

  useEffect(() => {
    if (!task) return;
    form.setFieldsValue({
      parentKey: task.parent_key || '',
      originalEstimate: secondsToJiraEstimate(task.original_estimate),
      storyPoints: task.story_points ?? null,
      labels: task.labels || [],
      startDate: task.start_date ? dayjs(task.start_date) : null,
      dueDate: task.duedate ? dayjs(task.duedate) : null,
      actualStart: task.actual_start ? dayjs(task.actual_start) : null,
      actualEnd: task.actual_end ? dayjs(task.actual_end) : null,
    });
  }, [task, form]);

  // Load the full label list from Jira (cached) when the modal opens.
  useEffect(() => {
    if (!task || LABELS_CACHE) return;
    setLabelsLoading(true);
    api
      .get<{ labels: string[] }>('/api/labels')
      .then((d) => {
        LABELS_CACHE = d.labels || [];
        setLabelOptions(LABELS_CACHE);
      })
      .catch(() => {
        /* labels are optional — "tags" mode still lets the user type their own */
      })
      .finally(() => setLabelsLoading(false));
  }, [task]);

  const handleOk = async () => {
    if (!task) return;
    const v = await form.validateFields();
    setLoading(true);
    try {
      await api.post(`/api/issue/${task.key}/update-fields`, {
        originalEstimate: (v.originalEstimate || '').trim(),
        labels: Array.isArray(v.labels) ? v.labels : [],
        parentKey: (v.parentKey || '').trim(),
        duedate: v.dueDate ? v.dueDate.format('YYYY-MM-DD') : '',
        startDate: v.startDate ? v.startDate.format('YYYY-MM-DD') : '',
        storyPoints: v.storyPoints === null || v.storyPoints === undefined ? '' : String(v.storyPoints),
        actualStart: v.actualStart ? toJiraIsoDateTime(v.actualStart.format('YYYY-MM-DDTHH:mm')) : null,
        actualEnd: v.actualEnd ? toJiraIsoDateTime(v.actualEnd.format('YYYY-MM-DDTHH:mm')) : null,
      });
      message.success(`Cập nhật thông tin task ${task.key} thành công!`);
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
      open={!!task}
      title={
        <>
          <EditOutlined style={{ marginInlineEnd: 8 }} />
          Chỉnh sửa thông tin Task
        </>
      }
      okText="Lưu thay đổi"
      okButtonProps={{ icon: <SaveOutlined /> }}
      cancelText="Hủy"
      width={680}
      confirmLoading={loading}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
    >
      <div style={{ color: '#888', marginBottom: 12 }}>Cập nhật thông tin cho task {task?.key}</div>
      <Form form={form} layout="vertical" className="compact-form">
        <Row gutter={16}>
          {isSubtask && (
            <Col span={24}>
              <Form.Item name="parentKey" label="Parent Task Key (Chỉ cho Subtask)">
                <Input placeholder="Ví dụ: EXDMS-2500" />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} sm={12}>
            <Form.Item name="originalEstimate" label="Original Estimate (Ước lượng)">
              <Input placeholder="Ví dụ: 1d, 4h, 2h 30m" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="storyPoints" label="Story Point Estimate">
              <InputNumber step={0.5} style={{ width: '100%' }} placeholder="Ví dụ: 1, 2, 3, 5" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="labels" label="Nhãn (Labels)">
              <Select
                mode="tags"
                placeholder="Chọn nhãn có sẵn hoặc nhập nhãn mới..."
                loading={labelsLoading}
                options={labelOptions.map((l) => ({ value: l, label: l }))}
                tokenSeparators={[',', ' ']}
                allowClear
                maxTagCount="responsive"
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="startDate" label="Start Date (Ngày bắt đầu)">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="dueDate" label="Due Date (Hạn chót)">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="actualStart" label="Actual Start (Thực tế bắt đầu)">
              <DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="actualEnd" label="Actual End (Thực tế hoàn thành)">
              <DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
