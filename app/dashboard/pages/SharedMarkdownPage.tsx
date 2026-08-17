import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Card, 
  Typography, 
  Spin, 
  Space, 
  Divider, 
  Flex,
  Badge,
  message,
  Button,
  Grid
} from 'antd';
import { 
  ExclamationCircleOutlined,
  FileTextOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { api } from '../../api';
import type { MarkdownDoc } from '../../types';
import { MarkdownRenderer } from './MarkdownPage';

const { Title, Text } = Typography;

type SharedMarkdownDoc = Pick<MarkdownDoc, 'id' | 'title' | 'content' | 'created_at'>;

export default function SharedMarkdownPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<SharedMarkdownDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [error, setError] = useState<string | null>(null);
  // Fetch the public document details
  useEffect(() => {
    async function loadSharedDoc() {
      try {
        const data = await api.get<SharedMarkdownDoc>(`/api/public/markdowns/${id}`);
        setDoc(data);
      } catch (e: any) {
        setError(e.message || 'Tài liệu không tồn tại');
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      loadSharedDoc();
    }
  }, [id]);

  // Handle Download of original source file
  const handleDownload = () => {
    if (!doc || !doc.content) {
      message.warning('Không có nội dung để tải về');
      return;
    }
    const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Đã tải xuống file markdown gốc');
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        height: '100vh', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      }}>
        <Flex vertical align="center" gap={12}>
          <Spin size="large" />
          <Text type="secondary">Đang tải tài liệu chia sẻ...</Text>
        </Flex>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div style={{ 
        display: 'flex', 
        height: '100vh', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      }}>
        <Card 
          style={{ 
            maxWidth: 480, 
            width: '100%', 
            textAlign: 'center', 
            borderRadius: 16,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          }}
        >
          <ExclamationCircleOutlined style={{ fontSize: 54, color: '#ef4444', marginBottom: 16 }} />
          <Title level={3} style={{ margin: '0 0 8px 0' }}>Tài liệu không khả dụng</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            Liên kết này không tồn tại hoặc tài liệu đã bị gỡ bỏ.
          </Text>
          <div style={{ fontSize: 12, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
            Cung cấp bởi JiraBot QuickShare
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '40px 16px',
      background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <Card 
        style={{ 
          maxWidth: 900, 
          width: '100%', 
          borderRadius: 16,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.7)'
        }}
      >
        <Flex vertical gap={24}>
          {/* Header Bar */}
          <Flex justify="space-between" align="center" wrap gap={12} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16 }}>
            <Flex align="center" gap={8}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 16,
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              }}>
                MD
              </div>
              <Text strong style={{ fontSize: 14, letterSpacing: '0.5px' }}>JIRABOT MARKDOWN SHARE</Text>
            </Flex>
            
            <Badge 
              count={
                <Flex align="center" gap={6} style={{ 
                  backgroundColor: '#10b98115',
                  color: '#10b981',
                  padding: '4px 10px', 
                  borderRadius: 20,
                  border: '1px solid #10b98130',
                  fontSize: 12,
                  fontWeight: 600
                }}>
                  <FileTextOutlined />
                  <span>Liên kết không hết hạn</span>
                </Flex>
              } 
            />
          </Flex>

          {/* Title and Download Actions */}
          <Flex justify="space-between" align="top" wrap gap={12}>
            <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#0f172a', maxWidth: '75%' }}>
              {doc.title || '(Không có tiêu đề)'}
            </Title>
            
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              onClick={handleDownload}
              style={{ borderRadius: 8 }}
            >
              Tải file gốc (.md)
            </Button>
          </Flex>

          <Divider style={{ margin: '4px 0 12px 0' }} />

          {/* Document Content View */}
          <div 
            style={{ 
              backgroundColor: '#ffffff',
              padding: isMobile ? '16px 16px' : '24px 32px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              minHeight: '300px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            {doc.content ? (
              <MarkdownRenderer content={doc.content} />
            ) : (
              <Text type="secondary" italic>Tài liệu này không có nội dung.</Text>
            )}
          </div>

          <Divider style={{ margin: '12px 0 0 0' }} />
          
          <Flex justify="center" align="center" style={{ paddingTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
              Tài liệu trực tuyến an toàn. Nội dung sẽ tự động hủy bỏ vĩnh viễn và không thể khôi phục sau 24h.
            </Text>
          </Flex>
        </Flex>
      </Card>
    </div>
  );
}
