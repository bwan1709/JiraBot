import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  Select,
  Tooltip,
  Alert,
  Spin,
  message,
  Typography,
  Divider,
  Empty,
  Popconfirm,
  Upload,
} from 'antd';
import {
  FilePdfOutlined,
  UploadOutlined,
  DownloadOutlined,
  DragOutlined,
  EditOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const { Title, Text, Paragraph } = Typography;

// Initialize PDFJS Worker using Vite's local asset bundler
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const COLOR_PALETTE = [
  { name: 'Charcoal', hex: '#2d3748' },
  { name: 'Crimson', hex: '#dc2626' },
  { name: 'Royal Blue', hex: '#1d4ed8' },
  { name: 'Forest Green', hex: '#059669' },
  { name: 'Electric Purple', hex: '#7c3aed' },
  { name: 'Deep Orange', hex: '#ea580c' },
];

const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48];

interface TextAnnotation {
  id: string;
  text: string;
  x: number;             // Native PDF points (0 = left)
  y: number;             // Native PDF points (0 = bottom)
  fontSize: number;      // Native PDF font points
  color: string;
  isOriginal?: boolean;
  originalPdfX?: number;
  originalPdfY?: number;
  originalWidth?: number;
  originalHeight?: number;
  isModified?: boolean;
  isDeleted?: boolean;
}

interface AnnotationsState {
  [pageNumber: number]: TextAnnotation[];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

// Sub-component for individual text annotations
interface AnnotationItemProps {
  annot: TextAnnotation;
  onUpdate: (updates: Partial<TextAnnotation>) => void;
  onDelete: () => void;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  pdfHeight: number;
  zoom: number;
  editExistingMode: boolean;
}

const AnnotationItem: React.FC<AnnotationItemProps> = ({
  annot,
  onUpdate,
  onDelete,
  isActive,
  onClick,
  pdfHeight,
  zoom,
  editExistingMode,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isActive]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(e);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialPdfX = annot.x;
    const initialPdfY = annot.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      // Convert pixel deltas to native PDF points
      const pdfDx = dx / zoom;
      const pdfDy = dy / zoom;

      onUpdate({
        x: initialPdfX + pdfDx,
        y: initialPdfY - pdfDy, // PDF coordinates start at bottom, so dragging down decreases Y
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Convert native PDF coordinates to screen pixel offsets
  const screenLeft = annot.x * zoom;
  const screenTop = (pdfHeight - annot.y) * zoom;
  const screenFontSize = annot.fontSize * zoom;

  // Calculate dynamic width based on longest line of text
  const longestLine = annot.text.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
  const calculatedWidth = Math.max(80, Math.min(450, longestLine * (screenFontSize * 0.58))) + 'px';

  const isUntouchedOriginal = annot.isOriginal && !annot.isModified && !annot.isDeleted;

  // Render deleted original annotations as plain white boxes to cover the text on screen
  if (annot.isDeleted && annot.isOriginal) {
    return (
      <div
        style={{
          position: 'absolute',
          left: screenLeft,
          top: screenTop,
          transform: 'translate(-5px, -50%)',
          width: `${annot.originalWidth! * zoom + 10}px`,
          height: `${annot.originalHeight! * zoom + 6}px`,
          backgroundColor: '#ffffff', // solid white to erase on screen
          border: editExistingMode ? '1px dashed #ff4d4f' : 'none',
          zIndex: 9,
          pointerEvents: editExistingMode ? 'auto' : 'none',
        }}
      >
        {editExistingMode && (
          <span style={{ fontSize: '9px', color: '#ff4d4f', position: 'absolute', top: -12, left: 0, background: '#fff', padding: '0 2px', borderRadius: 2 }}>
            Đã xóa
          </span>
        )}
      </div>
    );
  }

  // Dynamic width and height
  const widthVal = isUntouchedOriginal ? `${annot.originalWidth! * zoom + 6}px` : calculatedWidth;
  const heightVal = isUntouchedOriginal ? `${annot.originalHeight! * zoom + 4}px` : 'auto';

  // Determine colors and borders based on state
  let textColorVal = annot.color;
  let bgVal = 'transparent';
  let borderVal = '1px solid transparent';

  if (isActive) {
    textColorVal = annot.color;
    bgVal = '#ffffff';
    borderVal = '1px solid #1890ff';
  } else if (annot.isModified) {
    textColorVal = annot.color;
    bgVal = '#ffffff'; // Cover the canvas text underneath
    borderVal = '1px solid transparent';
  } else if (isUntouchedOriginal) {
    // Untouched original text is transparent on screen because it is already printed on the canvas!
    textColorVal = 'transparent'; 
    bgVal = hovered ? 'rgba(24, 144, 255, 0.12)' : 'transparent';
    borderVal = hovered ? '1px dashed #1890ff' : '1px solid transparent';
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: screenLeft,
        top: screenTop,
        transform: 'translate(-5px, -50%)',
        zIndex: isActive ? 1000 : 10,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle (only visible when active) */}
      {isActive && (
        <div
          style={{
            cursor: 'move',
            backgroundColor: '#1890ff',
            color: '#fff',
            borderRadius: '4px 0 0 4px',
            padding: '4px 6px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            alignSelf: 'stretch',
            userSelect: 'none',
            boxShadow: '0 2px 6px rgba(24, 144, 255, 0.3)',
          }}
          onMouseDown={handleDragStart}
          title="Kéo để di chuyển"
        >
          ⋮⋮
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          fontSize: `${screenFontSize}px`,
          color: textColorVal,
          fontFamily: 'Helvetica, Arial, sans-serif',
          border: borderVal,
          borderRadius: isActive ? '0 4px 4px 0' : '4px',
          backgroundColor: bgVal,
          boxShadow: isActive ? '0 2px 8px rgba(24, 144, 255, 0.25)' : 'none',
          padding: '2px 4px',
          display: 'inline-block',
          width: widthVal,
          height: heightVal,
          overflow: 'hidden',
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
      >
        <textarea
          ref={textareaRef}
          value={annot.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          onBlur={() => {
            if (!annot.text.trim()) {
              onDelete();
            }
          }}
          placeholder={isActive ? "Nhập chữ..." : ""}
          disabled={!isActive}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 'inherit',
            color: 'inherit',
            fontFamily: 'inherit',
            resize: 'none',
            width: '100%',
            height: '100%',
            padding: 0,
            margin: 0,
            lineHeight: 1.25,
            cursor: isActive ? 'text' : editExistingMode && annot.isOriginal ? 'pointer' : 'default',
            overflow: 'hidden',
          }}
          rows={annot.text.split('\n').length || 1}
        />
      </div>

      {isActive && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: '#ff4d4f',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          }}
          title="Xóa"
        >
          ✕
        </button>
      )}
    </div>
  );
};

// Sub-component for rendering a page
interface PdfPageProps {
  pdfDoc: any;
  pageNumber: number;
  zoom: number;
  activeTool: 'select' | 'text';
  annotations: TextAnnotation[];
  onAddAnnotation: (annot: Omit<TextAnnotation, 'id'>) => void;
  onUpdateAnnotation: (id: string, updates: Partial<TextAnnotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  activeAnnotId: string | null;
  setActiveAnnotId: (id: string | null) => void;
  textColor: string;
  fontSize: number;
  domId: string;
  editExistingMode: boolean;
}

const PdfPage: React.FC<PdfPageProps> = ({
  pdfDoc,
  pageNumber,
  zoom,
  activeTool,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  activeAnnotId,
  setActiveAnnotId,
  textColor,
  fontSize,
  domId,
  editExistingMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfSize, setPdfSize] = useState<{ width: number; height: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const renderPage = async () => {
      try {
        setLoading(true);
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 }); // scale=1 for native size

        if (!isMounted) return;
        setPdfSize({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const zoomedViewport = page.getViewport({ scale: zoom });

        const dpr = window.devicePixelRatio || 1;
        canvas.width = zoomedViewport.width * dpr;
        canvas.height = zoomedViewport.height * dpr;
        canvas.style.width = `${zoomedViewport.width}px`;
        canvas.style.height = `${zoomedViewport.height}px`;
        context.scale(dpr, dpr);

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderContext = {
          canvasContext: context,
          viewport: zoomedViewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (isMounted) {
          setLoading(false);
        }
      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') {
          console.error(`Lỗi render trang ${pageNumber}:`, error);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNumber, zoom]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // Only trigger if directly clicking overlay background
    if (!pdfSize) return;

    if (activeTool === 'text') {
      const rect = e.currentTarget.getBoundingClientRect();
      const htmlX = e.clientX - rect.left;
      const htmlY = e.clientY - rect.top;

      // Convert HTML coordinates to native PDF coordinates
      const pdfX = htmlX / zoom;
      const pdfY = pdfSize.height - (htmlY / zoom);

      onAddAnnotation({
        text: '',
        x: pdfX,
        y: pdfY,
        fontSize: fontSize, // font size in native points
        color: textColor,
      });
    } else {
      // Clear active selection in pointer mode
      setActiveAnnotId(null);
    }
  };

  const displayWidth = pdfSize ? pdfSize.width * zoom : 0;
  const displayHeight = pdfSize ? pdfSize.height * zoom : 0;

  return (
    <div
      id={domId}
      className="pdf-page-container"
      style={{
        position: 'relative',
        margin: '0 auto 28px auto',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        borderRadius: '6px',
        backgroundColor: '#fff',
        width: displayWidth || 'auto',
        height: displayHeight || 'auto',
        overflow: 'hidden',
        transition: 'width 0.2s, height 0.2s',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />

      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 5,
          }}
        >
          <Spin size="large" tip={`Trang ${pageNumber}...`} />
        </div>
      )}

      {pdfSize && !loading && (
        <div
          className="pdf-page-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: displayWidth,
            height: displayHeight,
            cursor: activeTool === 'text' ? 'text' : 'default',
            zIndex: 10,
          }}
          onClick={handleOverlayClick}
        >
          {annotations
            .filter((a) => editExistingMode || !a.isOriginal || a.isModified || a.isDeleted)
            .map((annot) => (
              !annot.isDeleted && (
                <AnnotationItem
                  key={annot.id}
                  annot={annot}
                  onUpdate={(updates) => onUpdateAnnotation(annot.id, { ...updates, isModified: true })}
                  onDelete={() => {
                    if (annot.isOriginal) {
                      // Keep it in state but mark as deleted to whiteout on export
                      onUpdateAnnotation(annot.id, { isDeleted: true });
                    } else {
                      onDeleteAnnotation(annot.id);
                    }
                  }}
                  isActive={activeAnnotId === annot.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveAnnotId(annot.id);
                  }}
                  pdfHeight={pdfSize.height}
                  zoom={zoom}
                  editExistingMode={editExistingMode}
                />
              )
            ))}
        </div>
      )}
    </div>
  );
};

// Main PDF Editor page component
export default function PdfEditorPage() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [textLoading, setTextLoading] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1.2);
  const [activeTool, setActiveTool] = useState<'select' | 'text'>('select');
  const [annotations, setAnnotations] = useState<AnnotationsState>({});
  const [activeAnnotId, setActiveAnnotId] = useState<string | null>(null);
  const [activeAnnotPage, setActiveAnnotPage] = useState<number | null>(null);

  // Edit existing text mode
  const [editExistingMode, setEditExistingMode] = useState<boolean>(false);
  const originalTextExtracted = useRef<boolean>(false);

  // Styling defaults for text boxes
  const [textColor, setTextColor] = useState<string>('#2d3748');
  const [fontSize, setFontSize] = useState<number>(12); // standard 12pt default

  const styleInjected = useRef(false);

  // Inject styles to page
  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;

    const css = `
      .pdf-editor-workspace {
        background-color: #1e1e24;
        border-radius: 8px;
        padding: 32px 16px;
        min-height: 60vh;
        overflow-y: auto;
        max-height: calc(100vh - 240px);
        display: flex;
        flex-direction: column;
        align-items: center;
        box-shadow: inset 0 2px 12px rgba(0,0,0,0.3);
      }
      .color-circle {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        display: inline-block;
        transition: transform 0.2s, box-shadow 0.2s;
        border: 2px solid transparent;
      }
      .color-circle:hover {
        transform: scale(1.15);
      }
      .color-circle.active {
        border-color: #1890ff;
        transform: scale(1.1);
        box-shadow: 0 0 6px rgba(24, 144, 255, 0.6);
      }
      .custom-glassbar {
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      }
      .text-annotation-card {
        transition: background-color 0.2s, border-color 0.2s;
        cursor: pointer;
      }
      .text-annotation-card:hover {
        background-color: #f0f5ff;
        border-color: #adc6ff;
      }
    `;
    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
  }, []);

  // Extract text layer from PDF
  const loadOriginalTextContent = async () => {
    if (!pdfDoc) return;
    setTextLoading(true);
    try {
      const newAnnots = { ...annotations };

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });
        const pdfHeight = viewport.height;

        const pageAnnots = textContent.items
          .map((item: any, idx: number) => {
            const pdfX = item.transform[4];
            const pdfY = item.transform[5];
            const pdfFontSize = Math.abs(item.transform[0] || item.transform[3] || 11);

            return {
              id: `orig_${pageNum}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
              text: item.str,
              x: pdfX,
              y: pdfY,
              fontSize: pdfFontSize,
              color: '#000000',
              isOriginal: true,
              originalPdfX: pdfX,
              originalPdfY: pdfY,
              originalWidth: item.width || (item.str.length * pdfFontSize * 0.55),
              originalHeight: item.height || pdfFontSize,
              originalFontSize: pdfFontSize,
              isModified: false,
              isDeleted: false,
            };
          })
          .filter((a: any) => a.text.trim().length > 0);

        // Merge original text elements with any new user-created annotations
        const userCreated = (annotations[pageNum] || []).filter((a) => !a.isOriginal);
        newAnnots[pageNum] = [...userCreated, ...pageAnnots];
      }

      setAnnotations(newAnnots);
      originalTextExtracted.current = true;
      message.success('Nhận diện chữ gốc thành công! Nhấp vào các khung chữ viền đứt màu xanh để sửa.');
    } catch (err) {
      console.error('Lỗi nhận diện chữ:', err);
      message.error('Không thể nhận diện các thành phần chữ trong tài liệu này.');
    } finally {
      setTextLoading(false);
    }
  };

  const handleEditModeToggle = () => {
    if (!editExistingMode && !originalTextExtracted.current) {
      loadOriginalTextContent();
    }
    setEditExistingMode(!editExistingMode);
  };

  // Sync toolbar formatting changes to active annotation
  const handleColorChange = (hex: string) => {
    setTextColor(hex);
    if (activeAnnotId && activeAnnotPage) {
      updateAnnotation(activeAnnotPage, activeAnnotId, { color: hex });
    }
  };

  const handleFontSizeChange = (val: number) => {
    setFontSize(val);
    if (activeAnnotId && activeAnnotPage) {
      updateAnnotation(activeAnnotPage, activeAnnotId, { fontSize: val });
    }
  };

  // Upload handler
  const handleUpload = (file: File) => {
    if (file.type !== 'application/pdf') {
      message.error('Vui lòng tải lên file định dạng PDF!');
      return false;
    }

    setLoading(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const bytes = new Uint8Array(e.target?.result as ArrayBuffer);
        setPdfBytes(bytes);

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const doc = await loadingTask.promise;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setAnnotations({});
        setActiveAnnotId(null);
        setActiveAnnotPage(null);
        setEditExistingMode(false);
        originalTextExtracted.current = false;
        message.success('Đã tải và phân tích file PDF thành công!');
      } catch (err) {
        console.error('Lỗi khi đọc file PDF:', err);
        message.error('Không thể đọc file PDF này. File có thể bị hỏng.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Stop auto-upload
  };

  // Annotations helpers
  const addAnnotation = (pageNumber: number, annotData: Omit<TextAnnotation, 'id'>) => {
    const id = `annot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newAnnot: TextAnnotation = {
      ...annotData,
      id,
    };

    setAnnotations((prev) => {
      const pageAnnots = prev[pageNumber] || [];
      return {
        ...prev,
        [pageNumber]: [...pageAnnots, newAnnot],
      };
    });

    setActiveAnnotId(id);
    setActiveAnnotPage(pageNumber);
  };

  const updateAnnotation = (pageNumber: number, id: string, updates: Partial<TextAnnotation>) => {
    setAnnotations((prev) => {
      const pageAnnots = prev[pageNumber] || [];
      return {
        ...prev,
        [pageNumber]: pageAnnots.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      };
    });
  };

  const onDeleteAnnotation = (id: string) => {
    if (!activeAnnotPage) return;
    setAnnotations((prev) => {
      const pageAnnots = prev[activeAnnotPage] || [];
      return {
        ...prev,
        [activeAnnotPage]: pageAnnots.filter((a) => a.id !== id),
      };
    });

    if (activeAnnotId === id) {
      setActiveAnnotId(null);
      setActiveAnnotPage(null);
    }
  };

  const clearAllAnnotations = () => {
    setAnnotations({});
    setActiveAnnotId(null);
    setActiveAnnotPage(null);
    setEditExistingMode(false);
    originalTextExtracted.current = false;
    message.info('Đã xóa toàn bộ ghi chú và khôi phục văn bản gốc!');
  };

  // PDF Save Engine: Applies whiteouts & new text onto original PDF bytes
  const handleExport = async () => {
    if (!pdfBytes || !pdfDoc) return;

    const modifiedList = Object.values(annotations).flat();
    const hasEdits = modifiedList.some((a) => !a.isOriginal || a.isModified || a.isDeleted);

    if (!hasEdits) {
      message.warning('Chưa có thay đổi nào được thực hiện!');
      return;
    }

    try {
      const hideLoad = message.loading('Đang xử lý xuất PDF...', 0);

      const pdfLibDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfLibDoc.getPages();
      const font = await pdfLibDoc.embedFont(StandardFonts.Helvetica);

      for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        const pageNum = pageIdx + 1;
        const pageAnnots = annotations[pageNum] || [];
        if (pageAnnots.length === 0) continue;

        const page = pages[pageIdx];

        // 1. Process Whiteouts: Erase original text elements that were edited or deleted
        for (const annot of pageAnnots) {
          if (annot.isOriginal && (annot.isDeleted || annot.isModified)) {
            // Draw a white rectangle over the original text bounding box to erase it
            page.drawRectangle({
              x: annot.originalPdfX!,
              y: annot.originalPdfY! - (annot.originalHeight! * 0.15),
              width: annot.originalWidth! * 1.06,
              height: annot.originalHeight! * 1.25,
              color: rgb(1, 1, 1), // Whiteout
            });
          }
        }

        // 2. Process Writeovers: Draw new or edited text onto the page
        for (const annot of pageAnnots) {
          if (!annot.isDeleted && (!annot.isOriginal || annot.isModified)) {
            const colorRgb = hexToRgb(annot.color);
            const pdfFontSize = annot.fontSize;

            // Render multiline text correctly
            const textLines = annot.text.split('\n');
            let currentY = annot.y;

            for (const line of textLines) {
              page.drawText(line, {
                x: annot.x,
                y: currentY,
                size: pdfFontSize,
                font: font,
                color: rgb(colorRgb.r / 255, colorRgb.g / 255, colorRgb.b / 255),
              });
              currentY -= pdfFontSize * 1.25; // Line height factor
            }
          }
        }
      }

      const modifiedPdfBytes = await pdfLibDoc.save();

      // Trigger client-side browser download
      const blob = new Blob([modifiedPdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.replace(/\.pdf$/i, '_edited.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      hideLoad();
      message.success('Xuất file PDF thành công!');
    } catch (err) {
      console.error('Lỗi xuất file PDF:', err);
      message.error('Không thể lưu file PDF. Đã xảy ra lỗi.');
    }
  };

  const getActiveAnnotation = (): TextAnnotation | null => {
    if (!activeAnnotId || !activeAnnotPage) return null;
    return annotations[activeAnnotPage]?.find((a) => a.id === activeAnnotId) || null;
  };

  const activeAnnotObj = getActiveAnnotation();

  // Scroll to page helper
  const jumpToPage = (pageNum: number) => {
    const el = document.getElementById(`pdf-page-wrapper-${pageNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Count active edits on PDF
  const activeEditsCount = Object.values(annotations)
    .flat()
    .filter((a) => !a.isOriginal || a.isModified || a.isDeleted).length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px' }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          Trình biên tập & Sửa chữ PDF trực tiếp
        </Title>
        <Text type="secondary">
          Hỗ trợ cả thêm chữ mới và click để sửa/xóa các nội dung chữ có sẵn trong file PDF của bạn.
        </Text>
      </div>

      {!pdfDoc ? (
        <Card style={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0' }}>
            <Upload.Dragger
              accept=".pdf"
              showUploadList={false}
              beforeUpload={handleUpload}
              style={{ width: '100%', maxWidth: '600px', borderRadius: 8 }}
            >
              <p className="ant-upload-drag-icon">
                <FilePdfOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 18, fontWeight: 500 }}>
                Kéo thả file PDF vào đây hoặc nhấp chuột để chọn file
              </p>
              <p className="ant-upload-hint">
                Hỗ trợ file PDF biểu mẫu, hợp đồng. Toàn bộ quá trình diễn ra bảo mật ngay tại trình duyệt của bạn.
              </p>
            </Upload.Dragger>
            {loading && <Spin size="large" style={{ marginTop: 24 }} tip="Đang đọc file PDF..." />}
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          {/* Main Workspace (Left) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Toolbar Panel */}
            <div className="custom-glassbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <Space split={<Divider type="vertical" />}>
                {/* Mode Select */}
                <Space>
                  <Tooltip title="Chế độ con trỏ (Chọn và di chuyển chữ)">
                    <Button
                      type={activeTool === 'select' ? 'primary' : 'default'}
                      icon={<DragOutlined />}
                      onClick={() => {
                        setActiveTool('select');
                        setActiveAnnotId(null);
                        setActiveAnnotPage(null);
                      }}
                    >
                      Kéo/Chọn
                    </Button>
                  </Tooltip>
                  <Tooltip title="Click vào trang để thêm chữ mới">
                    <Button
                      type={activeTool === 'text' ? 'primary' : 'default'}
                      icon={<EditOutlined />}
                      danger={activeTool === 'text'}
                      onClick={() => setActiveTool('text')}
                    >
                      Thêm chữ (T)
                    </Button>
                  </Tooltip>
                  <Tooltip title="Nhận diện và bật/tắt chế độ sửa trực tiếp chữ có sẵn của PDF">
                    <Button
                      type={editExistingMode ? 'primary' : 'default'}
                      icon={<FileTextOutlined />}
                      onClick={handleEditModeToggle}
                      loading={textLoading}
                      style={editExistingMode ? { backgroundColor: '#2f54eb', borderColor: '#2f54eb' } : undefined}
                    >
                      Sửa chữ có sẵn
                    </Button>
                  </Tooltip>
                </Space>

                {/* Typography controls */}
                <Space size={12}>
                  <Text style={{ fontSize: 12, fontWeight: 500 }}>CỠ CHỮ:</Text>
                  <Select
                    value={activeAnnotObj ? activeAnnotObj.fontSize : fontSize}
                    onChange={handleFontSizeChange}
                    style={{ width: 75 }}
                    options={FONT_SIZES.map((s) => ({ label: `${s}pt`, value: s }))}
                  />

                  <Text style={{ fontSize: 12, fontWeight: 500 }}>MÀU SẮC:</Text>
                  <Space size={6}>
                    {COLOR_PALETTE.map((c) => (
                      <span
                        key={c.hex}
                        className={`color-circle ${
                          (activeAnnotObj ? activeAnnotObj.color : textColor) === c.hex ? 'active' : ''
                        }`}
                        style={{ backgroundColor: c.hex }}
                        onClick={() => handleColorChange(c.hex)}
                        title={c.name}
                      />
                    ))}
                  </Space>
                </Space>
              </Space>

              <Space split={<Divider type="vertical" />}>
                {/* Zooming */}
                <Space>
                  <Button
                    icon={<ZoomOutOutlined />}
                    disabled={zoom <= 0.6}
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
                  />
                  <Text style={{ minWidth: 42, textAlign: 'center', display: 'inline-block' }}>
                    {Math.round(zoom * 100)}%
                  </Text>
                  <Button
                    icon={<ZoomInOutlined />}
                    disabled={zoom >= 2.4}
                    onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
                  />
                </Space>

                {/* Actions */}
                <Space>
                  {activeEditsCount > 0 && (
                    <Popconfirm
                      title="Xóa tất cả thay đổi và khôi phục PDF gốc?"
                      onConfirm={clearAllAnnotations}
                      okText="Khôi phục"
                      cancelText="Không"
                    >
                      <Button icon={<DeleteOutlined />} danger type="text">
                        Khôi phục gốc
                      </Button>
                    </Popconfirm>
                  )}
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    onClick={handleExport}
                  >
                    Xuất PDF
                  </Button>
                </Space>
              </Space>
            </div>

            {/* Prompt Alerts */}
            {editExistingMode && (
              <Alert
                message={
                  <span>
                    <InfoCircleOutlined style={{ marginRight: 6 }} />
                    <b>Chế độ sửa chữ có sẵn ĐANG BẬT</b>: Hãy nhấp chuột vào các khối chữ có <b>viền đứt màu xanh</b> trên tài liệu để chỉnh sửa nội dung hoặc di chuyển chúng. Khi lưu, phần chữ cũ sẽ tự động được xóa đi.
                  </span>
                }
                type="warning"
                showIcon={false}
                closable
              />
            )}

            {activeTool === 'text' && !editExistingMode && (
              <Alert
                message={
                  <span>
                    <InfoCircleOutlined style={{ marginRight: 6 }} />
                    Hãy click chuột vào bất kỳ vị trí nào trên trang PDF để chèn thêm văn bản mới.
                  </span>
                }
                type="info"
                showIcon={false}
                closable
              />
            )}

            {/* Main Canvas Scroll Area */}
            <div className="pdf-editor-workspace">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div key={pageNum} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Text style={{ color: '#8c8c8c', marginBottom: 8, fontSize: 12 }}>
                    Trang {pageNum} / {numPages}
                  </Text>
                  <PdfPage
                    domId={`pdf-page-wrapper-${pageNum}`}
                    pdfDoc={pdfDoc}
                    pageNumber={pageNum}
                    zoom={zoom}
                    activeTool={activeTool}
                    annotations={annotations[pageNum] || []}
                    onAddAnnotation={(annot) => addAnnotation(pageNum, annot)}
                    onUpdateAnnotation={(id, updates) => updateAnnotation(pageNum, id, updates)}
                    onDeleteAnnotation={onDeleteAnnotation}
                    activeAnnotId={activeAnnotId}
                    setActiveAnnotId={(id) => {
                      setActiveAnnotId(id);
                      if (id) setActiveAnnotPage(pageNum);
                    }}
                    textColor={textColor}
                    fontSize={fontSize}
                    editExistingMode={editExistingMode}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Outline (Right) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Card style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FilePdfOutlined style={{ fontSize: 32, color: '#ff4d4f' }} />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Text strong style={{ display: 'block' }}>{fileName}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {numPages} trang | {activeEditsCount} chỉnh sửa
                  </Text>
                </div>
              </div>
              <Button
                type="dashed"
                size="small"
                icon={<UploadOutlined />}
                style={{ width: '100%', marginTop: 12 }}
                onClick={() => {
                  setPdfDoc(null);
                  setPdfBytes(null);
                  setAnnotations({});
                  setEditExistingMode(false);
                  originalTextExtracted.current = false;
                }}
              >
                Tải lên file khác
              </Button>
            </Card>

            {/* List of modified annotations */}
            <Card
              title={<span style={{ fontSize: 15 }}>Lịch sử chỉnh sửa</span>}
              style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flexGrow: 1, minHeight: '300px' }}
              bodyStyle={{ padding: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 440px)' }}
            >
              {activeEditsCount === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ fontSize: 13, color: '#8c8c8c' }}>
                      Chưa có thay đổi nào. Thêm chữ mới hoặc bật <b>Sửa chữ có sẵn</b> để chỉnh sửa tài liệu.
                    </span>
                  }
                />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {Object.entries(annotations).flatMap(([pageNumStr, pageAnnots]) => {
                    const pageNum = parseInt(pageNumStr);
                    return (pageAnnots as TextAnnotation[])
                      .filter((a: TextAnnotation) => !a.isOriginal || a.isModified || a.isDeleted)
                      .map((annot: TextAnnotation) => (
                        <Card
                          key={annot.id}
                          size="small"
                          className="text-annotation-card"
                          style={{
                            borderLeftWidth: '3px',
                            borderLeftColor: annot.isDeleted ? '#ff4d4f' : annot.color,
                            backgroundColor: activeAnnotId === annot.id ? '#e6f7ff' : '#fff',
                            textDecoration: annot.isDeleted ? 'line-through' : 'none',
                          }}
                          onClick={() => {
                            if (annot.isDeleted) return;
                            setActiveAnnotId(annot.id);
                            setActiveAnnotPage(pageNum);
                            jumpToPage(pageNum);
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 500 }}>
                              Trang {pageNum}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                color: annot.isDeleted ? '#ff4d4f' : '#bfbfbf',
                                backgroundColor: '#f5f5f5',
                                padding: '1px 4px',
                                borderRadius: 3,
                              }}
                            >
                              {annot.isDeleted ? 'Đã xóa' : annot.isOriginal ? 'Đã sửa gốc' : 'Chữ mới'}
                            </span>
                          </div>
                          <Paragraph
                            ellipsis={{ rows: 2 }}
                            style={{
                              margin: '4px 0 0 0',
                              fontSize: 12,
                              fontWeight: activeAnnotId === annot.id ? 500 : 400,
                              color: annot.isDeleted ? '#bfbfbf' : '#434343',
                            }}
                          >
                            {annot.text.trim() || <Text type="warning" italic>Đang nhập chữ...</Text>}
                          </Paragraph>
                        </Card>
                      ));
                  })}
                </Space>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
