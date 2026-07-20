import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Typography, App, Divider, Input } from 'antd';
import { SendOutlined, CheckCircleOutlined, ClockCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { api } from '../../api';
import { useDashboard } from '../context';
import PageHeader from '../components/PageHeader';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function MyReportsPage() {
  const { message } = App.useApp();
  const { currentMonth } = useDashboard();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [comment, setComment] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ reports: any[] }>('/api/reports/my-reports');
      setReports(res.reports || []);
    } catch (e: any) {
      message.error(e.message || 'Lỗi khi tải báo cáo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleSubmit = async () => {
    if (!currentMonth) return;
    setSubmitting(true);
    try {
      // Refresh logic to snapshot data
      const data = await api.post<any>(`/api/refresh/${currentMonth}`);
      
      await api.post('/api/reports/submit', {
        year_month: currentMonth,
        snapshot_data: JSON.stringify(data),
        user_comment: comment
      });
      message.success('Đã nộp báo cáo thành công!');
      setIsModalVisible(false);
      setComment('');
      fetchReports();
    } catch (e: any) {
      message.error(e.message || 'Lỗi khi nộp báo cáo');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'pending': return <Tag icon={<ClockCircleOutlined />} color="warning">Chờ duyệt</Tag>;
      case 'approved': return <Tag icon={<CheckCircleOutlined />} color="success">Đã duyệt</Tag>;
      case 'rejected': return <Tag color="error">Từ chối</Tag>;
      default: return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    { title: 'Kỳ báo cáo', dataIndex: 'year_month', key: 'year_month', render: (t: string) => <Text strong>{t}</Text> },
    { title: 'Ngày nộp', dataIndex: 'created_at', key: 'created_at', render: (t: string) => dayjs(t).format('DD/MM/YYYY HH:mm') },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: renderStatus },
    { title: 'Thao tác', key: 'action', render: (_: any, record: any) => (
      <Button type="link" icon={<EyeOutlined />}>Xem chi tiết</Button>
    )}
  ];

  return (
    <>
      <PageHeader
        icon={<SendOutlined />}
        title="Báo cáo của tôi"
        subtitle="Khởi tạo và theo dõi trạng thái báo cáo tháng"
        showRefresh={true}
        onRefresh={fetchReports}
      />
      <div style={{ padding: '0 24px 24px' }}>
        <Card>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>Kỳ hiện tại: <strong>{currentMonth}</strong></Text>
            <Button type="primary" icon={<SendOutlined />} onClick={() => setIsModalVisible(true)}>
              Nộp báo cáo tháng {currentMonth}
            </Button>
          </div>
          <Table 
            dataSource={reports} 
            columns={columns} 
            rowKey="id" 
            loading={loading}
            pagination={false}
          />
        </Card>
      </div>

      <Modal
        title={`Nộp báo cáo hiệu quả công việc - ${currentMonth}`}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={submitting}
        okText="Chốt số liệu & Gửi phê duyệt"
        cancelText="Hủy"
        width={600}
      >
        <Paragraph>
          Hệ thống sẽ tiến hành <strong>chốt số liệu Jira</strong> tại thời điểm này. 
          Các thay đổi trên Jira sau khi bạn ấn "Gửi phê duyệt" sẽ không được cập nhật vào báo cáo này nữa.
        </Paragraph>
        <Divider />
        <Text strong>Nhận xét cá nhân / Đề xuất (Tùy chọn):</Text>
        <TextArea 
          rows={4} 
          value={comment} 
          onChange={(e) => setComment(e.target.value)} 
          placeholder="Nhập những khó khăn hoặc đề xuất trong tháng..." 
          style={{ marginTop: 8 }}
        />
      </Modal>
    </>
  );
}
