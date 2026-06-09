import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Card, 
  List, 
  Button, 
  Input, 
  Space, 
  Progress, 
  Modal, 
  message, 
  Tooltip, 
  Badge, 
  Divider, 
  Typography, 
  Popconfirm,
  Row,
  Col,
  Flex
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  ShareAltOutlined, 
  PlusOutlined, 
  PictureOutlined, 
  FileImageOutlined, 
  ClearOutlined,
  SaveOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { api, bust } from '../../api';
import type { Note } from '../../types';
import PageHeader from '../components/PageHeader';

const { Title, Text, Paragraph } = Typography;
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

interface DrawingModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  initialDataUrl: string | null;
}

// Canvas Drawing Modal Component
const DrawingModal: React.FC<DrawingModalProps> = ({ open, onClose, onSave, initialDataUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#1e293b'); // Navy slate
  const [brushSize, setBrushSize] = useState(5);
  const [isErasing, setIsErasing] = useState(false);
  const drawingRef = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const colors = [
    '#1e293b', // Navy slate
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Yellow
    '#8b5cf6', // Purple
    '#ec4899', // Pink
  ];

  useEffect(() => {
    if (open) {
      // Small timeout to ensure canvas is in the DOM before we access it
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.parentElement?.clientWidth || 700;
        canvas.height = 450;

        // Background fill
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (initialDataUrl) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = initialDataUrl;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, initialDataUrl]);

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      if (e.touches.length === 0) return lastPos.current;
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawingRef.current = true;
    const pos = getCoordinates(e, canvas);
    lastPos.current = pos;

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getCoordinates(e, canvas);

    ctx.strokeStyle = isErasing ? '#ffffff' : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPos.current = pos;
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL());
    onClose();
  };

  return (
    <Modal
      title="Bản vẽ phác thảo"
      open={open}
      onCancel={onClose}
      width={750}
      footer={[
        <Button key="cancel" onClick={onClose}>Hủy</Button>,
        <Button key="clear" danger icon={<ClearOutlined />} onClick={clearCanvas}>Xóa hết</Button>,
        <Button key="save" type="primary" icon={<SaveOutlined />} onClick={handleSave}>Lưu bản vẽ</Button>,
      ]}
      destroyOnClose
    >
      <Flex vertical gap={12}>
        <Flex justify="space-between" align="center" wrap gap={12} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
          {/* Colors */}
          <Space>
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setIsErasing(false);
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: c,
                  border: color === c && !isErasing ? '2px solid #000' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transform: color === c && !isErasing ? 'scale(1.1)' : 'none',
                  transition: 'all 0.1s ease',
                }}
              />
            ))}
            <Divider type="vertical" />
            <Button 
              type={isErasing ? 'primary' : 'default'} 
              danger={isErasing}
              onClick={() => setIsErasing(!isErasing)}
            >
              Cục tẩy
            </Button>
          </Space>

          {/* Brush Sizes */}
          <Space>
            <Text style={{ fontSize: 13 }}>Kích thước nét:</Text>
            {[2, 5, 10, 15].map((size) => (
              <Button
                key={size}
                type={brushSize === size ? 'primary' : 'default'}
                size="small"
                onClick={() => setBrushSize(size)}
              >
                {size}px
              </Button>
            ))}
          </Space>
        </Flex>

        <div style={{ 
          border: '1px solid #cbd5e1', 
          borderRadius: 8, 
          overflow: 'hidden', 
          backgroundColor: '#fff',
          touchAction: 'none' // Prevent scrolling when drawing on touch screens
        }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ display: 'block', cursor: isErasing ? 'cell' : 'crosshair' }}
          />
        </div>
      </Flex>
    </Modal>
  );
};

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [drawing, setDrawing] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [loading, setLoading] = useState(true);
  const [drawingModalOpen, setDrawingModalOpen] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for countdown timers every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch notes on mount
  const fetchNotes = useCallback(async (selectIdAfterLoad?: string) => {
    try {
      const res = await api.get<{ notes: Note[] }>(`/api/notes?${bust()}`);
      setNotes(res.notes);
      
      if (selectIdAfterLoad) {
        const found = res.notes.find(n => n.id === selectIdAfterLoad);
        if (found) {
          setSelectedNote(found);
          setTitle(found.title);
          setContent(found.content);
          setDrawing(found.drawing);
          setImageUrl(found.image_url);
        }
      } else if (res.notes.length > 0 && !selectedNote) {
        // select first note by default
        const note = res.notes[0];
        setSelectedNote(note);
        setTitle(note.title);
        setContent(note.content);
        setDrawing(note.drawing);
        setImageUrl(note.image_url);
      } else if (res.notes.length === 0) {
        setSelectedNote(null);
      }
    } catch (e: any) {
      message.error('Không thể lấy danh sách ghi chú: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedNote]);

  useEffect(() => {
    fetchNotes();
  }, []);

  // Trigger auto-save when contents change
  const triggerAutoSave = useCallback((
    newTitle: string,
    newContent: string,
    newDrawing: string | null,
    newImageUrl: string | null
  ) => {
    if (!selectedNote) return;

    setSaveStatus('saving');
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.post<{ success: boolean; note: Note; isNew: boolean }>('/api/notes', {
          id: selectedNote.id || undefined,
          title: newTitle,
          content: newContent,
          drawing: newDrawing,
          image_url: newImageUrl
        });

        if (res.success) {
          setSaveStatus('saved');
          // If it was a new note without a real ID, we update the selected note with the backend generated ID
          if (!selectedNote.id) {
            setSelectedNote(res.note);
          } else {
            // Update the expiration time / details in selectedNote
            setSelectedNote(prev => prev ? { ...prev, expires_at: res.note.expires_at } : null);
          }
          // Refresh list to show updated title, countdowns, and potential new items
          const resList = await api.get<{ notes: Note[] }>(`/api/notes?${bust()}`);
          setNotes(resList.notes);
        }
      } catch (e) {
        setSaveStatus('error');
        message.error('Lỗi tự động lưu ghi chú');
      }
    }, 1000); // Debounce save for 1 second
  }, [selectedNote]);

  // Clean timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Handle manual selection
  const selectNote = (note: Note) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setSaveStatus('saved');
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setDrawing(note.drawing);
    setImageUrl(note.image_url);
  };

  // Create new blank note
  const createNewNote = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    const blankNote: Note = {
      id: '', // Empty means new note
      user_id: 0,
      title: '',
      content: '',
      drawing: null,
      image_url: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    setSelectedNote(blankNote);
    setTitle('');
    setContent('');
    setDrawing(null);
    setImageUrl(null);
    setSaveStatus('saved');
  };

  // Delete note
  const handleDeleteNote = async (id: string) => {
    try {
      if (id) {
        await api.del(`/api/notes/${id}`);
        message.success('Đã xóa ghi chú');
      }
      
      // Clear selection if deleted the active one
      if (selectedNote && selectedNote.id === id) {
        setSelectedNote(null);
        setTitle('');
        setContent('');
        setDrawing(null);
        setImageUrl(null);
      }
      
      fetchNotes();
    } catch (e: any) {
      message.error('Không thể xóa ghi chú: ' + e.message);
    }
  };

  // Image Upload handler
  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      message.error('Kích thước ảnh không vượt quá 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImageUrl(base64);
      triggerAutoSave(title, content, drawing, base64);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    triggerAutoSave(title, content, drawing, null);
  };

  const handleDrawingSave = (dataUrl: string) => {
    setDrawing(dataUrl);
    triggerAutoSave(title, content, dataUrl, imageUrl);
  };

  const removeDrawing = () => {
    setDrawing(null);
    triggerAutoSave(title, content, null, imageUrl);
  };

  // Share note link
  const handleShare = () => {
    if (!selectedNote || !selectedNote.id) {
      message.warning('Vui lòng đợi ghi chú được lưu trước khi chia sẻ');
      return;
    }
    const shareUrl = `${window.location.origin}/share/${selectedNote.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      message.success('Đã sao chép liên kết chia sẻ vào bộ nhớ tạm!');
    }).catch(() => {
      message.error('Không thể sao chép liên kết');
    });
  };

  return (
    <>
      <PageHeader 
        title="Ghi chú nhanh" 
        subtitle="Ghi chú trực tuyến, tự động hủy trong vòng 24h & chia sẻ nhanh"
        showRefresh={false}
      />
      
      <Row gutter={24} style={{ minHeight: 'calc(100vh - 160px)' }}>
        {/* Left Side: Notes list */}
        <Col xs={24} lg={8} style={{ marginBottom: 16 }}>
          <Card 
            title={
              <Flex justify="space-between" align="center">
                <span>Ghi chú của tôi</span>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  size="small" 
                  onClick={createNewNote}
                >
                  Tạo mới
                </Button>
              </Flex>
            }
            styles={{ body: { padding: '8px 0' } }}
            style={{ 
              height: '100%', 
              maxHeight: 650, 
              overflowY: 'auto', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              borderRadius: 12
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>Đang tải...</div>
            ) : notes.length === 0 && (!selectedNote || selectedNote.id) ? (
              <Flex vertical align="center" style={{ padding: 40, textAlign: 'center' }}>
                <FileTextOutlined style={{ fontSize: 40, color: '#94a3b8', marginBottom: 12 }} />
                <Text type="secondary">Chưa có ghi chú nào hoạt động</Text>
                <Button 
                  type="dashed" 
                  icon={<PlusOutlined />} 
                  onClick={createNewNote}
                  style={{ marginTop: 16 }}
                >
                  Tạo ghi chú đầu tiên
                </Button>
              </Flex>
            ) : (
              <List
                dataSource={notes}
                renderItem={(item) => {
                  const isActive = selectedNote?.id === item.id;
                  const secLeft = getRemainingSeconds(item.expires_at);
                  const pct = Math.min(100, Math.max(0, (secLeft / (24 * 3600)) * 100));
                  
                  let progressColor = '#10b981'; // green
                  if (pct < 15) progressColor = '#ef4444'; // red
                  else if (pct < 40) progressColor = '#f59e0b'; // amber

                  return (
                    <div
                      onClick={() => selectNote(item)}
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
                            fontSize: 14, 
                            maxWidth: '75%', 
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis' 
                          }}>
                            {item.title || '(Chưa có tiêu đề)'}
                          </Text>
                          <Popconfirm
                            title="Xóa ghi chú này?"
                            onConfirm={(e) => {
                              e?.stopPropagation();
                              handleDeleteNote(item.id);
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
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          {item.content || 'Không có nội dung'}
                        </Paragraph>

                        <Flex align="center" gap={8} style={{ marginTop: 4 }}>
                          <Progress 
                            percent={pct} 
                            size="small" 
                            showInfo={false} 
                            strokeColor={progressColor} 
                            style={{ margin: 0, width: 60 }}
                          />
                          <Text style={{ fontSize: 11, color: progressColor }} strong>
                            {formatRemainingTime(secLeft)}
                          </Text>
                        </Flex>
                      </Flex>
                    </div>
                  );
                }}
              />
            )}
          </Card>
        </Col>

        {/* Right Side: Note Editor */}
        <Col xs={24} lg={16}>
          {selectedNote ? (
            <Card
              style={{ 
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                borderRadius: 12,
                minHeight: 550
              }}
              title={
                <Flex justify="space-between" align="center" wrap gap={12}>
                  <Space>
                    <Badge 
                      status={
                        saveStatus === 'saving' ? 'processing' : saveStatus === 'error' ? 'error' : 'success'
                      } 
                    />
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {saveStatus === 'saving' && <><SyncOutlined spin /> Đang lưu...</>}
                      {saveStatus === 'saved' && <><CheckCircleOutlined style={{ color: '#10b981' }} /> Đã lưu</>}
                      {saveStatus === 'error' && 'Lỗi kết nối server'}
                    </Text>
                  </Space>
                  
                  {selectedNote.id && (
                    <Space>
                      <Button 
                        type="primary" 
                        icon={<ShareAltOutlined />} 
                        onClick={handleShare}
                      >
                        Chia sẻ
                      </Button>
                    </Space>
                  )}
                </Flex>
              }
            >
              <Flex vertical gap={16}>
                {/* Title */}
                <Input
                  placeholder="Tiêu đề ghi chú..."
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    triggerAutoSave(e.target.value, content, drawing, imageUrl);
                  }}
                  variant="borderless"
                  style={{ 
                    fontSize: 24, 
                    fontWeight: 700, 
                    paddingLeft: 0,
                    borderBottom: '1px solid #f1f5f9'
                  }}
                />

                {/* Expiration Note */}
                {selectedNote.id && (
                  <Flex align="center" gap={8} style={{ backgroundColor: '#eff6ff', padding: '8px 12px', borderRadius: 8 }}>
                    <InfoCircleOutlined style={{ color: '#2563eb' }} />
                    <Text style={{ fontSize: 13, color: '#1e3a8a' }}>
                      Ghi chú này sẽ tự động biến mất sau{' '}
                      <strong style={{ color: '#b91c1c' }}>
                        {formatRemainingTime(getRemainingSeconds(selectedNote.expires_at))}
                      </strong>. Mỗi lần lưu sẽ gia hạn thêm 24 giờ.
                    </Text>
                  </Flex>
                )}

                {/* Content */}
                <TextArea
                  placeholder="Viết nội dung ghi chú ở đây..."
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    triggerAutoSave(title, e.target.value, drawing, imageUrl);
                  }}
                  variant="borderless"
                  autoSize={{ minRows: 8, maxRows: 15 }}
                  style={{ paddingLeft: 0, fontSize: 15, lineHeight: 1.6 }}
                />

                {/* Media Actions */}
                <Flex gap={12} wrap style={{ padding: '12px 0', borderTop: '1px solid #f1f5f9' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <Button 
                    icon={<PictureOutlined />} 
                    onClick={handleImageClick}
                  >
                    {imageUrl ? 'Đổi ảnh đính kèm' : 'Đính kèm ảnh'}
                  </Button>
                  <Button 
                    icon={<EditOutlined />} 
                    onClick={() => setDrawingModalOpen(true)}
                  >
                    {drawing ? 'Chỉnh sửa hình vẽ' : 'Vẽ phác thảo'}
                  </Button>
                </Flex>

                {/* Media Preview (Drawing & Image) */}
                {(imageUrl || drawing) && (
                  <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
                    {imageUrl && (
                      <Col xs={24} md={12}>
                        <Card
                          title={
                            <Flex justify="space-between" align="center">
                              <span style={{ fontSize: 13 }}><FileImageOutlined /> Ảnh đính kèm</span>
                              <Button type="text" danger size="small" onClick={removeImage}>Gỡ bỏ</Button>
                            </Flex>
                          }
                          styles={{ body: { padding: 8, textAlign: 'center', backgroundColor: '#f8fafc' } }}
                        >
                          <img 
                            src={imageUrl} 
                            alt="Attachment" 
                            style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 6, objectFit: 'contain' }} 
                          />
                        </Card>
                      </Col>
                    )}

                    {drawing && (
                      <Col xs={24} md={12}>
                        <Card
                          title={
                            <Flex justify="space-between" align="center">
                              <span style={{ fontSize: 13 }}><EditOutlined /> Hình vẽ phác thảo</span>
                              <Button type="text" danger size="small" onClick={removeDrawing}>Gỡ bỏ</Button>
                            </Flex>
                          }
                          styles={{ body: { padding: 8, textAlign: 'center', backgroundColor: '#f8fafc' } }}
                        >
                          <img 
                            src={drawing} 
                            alt="Sketch" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: 220, 
                              borderRadius: 6, 
                              objectFit: 'contain',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#fff'
                            }} 
                          />
                        </Card>
                      </Col>
                    )}
                  </Row>
                )}
              </Flex>
            </Card>
          ) : (
            <Card
              style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                borderRadius: 12,
                minHeight: 550
              }}
            >
              <Flex vertical align="center" gap={16}>
                <EditOutlined style={{ fontSize: 48, color: '#94a3b8' }} />
                <Title level={4} style={{ margin: 0 }}>Chưa chọn ghi chú</Title>
                <Text type="secondary" style={{ maxWidth: 300 }}>
                  Chọn một ghi chú ở danh sách bên trái hoặc bấm nút tạo mới để soạn thảo ghi chú trực tuyến.
                </Text>
                <Button type="primary" icon={<PlusOutlined />} onClick={createNewNote}>
                  Tạo ghi chú mới
                </Button>
              </Flex>
            </Card>
          )}
        </Col>
      </Row>

      <DrawingModal
        open={drawingModalOpen}
        onClose={() => setDrawingModalOpen(false)}
        onSave={handleDrawingSave}
        initialDataUrl={drawing}
      />
    </>
  );
}
