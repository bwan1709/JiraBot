import { useEffect, useState } from 'react';
import { App, Modal, Select, Typography } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { api } from '../../api';
import type { Task, Transition } from '../../types';

interface Props {
  task: Task | null;
  onClose: () => void;
  onDone: () => void;
}

export default function StatusModal({ task, onClose, onDone }: Props) {
  const { message } = App.useApp();
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!task) return;
    setSelected(undefined);
    setTransitions([]);
    setLoadingList(true);
    api
      .get<{ transitions: Transition[] }>(`/api/issue/${task.key}/transitions?t=${Date.now()}`)
      .then((d) => setTransitions(d.transitions || []))
      .catch((e) => message.error(`Lỗi tải trạng thái: ${e.message}`))
      .finally(() => setLoadingList(false));
  }, [task, message]);

  const handleOk = async () => {
    if (!selected || !task) {
      message.error('Vui lòng chọn trạng thái mới.');
      return;
    }
    const trans = transitions.find((t) => t.id === selected);
    setSubmitting(true);
    try {
      await api.post(`/api/issue/${task.key}/transition`, {
        transitionId: selected,
        toStatus: trans?.toStatus,
        issueType: task.issue_type,
      });
      message.success(`Chuyển trạng thái task ${task.key} thành công!`);
      onClose();
      onDone();
    } catch (e: any) {
      message.error(`Lỗi: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={!!task}
      title={
        <>
          <SwapOutlined style={{ marginInlineEnd: 8 }} />
          Đổi trạng thái Task
        </>
      }
      okText="Thay đổi"
      cancelText="Hủy"
      okButtonProps={{ icon: <SwapOutlined />, disabled: !selected }}
      confirmLoading={submitting}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
    >
      <div style={{ color: '#888', marginBottom: 12 }}>Chuyển trạng thái cho task {task?.key}</div>
      <Typography.Text strong>Trạng thái hiện tại: </Typography.Text>
      <Typography.Text>{task?.status}</Typography.Text>
      <Select
        style={{ width: '100%', marginTop: 12 }}
        placeholder="Chọn trạng thái mới..."
        loading={loadingList}
        value={selected}
        onChange={setSelected}
        notFoundContent={loadingList ? 'Đang tải...' : 'Không có trạng thái chuyển đổi khả dụng'}
        options={transitions.map((t) => ({ label: t.toStatus, value: t.id }))}
      />
    </Modal>
  );
}
