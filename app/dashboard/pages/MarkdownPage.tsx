import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Card, 
  List, 
  Button, 
  Input, 
  Space, 
  message, 
  Tooltip, 
  Badge, 
  Divider, 
  Typography, 
  Popconfirm,
  Row,
  Col,
  Flex,
  Segmented,
  Grid
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  ShareAltOutlined, 
  DownloadOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  EditOutlined,
  AppstoreOutlined,
  CloudUploadOutlined
} from '@ant-design/icons';
import { api, bust } from '../../api';
import type { MarkdownDoc } from '../../types';
import PageHeader from '../components/PageHeader';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// Helper to calculate seconds remaining
function getRemainingSeconds(expiresAtStr: string): number {
  const diff = new Date(expiresAtStr).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}

// Helper to format remaining time
function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return 'Đã hết hạn';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Markdown Renderer Component (loads Marked and Mermaid from CDN)
interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [html, setHtml] = useState<string>('');
  const [loadingLibs, setLoadingLibs] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load scripts dynamically
  useEffect(() => {
    let active = true;

    async function loadLibraries() {
      try {
        if (!window.marked) {
          await loadScript('https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js');
        }
        if (!window.mermaid) {
          await loadScript('https://cdn.jsdelivr.net/npm/mermaid@10.2.4/dist/mermaid.min.js');
          window.mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            suppressErrorAlerts: true
          });
        }
        if (active) {
          setLoadingLibs(false);
        }
      } catch (err) {
        console.error('Failed to load markdown/mermaid libraries', err);
      }
    }

    loadLibraries();
    return () => {
      active = false;
    };
  }, []);

  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  };

  // Render HTML from markdown
  useEffect(() => {
    if (loadingLibs || !window.marked) return;

    let active = true;
    const renderer = new window.marked.Renderer();

    // Customize marked code renderer to detect mermaid
    renderer.code = (code: string, lang: string) => {
      const language = (lang || '').trim();
      if (language === 'mermaid') {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        return `<div class="mermaid-block" id="${id}" data-code="${encodeURIComponent(code)}"><div style="padding: 12px; color: #64748b; font-style: italic; font-size: 13px; text-align: center; border: 1px dashed #cbd5e1; border-radius: 8px; margin: 8px 0; background: #f8fafc;">Đang tải biểu đồ Mermaid...</div></div>`;
      }
      
      const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <div class="code-block-wrapper" style="position: relative; margin: 12px 0;">
          <div style="position: absolute; right: 8px; top: 8px; z-index: 5;">
            <button class="copy-code-btn" data-code="${encodeURIComponent(code)}" style="cursor: pointer; padding: 4px 8px; font-size: 11px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; color: #475569; display: flex; align-items: center; gap: 4px; outline: none; border-style: solid;">
              Sao chép
            </button>
          </div>
          ${language ? `<div style="position: absolute; right: 12px; bottom: 8px; font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; pointer-events: none;">${language}</div>` : ''}
          <pre style="padding: 12px 16px; background-color: #f1f5f9; color: #334155; border-radius: 8px; font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; overflow-x: auto; margin: 0; line-height: 1.5; border: 1px solid #cbd5e1; white-space: pre-wrap; word-break: break-all;"><code>${escapedCode}</code></pre>
        </div>
      `;
    };

    renderer.table = (header: string, body: string) => {
      return `
        <div class="table-wrapper">
          <table>
            <thead>${header}</thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      `;
    };

    try {
      const parsedHtml = window.marked.parse(content || '', { renderer });
      if (active) {
        setHtml(parsedHtml);
      }
    } catch (err) {
      console.error('Markdown parse error:', err);
    }

    return () => {
      active = false;
    };
  }, [content, loadingLibs]);

  // Render Mermaid diagrams
  useEffect(() => {
    if (loadingLibs || !window.mermaid || !html) return;

    let active = true;
    const blocks = containerRef.current?.querySelectorAll('.mermaid-block');
    if (!blocks || blocks.length === 0) return;

    async function renderMermaidBlocks() {
      for (const el of Array.from(blocks)) {
        if (!active) return;
        const code = decodeURIComponent(el.getAttribute('data-code') || '');
        const id = el.getAttribute('id');
        if (!code || !id) continue;

        try {
          // Render SVG asynchronously
          const { svg } = await window.mermaid.render(`${id}-svg`, code);
          if (active) {
            el.innerHTML = svg;
          }
        } catch (err: any) {
          console.error('Mermaid render error:', err);
          if (active) {
            el.innerHTML = `<pre style="color: #ef4444; border: 1px solid #fee2e2; background-color: #fef2f2; padding: 8px; border-radius: 6px; font-size: 12px; margin: 8px 0; overflow-x: auto;">Lỗi vẽ Mermaid: ${err.message || err}</pre>`;
          }
        }
      }
    }

    const timer = setTimeout(() => {
      renderMermaidBlocks();
    }, 50);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [html, loadingLibs]);

  // Handle Copy Button Click Inside HTML
  useEffect(() => {
    if (!html) return;
    const container = containerRef.current;
    if (!container) return;

    const handleCopyClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.copy-code-btn') as HTMLButtonElement | null;
      if (!btn) return;

      const code = decodeURIComponent(btn.getAttribute('data-code') || '');
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Đã chép';
        btn.style.backgroundColor = '#10b981';
        btn.style.borderColor = '#10b981';
        btn.style.color = '#ffffff';
        setTimeout(() => {
          btn.textContent = 'Sao chép';
          btn.style.backgroundColor = '#ffffff';
          btn.style.borderColor = '#cbd5e1';
          btn.style.color = '#475569';
        }, 2000);
      });
    };

    container.addEventListener('click', handleCopyClick);
    return () => {
      container.removeEventListener('click', handleCopyClick);
    };
  }, [html]);

  if (loadingLibs) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
        <Space direction="vertical" align="center">
          <SyncOutlined spin style={{ fontSize: 24, color: '#3b82f6' }} />
          <Text type="secondary" style={{ fontSize: 13 }}>Đang tải thư viện xử lý markdown...</Text>
        </Space>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
          font-weight: 600;
          line-height: 1.25;
          margin-top: 20px;
          margin-bottom: 12px;
          color: #0f172a;
        }
        .markdown-body h1 { font-size: 1.8em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; }
        .markdown-body h2 { font-size: 1.4em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; }
        .markdown-body h3 { font-size: 1.2em; }
        .markdown-body p { margin-top: 0; margin-bottom: 12px; line-height: 1.6; }
        .markdown-body ul, .markdown-body ol { padding-left: 20px; margin-top: 0; margin-bottom: 12px; }
        .markdown-body li { margin-top: 4px; }
        .markdown-body code {
          font-family: SFMono-Regular, Consolas, monospace;
          background-color: #f1f5f9;
          padding: 2px 4px;
          border-radius: 4px;
          font-size: 85%;
          color: #e11d48;
        }
        .markdown-body pre code {
          color: inherit;
          background-color: transparent;
          padding: 0;
          font-size: 100%;
        }
        .markdown-body blockquote {
          padding: 0 16px;
          color: #64748b;
          border-left: 4px solid #cbd5e1;
          margin: 0 0 16px 0;
          font-style: italic;
        }
        .markdown-body .table-wrapper {
          overflow-x: auto;
          max-width: 100%;
          margin-bottom: 16px;
          -webkit-overflow-scrolling: touch;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        .markdown-body table {
          border-spacing: 0;
          border-collapse: collapse;
          margin-top: 0;
          margin-bottom: 0;
          width: 100%;
        }
        .markdown-body table th, .markdown-body table td {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          font-size: 13px;
        }
        .markdown-body table th {
          background-color: #f8fafc;
          font-weight: 600;
        }
        .markdown-body table tr {
          background-color: #ffffff;
        }
        .markdown-body table tr:nth-child(2n) {
          background-color: #f8fafc;
        }
        .markdown-body a {
          color: #2563eb;
          text-decoration: none;
        }
        .markdown-body a:hover {
          text-decoration: underline;
        }
        .markdown-body img {
          max-width: 100%;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          padding: 2px;
        }
      `}</style>
      <div 
        ref={containerRef} 
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
};

export default function MarkdownPage() {
  const [docs, setDocs] = useState<MarkdownDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<MarkdownDoc | null>(null);
  
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;

  // Workspace states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  // Layout toggle: 'edit' | 'preview' | 'split'
  const [layoutMode, setLayoutMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Enforce layout mode is not 'split' on mobile
  useEffect(() => {
    if (isMobile && layoutMode === 'split') {
      setLayoutMode('edit');
    }
  }, [isMobile, layoutMode]);
  const [loading, setLoading] = useState(true);
  const [nowTime, setNowTime] = useState(Date.now());
  const [isDragOver, setIsDragOver] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for remaining time ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch documents
  const fetchDocs = useCallback(async (selectIdAfterLoad?: string) => {
    try {
      const res = await api.get<{ markdowns: MarkdownDoc[] }>(`/api/markdowns?${bust()}`);
      setDocs(res.markdowns);
      
      if (selectIdAfterLoad) {
        const found = res.markdowns.find(d => d.id === selectIdAfterLoad);
        if (found) {
          setSelectedDoc(found);
          setTitle(found.title);
          setContent(found.content);
        }
      } else if (res.markdowns.length > 0 && !selectedDoc) {
        const doc = res.markdowns[0];
        setSelectedDoc(doc);
        setTitle(doc.title);
        setContent(doc.content);
      } else if (res.markdowns.length === 0) {
        setSelectedDoc(null);
      }
    } catch (e: any) {
      message.error('Không thể tải danh sách tài liệu: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDoc]);

  useEffect(() => {
    fetchDocs();
  }, []);

  // Debounced auto-save handler
  const triggerAutoSave = useCallback((newTitle: string, newContent: string) => {
    if (!selectedDoc) return;

    setSaveStatus('saving');
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.post<{ success: boolean; markdown: MarkdownDoc; isNew: boolean }>('/api/markdowns', {
          id: selectedDoc.id || undefined,
          title: newTitle,
          content: newContent
        });

        if (res.success) {
          setSaveStatus('saved');
          if (!selectedDoc.id) {
            setSelectedDoc(res.markdown);
          } else {
            setSelectedDoc(prev => prev ? { ...prev, expires_at: res.markdown.expires_at } : null);
          }
          const resList = await api.get<{ markdowns: MarkdownDoc[] }>(`/api/markdowns?${bust()}`);
          setDocs(resList.markdowns);
        }
      } catch (e) {
        setSaveStatus('error');
        message.error('Lỗi tự động lưu tài liệu');
      }
    }, 1000);
  }, [selectedDoc]);

  // Clean timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Selection change
  const selectDoc = (doc: MarkdownDoc) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setSaveStatus('saved');
    setSelectedDoc(doc);
    setTitle(doc.title);
    setContent(doc.content);
  };

  // Create new blank document
  const createNewDoc = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    const blankDoc: MarkdownDoc = {
      id: '',
      user_id: 0,
      title: '',
      content: '',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    setSelectedDoc(blankDoc);
    setTitle('');
    setContent('');
    setSaveStatus('saved');
  };

  // Delete document
  const handleDeleteDoc = async (id: string) => {
    try {
      if (id) {
        await api.del(`/api/markdowns/${id}`);
        message.success('Đã xóa tài liệu');
      }
      
      if (selectedDoc && selectedDoc.id === id) {
        setSelectedDoc(null);
        setTitle('');
        setContent('');
      }
      
      fetchDocs();
    } catch (e: any) {
      message.error('Không thể xóa tài liệu: ' + e.message);
    }
  };

  // File Download handler
  const handleDownload = () => {
    if (!content) {
      message.warning('Không có nội dung để tải về');
      return;
    }
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Đã tải xuống file .md');
  };

  // Share handler
  const handleShare = () => {
    if (!selectedDoc || !selectedDoc.id) {
      message.warning('Vui lòng đợi tài liệu được lưu trước khi chia sẻ');
      return;
    }
    const shareUrl = `${window.location.origin}/share-md/${selectedDoc.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      message.success('Đã sao chép liên kết chia sẻ!');
    }).catch(() => {
      message.error('Không thể sao chép liên kết');
    });
  };

  // Drag and drop events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!selectedDoc) {
      message.warning('Vui lòng tạo hoặc chọn một tài liệu trước khi thả file');
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown') && !file.type.startsWith('text/')) {
      message.error('Chỉ hỗ trợ kéo thả file Markdown (.md)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fileText = reader.result as string;
      const fileTitle = file.name.replace(/\.md$/i, '').replace(/\.markdown$/i, '');
      setTitle(fileTitle);
      setContent(fileText);
      triggerAutoSave(fileTitle, fileText);
      message.success(`Đã nạp file: ${file.name}`);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <PageHeader 
        title="Công cụ Markdown" 
        subtitle="Đọc, viết Markdown, kết xuất biểu đồ Mermaid, tự động hủy trong 24h & chia sẻ trực tuyến"
        showRefresh={false}
      />
      
      <Row gutter={[24, 24]} style={{ height: isMobile ? 'auto' : 'calc(100vh - 180px)', marginBottom: 16 }}>
        {/* Left Side: Document List */}
        <Col xs={24} lg={6} style={{ height: isMobile ? 'auto' : '100%' }}>
          <Card 
            title={
              <Flex justify="space-between" align="center">
                <span style={{ fontSize: 14, fontWeight: 600 }}>Tài liệu của tôi</span>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  size="small" 
                  onClick={createNewDoc}
                >
                  Tạo mới
                </Button>
              </Flex>
            }
            styles={{ body: { padding: '8px 0', overflowY: 'auto', flexGrow: 1 } }}
            style={{ 
              height: isMobile ? '280px' : '100%', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Đang tải...</div>
            ) : docs.length === 0 && (!selectedDoc || selectedDoc.id) ? (
              <Flex vertical align="center" style={{ padding: 40, textAlign: 'center' }}>
                <FileTextOutlined style={{ fontSize: 36, color: '#cbd5e1', marginBottom: 12 }} />
                <Text type="secondary" style={{ fontSize: 13 }}>Chưa có tài liệu nào hoạt động</Text>
                <Button 
                  type="dashed" 
                  icon={<PlusOutlined />} 
                  onClick={createNewDoc}
                  style={{ marginTop: 16 }}
                >
                  Tạo tài liệu đầu tiên
                </Button>
              </Flex>
            ) : (
              <List
                dataSource={docs}
                renderItem={(item) => {
                  const isActive = selectedDoc?.id === item.id;
                  const secLeft = getRemainingSeconds(item.expires_at);
                  const pct = Math.min(100, Math.max(0, (secLeft / (24 * 3600)) * 100));
                  
                  let progressColor = '#10b981';
                  if (pct < 15) progressColor = '#ef4444';
                  else if (pct < 40) progressColor = '#f59e0b';

                  return (
                    <div
                      onClick={() => selectDoc(item)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        backgroundColor: isActive ? '#f1f5f9' : 'transparent',
                        borderLeft: isActive ? '4px solid #3b82f6' : '4px solid transparent',
                        transition: 'all 0.2s',
                        borderBottom: '1px solid #f1f5f9'
                      }}
                    >
                      <Flex vertical gap={4}>
                        <Flex justify="space-between" align="center">
                          <Text strong style={{ 
                            fontSize: 13, 
                            maxWidth: '75%', 
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis' 
                          }}>
                            {item.title || '(Chưa có tiêu đề)'}
                          </Text>
                          <Popconfirm
                            title="Xóa tài liệu này?"
                            onConfirm={(e) => {
                              e?.stopPropagation();
                              handleDeleteDoc(item.id);
                            }}
                            onCancel={(e) => e?.stopPropagation()}
                            okText="Xóa"
                            cancelText="Hủy"
                          >
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Popconfirm>
                        </Flex>
                        
                        <Paragraph 
                          type="secondary" 
                          ellipsis={{ rows: 1 }}
                          style={{ margin: 0, fontSize: 11 }}
                        >
                          {item.content || 'Không có nội dung'}
                        </Paragraph>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <Badge color={progressColor} />
                          <span style={{ fontSize: 10, color: progressColor, fontWeight: 500 }}>
                            {formatRemainingTime(secLeft)}
                          </span>
                        </div>
                      </Flex>
                    </div>
                  );
                }}
              />
            )}
          </Card>
        </Col>

        {/* Right Side: Split Editor / Preview Workspace */}
        <Col xs={24} lg={18} style={{ height: isMobile ? 'auto' : '100%' }}>
          {!selectedDoc ? (
            <Card style={{ height: isMobile ? '350px' : '100%', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flex vertical align="center" style={{ padding: 48, textAlign: 'center' }}>
                <FileTextOutlined style={{ fontSize: 54, color: '#e2e8f0', marginBottom: 16 }} />
                <Text strong style={{ fontSize: 16 }}>Không có tài liệu nào đang mở</Text>
                <Text type="secondary" style={{ marginTop: 8, display: 'block', maxWidth: 320 }}>
                  Hãy chọn một tài liệu từ danh sách bên trái hoặc tạo mới để bắt đầu.
                </Text>
              </Flex>
            </Card>
          ) : (
            <Card 
              styles={{ body: { padding: isMobile ? '12px 12px' : '16px 20px', display: 'flex', flexDirection: 'column', height: '100%' } }}
              style={{ 
                borderRadius: 12, 
                height: isMobile ? '550px' : '100%', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                border: '1px solid #e2e8f0',
                position: 'relative'
              }}
            >
              {/* Workspace Header */}
              <Flex justify="space-between" align="center" wrap gap={12} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 16 }}>
                {/* Auto-save Status */}
                <Space>
                  {saveStatus === 'saving' && (
                    <Text type="secondary" style={{ fontSize: 12 }}><SyncOutlined spin /> Đang tự động lưu...</Text>
                  )}
                  {saveStatus === 'saved' && (
                    <Text type="success" style={{ fontSize: 12 }}><CheckCircleOutlined /> Đã lưu tự động</Text>
                  )}
                  {saveStatus === 'error' && (
                    <Text type="danger" style={{ fontSize: 12 }}><ExclamationCircleOutlined /> Lỗi lưu dữ liệu</Text>
                  )}
                </Space>

                {/* Mode Controller & Actions */}
                <Flex align="center" gap={12} wrap>
                  <Segmented
                    value={layoutMode}
                    onChange={(val) => setLayoutMode(val as any)}
                    options={[
                      { label: <span><EditOutlined /> Sửa</span>, value: 'edit' },
                      { label: <span><EyeOutlined /> Xem trước</span>, value: 'preview' },
                      ...(!isMobile ? [{ label: <span><AppstoreOutlined /> Song song</span>, value: 'split' }] : [])
                    ]}
                    size="small"
                  />
                  
                  <Tooltip title="Tải file .md gốc về máy">
                    <Button 
                      icon={<DownloadOutlined />} 
                      onClick={handleDownload}
                      size="small"
                    >
                      Tải về
                    </Button>
                  </Tooltip>
                  
                  <Button 
                    type="primary" 
                    icon={<ShareAltOutlined />} 
                    onClick={handleShare}
                    size="small"
                    disabled={!selectedDoc.id}
                  >
                    Chia sẻ
                  </Button>
                </Flex>
              </Flex>

              {/* Title input */}
              <Input
                placeholder="Tiêu đề tài liệu..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  triggerAutoSave(e.target.value, content);
                }}
                style={{
                  border: 'none',
                  boxShadow: 'none',
                  fontSize: 20,
                  fontWeight: 700,
                  padding: '4px 0',
                  color: '#0f172a',
                  marginBottom: 12
                }}
              />

              {/* Split screen content area */}
              <div 
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  position: 'relative',
                  flexGrow: 1,
                  display: 'flex',
                  minHeight: 0,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  overflow: 'hidden'
                }}
              >
                {/* Drag and Drop Glassmorphism Overlay */}
                {isDragOver && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '3px dashed #3b82f6',
                    borderRadius: 8,
                    color: '#2563eb',
                    pointerEvents: 'none',
                    transition: 'all 0.2s ease'
                  }}>
                    <CloudUploadOutlined style={{ fontSize: 48, marginBottom: 12 }} />
                    <Text strong style={{ fontSize: 16, color: '#1d4ed8' }}>Thả file .md tại đây</Text>
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>Nhập tiêu đề và nội dung tự động</Text>
                  </div>
                )}

                {/* Editor Pane */}
                {(layoutMode === 'edit' || layoutMode === 'split') && (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRight: layoutMode === 'split' ? '1px solid #e2e8f0' : 'none',
                    height: '100%',
                    backgroundColor: '#ffffff'
                  }}>
                    <TextArea
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        triggerAutoSave(title, e.target.value);
                      }}
                      placeholder="Nhập nội dung markdown ở đây... Bạn cũng có thể kéo thả một file .md vào khung này."
                      style={{
                        flexGrow: 1,
                        border: 'none',
                        boxShadow: 'none',
                        resize: 'none',
                        fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
                        fontSize: 13,
                        padding: 16,
                        height: '100%',
                        color: '#334155',
                        lineHeight: 1.6
                      }}
                    />
                  </div>
                )}

                {/* Preview Pane */}
                {(layoutMode === 'preview' || layoutMode === 'split') && (
                  <div style={{
                    flex: 1,
                    padding: 16,
                    overflowY: 'auto',
                    backgroundColor: '#f8fafc',
                    height: '100%',
                    wordBreak: 'break-word'
                  }}>
                    {content ? (
                      <MarkdownRenderer content={content} />
                    ) : (
                      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>
                        Nội dung xem trước sẽ hiển thị ở đây
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClockCircleOutlined style={{ fontSize: 12, color: '#64748b' }} />
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Tài liệu này sẽ tự động hủy sau 24 giờ kể từ lần cập nhật cuối. Có thể chia sẻ ẩn danh.
                </span>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </>
  );
}
