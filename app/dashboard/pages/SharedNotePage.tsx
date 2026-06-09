import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Card, 
  Typography, 
  Spin, 
  Space, 
  Divider, 
  Row, 
  Col, 
  Flex,
  Badge,
  message,
  Button,
  Tooltip
} from 'antd';
import { 
  ClockCircleOutlined, 
  PictureOutlined, 
  EditOutlined, 
  ExclamationCircleOutlined,
  FileTextOutlined,
  CopyOutlined,
  CheckOutlined
} from '@ant-design/icons';
import { api } from '../../api';
import type { Note } from '../../types';

const { Title, Text, Paragraph } = Typography;

const CodeBlock: React.FC<{ content: string; language?: string }> = ({ content, language }) => {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      message.success('Đã sao chép mã nguồn!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', margin: '12px 0' }}
    >
      {hovered && (
        <Button
          size="small"
          type="default"
          style={{ 
            position: 'absolute', 
            top: 8, 
            right: 8, 
            zIndex: 10,
            backgroundColor: copied ? '#10b981' : '#ffffff',
            borderColor: copied ? '#10b981' : '#cbd5e1',
            color: copied ? '#ffffff' : '#475569',
            fontSize: 11
          }}
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopy}
        >
          {copied ? 'Đã chép' : 'Sao chép'}
        </Button>
      )}
      {language && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 12,
          fontSize: 10,
          color: '#64748b',
          textTransform: 'uppercase',
          fontWeight: 'bold',
          pointerEvents: 'none'
        }}>
          {language}
        </div>
      )}
      <pre style={{
        padding: '12px 16px',
        backgroundColor: '#f1f5f9',
        color: '#334155',
        borderRadius: 8,
        fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
        fontSize: 13,
        overflowX: 'auto',
        margin: 0,
        lineHeight: 1.5,
        border: '1px solid #cbd5e1',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all'
      }}>
        <code>{content}</code>
      </pre>
    </div>
  );
};

const InlineCode: React.FC<{ content: string }> = ({ content }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      message.success(`Đã sao chép "${content}"!`);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Tooltip title={copied ? 'Đã sao chép!' : 'Click để sao chép'}>
      <code 
        onClick={handleCopy}
        style={{ 
          fontFamily: 'SFMono-Medium, Consolas, Monaco, monospace',
          backgroundColor: '#f1f5f9',
          color: '#e11d48',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: '0.875em',
          border: '1px solid #cbd5e1',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'inline-block',
          verticalAlign: 'middle',
          margin: '0 2px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#e2e8f0';
          e.currentTarget.style.borderColor = '#94a3b8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f1f5f9';
          e.currentTarget.style.borderColor = '#cbd5e1';
        }}
      >
        {content}
      </code>
    </Tooltip>
  );
};

function parseContent(text: string): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(/```/g);
  const elements: React.ReactNode[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      // Explicit triple backtick code blocks
      const codeContent = parts[i];
      const match = codeContent.match(/^([a-zA-Z0-9+#-]+)?\n([\s\S]*)$/);
      if (match) {
        elements.push(
          <CodeBlock 
            key={`cb-triple-${i}`} 
            content={match[2].trimEnd()} 
            language={match[1] || 'code'} 
          />
        );
      } else {
        elements.push(
          <CodeBlock 
            key={`cb-triple-${i}`} 
            content={codeContent.trimEnd()} 
          />
        );
      }
    } else {
      // Normal text, check for single backticks
      const textPart = parts[i];
      const subParts = textPart.split(/`/g);
      
      for (let j = 0; j < subParts.length; j++) {
        if (j % 2 === 1) {
          // Inside single backticks
          const content = subParts[j];
          if (content.includes('\n')) {
            // Contains newlines -> render as a full code block
            elements.push(
              <CodeBlock 
                key={`cb-single-${i}-${j}`} 
                content={content} 
              />
            );
          } else {
            // Inline code
            elements.push(
              <InlineCode 
                key={`code-inline-${i}-${j}`} 
                content={content} 
              />
            );
          }
        } else {
          // Plain text, check for **bold** text
          const normalText = subParts[j];
          if (normalText) {
            const boldParts = normalText.split(/(\*\*[^*]+\*\*)/g);
            const parsed = boldParts.map((bPart, bIdx) => {
              if (bPart.startsWith('**') && bPart.endsWith('**')) {
                return <strong key={`bold-${i}-${j}-${bIdx}`}>{bPart.slice(2, -2)}</strong>;
              }
              return bPart;
            });
            
            elements.push(
              <span key={`text-${i}-${j}`} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {parsed}
              </span>
            );
          }
        }
      }
    }
  }
  return elements;
}

function getRemainingSeconds(expiresAtStr: string): number {
  const diff = new Date(expiresAtStr).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}

function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return 'Đã hết hạn';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function SharedNotePage() {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowTime, setNowTime] = useState(Date.now());

  // Poll timer
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch public note contents
  useEffect(() => {
    async function loadSharedNote() {
      try {
        const data = await api.get<Note>(`/api/public/notes/${id}`);
        setNote(data);
      } catch (e: any) {
        setError(e.message || 'Ghi chú không tồn tại hoặc đã hết hạn');
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      loadSharedNote();
    }
  }, [id]);

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
          <Text type="secondary">Đang tải ghi chú chia sẻ...</Text>
        </Flex>
      </div>
    );
  }

  if (error || !note) {
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
          <Title level={3} style={{ margin: '0 0 8px 0' }}>Ghi chú không khả dụng</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            Liên kết này không tồn tại hoặc ghi chú đã tự động xóa sau thời hạn 24 giờ.
          </Text>
          <div style={{ fontSize: 12, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
            Cung cấp bởi JiraBot QuickShare
          </div>
        </Card>
      </div>
    );
  }

  const secLeft = getRemainingSeconds(note.expires_at);
  const isExpired = secLeft <= 0;

  if (isExpired) {
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
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
          }}
        >
          <ClockCircleOutlined style={{ fontSize: 54, color: '#f59e0b', marginBottom: 16 }} />
          <Title level={3} style={{ margin: '0 0 8px 0' }}>Ghi chú đã hết hạn</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            Ghi chú này đã hết hạn lưu trữ 24 giờ và đã tự động hủy bỏ.
          </Text>
          <div style={{ fontSize: 12, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
            Cung cấp bởi JiraBot QuickShare
          </div>
        </Card>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, (secLeft / (24 * 3600)) * 100));
  let badgeColor = '#10b981';
  if (pct < 15) badgeColor = '#ef4444';
  else if (pct < 40) badgeColor = '#f59e0b';

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
          maxWidth: 800, 
          width: '100%', 
          borderRadius: 16,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.7)'
        }}
      >
        <Flex vertical gap={24}>
          {/* Header */}
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
                JB
              </div>
              <Text strong style={{ fontSize: 15, letterSpacing: '0.5px' }}>JIRABOT QUICKSHARE</Text>
            </Flex>
            
            <Badge 
              count={
                <Flex align="center" gap={6} style={{ 
                  backgroundColor: badgeColor + '15', 
                  color: badgeColor, 
                  padding: '4px 10px', 
                  borderRadius: 20,
                  border: `1px solid ${badgeColor}30`,
                  fontSize: 12,
                  fontWeight: 600
                }}>
                  <ClockCircleOutlined />
                  <span>Hủy sau: {formatRemainingTime(secLeft)}</span>
                </Flex>
              } 
            />
          </Flex>

          {/* Title */}
          <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
            {note.title || '(Không có tiêu đề)'}
          </Title>

          {/* Text Content Header */}
          <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
            <Text type="secondary" strong style={{ fontSize: 12, letterSpacing: '0.5px' }}>
              <FileTextOutlined /> NỘI DUNG GHI CHÚ
            </Text>
            {note.content && (
              <Button 
                type="text" 
                size="small" 
                icon={<CopyOutlined />} 
                onClick={() => {
                  navigator.clipboard.writeText(note.content).then(() => {
                    message.success('Đã sao chép toàn bộ nội dung!');
                  });
                }}
                style={{ fontSize: 12, color: '#475569' }}
              >
                Sao chép tất cả
              </Button>
            )}
          </Flex>

          {/* Text Content Area */}
          <div 
            style={{ 
              fontSize: 15, 
              lineHeight: 1.7, 
              color: '#334155', 
              backgroundColor: '#f8fafc',
              padding: '16px 20px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              maxHeight: '380px',
              overflowY: 'auto',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
            }}
          >
            {note.content ? (
              parseContent(note.content)
            ) : (
              <Text type="secondary" italic>Ghi chú không có nội dung văn bản.</Text>
            )}
          </div>

          {/* Image & Drawing Grid */}
          {(note.image_url || note.drawing) && (
            <Row gutter={[20, 20]} style={{ marginTop: 8 }}>
              {note.image_url && (
                <Col xs={24} md={note.drawing ? 12 : 24}>
                  <Card
                    title={<span style={{ fontSize: 13, fontWeight: 600 }}><PictureOutlined /> Ảnh đính kèm</span>}
                    styles={{ body: { padding: 12, textAlign: 'center', backgroundColor: '#f8fafc' } }}
                    style={{ borderRadius: 12 }}
                  >
                    <img 
                      src={note.image_url} 
                      alt="Shared attachment" 
                      style={{ maxWidth: '100%', maxHeight: 350, borderRadius: 8, objectFit: 'contain' }} 
                    />
                  </Card>
                </Col>
              )}

              {note.drawing && (
                <Col xs={24} md={note.image_url ? 12 : 24}>
                  <Card
                    title={<span style={{ fontSize: 13, fontWeight: 600 }}><EditOutlined /> Hình vẽ phác thảo</span>}
                    styles={{ body: { padding: 12, textAlign: 'center', backgroundColor: '#f8fafc' } }}
                    style={{ borderRadius: 12 }}
                  >
                    <img 
                      src={note.drawing} 
                      alt="Shared sketch" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: 350, 
                        borderRadius: 8, 
                        objectFit: 'contain',
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0'
                      }} 
                    />
                  </Card>
                </Col>
              )}
            </Row>
          )}

          <Divider style={{ margin: '12px 0 0 0' }} />
          
          <Flex justify="center" align="center" style={{ paddingTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ghi chú trực tuyến an toàn. Nội dung sẽ tự động hủy bỏ vĩnh viễn và không thể khôi phục sau 24h.
            </Text>
          </Flex>
        </Flex>
      </Card>
    </div>
  );
}
