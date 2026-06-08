import { Modal, Typography, Card, Space, theme, Flex } from 'antd';
import { BulbOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
}

const Step = ({ num, title, children }: { num: number; title: string; children: React.ReactNode }) => {
  const { token } = theme.useToken();
  return (
    <Card size="small" style={{ background: token.colorFillQuaternary }}>
      <Flex align="center" gap={8}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            background: token.colorPrimary,
          }}
        >
          {num}
        </span>
        <Text strong style={{ color: token.colorPrimary }}>
          {title}
        </Text>
      </Flex>
      <div style={{ marginTop: 8, fontSize: 13 }}>{children}</div>
    </Card>
  );
};

export default function JiraGuideModal({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      title={
        <>
          <BulbOutlined style={{ marginInlineEnd: 8 }} />
          Hướng dẫn cấu hình kết nối Jira
        </>
      }
      okText="Tôi đã hiểu"
      onOk={onClose}
      onCancel={onClose}
      cancelButtonProps={{ style: { display: 'none' } }}
      width={600}
    >
      <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
        <Step num={1} title="Lấy Jira API Token">
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            <li>
              Truy cập:{' '}
              <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">
                Atlassian API Tokens
              </a>
              .
            </li>
            <li>
              Nhấn <Text code>Create API token</Text>.
            </li>
            <li>
              Nhập nhãn tùy ý (ví dụ: <Text code>JiraBot</Text>) rồi nhấn <Text code>Create</Text>.
            </li>
            <li>Sao chép mã (chỉ hiển thị 1 lần) và dán vào ô Jira API Token.</li>
          </ol>
        </Step>
        <Step num={2} title="Lấy Account ID">
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            <li>Mở trang Profile cá nhân của bạn trên Jira.</li>
            <li>
              URL có dạng: <Text code>.../people/712020:abc...?cloudId=...</Text>
            </li>
            <li>
              Sao chép chuỗi nằm sau <Text code>/people/</Text> và trước dấu <Text code>?</Text> → ô Account ID.
            </li>
          </ol>
        </Step>
        <Step num={3} title="Lấy Cloud ID">
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            <li>
              Cũng trong URL trang Profile, lấy chuỗi sau <Text code>cloudId=</Text> ở cuối URL → ô Cloud ID.
            </li>
            <li>
              Cách dự phòng: truy cập{' '}
              <Text code>https://&lt;công_ty&gt;.atlassian.net/_edge/tenant_info</Text> để lấy <Text code>id</Text>.
            </li>
          </ol>
        </Step>
        <Step num={4} title="Jira Base URL">
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>Đường dẫn truy cập Jira của bạn.</li>
            <li>
              Định dạng: <Text code>https://&lt;công_ty&gt;.atlassian.net</Text> (không thêm dấu / ở cuối).
            </li>
          </ul>
        </Step>
      </Space>
    </Modal>
  );
}
