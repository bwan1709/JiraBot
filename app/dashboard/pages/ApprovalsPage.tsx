import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Typography, App, Divider, Input, Drawer, Descriptions } from 'antd';
import { CheckSquareOutlined, CheckCircleOutlined, ClockCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { api } from '../../api';
import PageHeader from '../components/PageHeader';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function ApprovalsPage() {
  const { message } = App.useApp();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Drawer states
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [comment, setComment] = useState('');
  const [approving, setApproving] = useState(false);

  const fetchPendingReports = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ reports: any[] }>('/api/reports/pending-approvals');
      setReports(res.reports || []);
    } catch (e: any) {
      message.error(e.message || 'Lỗi khi tải danh sách chờ duyệt');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingReports();
  }, []);

  const openDrawer = async (report: any) => {
    try {
      // Fetch full details including approvals and snapshot data
      const res = await api.get<{ report: any, approvals: any[] }>(`/api/reports/${report.id}`);
      setSelectedReport({ ...res.report, approvals: res.approvals });
      setDrawerVisible(true);
      setComment('');
    } catch (e: any) {
      message.error(e.message || 'Lỗi khi tải chi tiết báo cáo');
    }
  };

  const handleApprove = async () => {
    if (!selectedReport) return;
    setApproving(true);
    try {
      await api.post(`/api/reports/${selectedReport.id}/approve`, {
        comment
      });
      message.success('Đã duyệt báo cáo & ký số thành công!');
      setDrawerVisible(false);
      fetchPendingReports();
    } catch (e: any) {
      message.error(e.message || 'Lỗi khi duyệt báo cáo');
    } finally {
      setApproving(false);
    }
  };

  const columns = [
    { title: 'Kỳ báo cáo', dataIndex: 'year_month', key: 'year_month', render: (t: string) => <Text strong>{t}</Text> },
    { title: 'Nhân viên', dataIndex: 'submitter_name', key: 'submitter_name', render: (t: string, r: any) => <>{t || r.submitter_email}</> },
    { title: 'Ngày nộp', dataIndex: 'created_at', key: 'created_at', render: (t: string) => dayjs(t).format('DD/MM/YYYY HH:mm') },
    { title: 'Nhận xét NV', dataIndex: 'user_comment', key: 'user_comment' },
    { title: 'Thao tác', key: 'action', render: (_: any, record: any) => (
      <Button type="primary" size="small" onClick={() => openDrawer(record)}>Review & Duyệt</Button>
    )}
  ];

  return (
    <>
      <PageHeader
        icon={<CheckSquareOutlined />}
        title="Duyệt báo cáo"
        subtitle="Danh sách các báo cáo hiệu quả công việc đang chờ bạn phê duyệt"
        showRefresh={true}
        onRefresh={fetchPendingReports}
      />
      <div style={{ padding: '0 24px 24px' }}>
        <Card>
          <Table 
            dataSource={reports} 
            columns={columns} 
            rowKey="id" 
            loading={loading}
            pagination={false}
            locale={{ emptyText: 'Không có báo cáo nào đang chờ duyệt' }}
          />
        </Card>
      </div>

      <Drawer
        title={`Xét duyệt báo cáo tháng ${selectedReport?.year_month} - ${selectedReport?.submitter_name || selectedReport?.submitter_email}`}
        placement="right"
        width={600}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>Đóng</Button>
            <Button type="primary" onClick={handleApprove} loading={approving} icon={<CheckCircleOutlined />}>
              Ký & Phê duyệt
            </Button>
          </Space>
        }
      >
        {selectedReport && (
          <div>
            <Descriptions title="Thông tin chung" column={1} bordered size="small">
              <Descriptions.Item label="Người nộp">{selectedReport.submitter_name || selectedReport.submitter_email}</Descriptions.Item>
              <Descriptions.Item label="Kỳ báo cáo">{selectedReport.year_month}</Descriptions.Item>
              <Descriptions.Item label="Ngày nộp">{dayjs(selectedReport.created_at).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="Nhân viên nhận xét">{selectedReport.user_comment || <i>Không có</i>}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Nhận xét của Quản lý (Bạn)</Divider>
            <TextArea 
              rows={4} 
              value={comment} 
              onChange={(e) => setComment(e.target.value)} 
              placeholder="Nhập nhận xét đánh giá hiệu suất của nhân sự trong tháng này..." 
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Khi bấm <strong>Phê duyệt</strong>, hệ thống sẽ tự động đính kèm chữ ký số của bạn vào báo cáo này. 
                Đảm bảo bạn đã cấu hình chữ ký trong phần Cài đặt cá nhân.
              </Text>
            </div>

            {selectedReport.approvals && selectedReport.approvals.length > 0 && (
              <>
                <Divider orientation="left">Lịch sử phê duyệt</Divider>
                {selectedReport.approvals.map((ap: any) => (
                  <Card key={ap.id} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong>{ap.approver_name} ({ap.approver_title || 'Quản lý'})</Text>
                      <Text type="secondary">{dayjs(ap.approved_at).format('DD/MM/YYYY HH:mm')}</Text>
                    </div>
                    {ap.comment && <div style={{ marginTop: 8 }}><i>"{ap.comment}"</i></div>}
                    {ap.signature_url && (
                      <div style={{ marginTop: 8 }}>
                        <img src={ap.signature_url} alt="Signature" style={{ maxHeight: 60, border: '1px solid #ddd', padding: 4, background: '#fff' }} />
                      </div>
                    )}
                  </Card>
                ))}
              </>
            )}

            <Divider orientation="left">Dữ liệu Snapshot (Sơ lược)</Divider>
            {/* Realistically, here we would render a summary of the snapshot_data JSON. For now, just indicate it's attached. */}
            <Card size="small" style={{ background: '#f5f5f5' }}>
              <Text type="secondary">Dữ liệu từ Jira (Tasks, Time logged) đã được chốt và đính kèm trong báo cáo này. Tính năng hiển thị chi tiết Snapshot đang được phát triển.</Text>
            </Card>
          </div>
        )}
      </Drawer>
    </>
  );
}
