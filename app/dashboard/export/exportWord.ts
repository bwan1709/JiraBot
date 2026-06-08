import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
  Header,
} from 'docx';
import type { IRunOptions } from 'docx';
import type { MessageInstance } from 'antd/es/message/interface';
import { api } from '../../api';
import type { MonthData, User } from '../../types';

/** Monthly Word report — faithful port of the original public/index.html exportWord(). */
export async function exportWord(
  currentMonth: string | null,
  user: User | null,
  onData: (d: MonthData) => void,
  message: MessageInstance,
): Promise<void> {
  if (!currentMonth) {
    message.info('Vui lòng chọn tháng trước.');
    return;
  }
  try {
    message.info('Đang cập nhật dữ liệu từ Jira...');
    const data = await api.post<MonthData>(`/api/refresh/${currentMonth}`);
    onData(data);

    const [y, m] = currentMonth.split('-');

    // ── Helpers ───────────────────────────────────────────────────────────
    const R = (t: unknown, o: IRunOptions = {}) =>
      new TextRun({ text: String(t ?? ''), font: 'Times New Roman', size: 22, ...o });
    const RB = (t: unknown, o: IRunOptions = {}) => R(t, { bold: true, ...o });
    const brd = (color = '000000', sz = 4) => ({ style: BorderStyle.SINGLE, size: sz, color });
    const noBrd = () => ({ style: BorderStyle.NIL });
    const CB = { top: brd(), bottom: brd(), left: brd(), right: brd() };
    const NB = { top: noBrd(), bottom: noBrd(), left: noBrd(), right: noBrd() };

    const mkCell = (runs: TextRun[], align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT, opts: any = {}) =>
      new TableCell({
        borders: CB,
        verticalAlign: VerticalAlign.CENTER,
        ...opts,
        children: [
          new Paragraph({ alignment: align, spacing: { before: 40, after: 40 }, children: runs }),
        ],
      });
    const mkCellC = (runs: TextRun[], opts: any = {}) => mkCell(runs, AlignmentType.CENTER, opts);
    const mkHdrCell = (txt: string, opts: any = {}) => mkCellC([RB(txt, { size: 24 })], opts);
    const mkSpanCell = (txt: string, span: number) =>
      new TableCell({
        columnSpan: span,
        borders: CB,
        children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [RB(txt, { size: 24 })] })],
      });
    const P = (runs: TextRun[], opts: any = {}) =>
      new Paragraph({ spacing: { before: 60, after: 60 }, ...opts, children: runs });

    const mkSigBlock = (afterSpacing = 100) =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders: NB, width: { size: 60, type: WidthType.PERCENTAGE }, children: [] }),
              new TableCell({
                borders: NB,
                width: { size: 40, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 120, after: 0 },
                    children: [R('Ngày.......tháng.......năm ....')],
                  }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [] }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: afterSpacing },
                    children: [R('Ký tên')],
                  }),
                ],
              }),
            ],
          }),
        ],
      });

    const mkHeader = () =>
      new Header({
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: NB,
                    width: { size: 60, type: WidthType.PERCENTAGE },
                    children: [P([R('CÔNG TY CP ACORNERI HOLDING', { font: 'Arial', size: 22 })])],
                  }),
                  new TableCell({
                    borders: NB,
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    children: [
                      P(
                        [
                          R('Mẫu số: ', { font: 'VNI-Times', size: 22 }),
                          R('13-HCNS/ACH', { font: 'VNI-Times', size: 22, underline: {} }),
                        ],
                        { alignment: AlignmentType.RIGHT },
                      ),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });

    // ── Evaluation table ──
    const evalTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            mkHdrCell('STT', { width: { size: 8, type: WidthType.PERCENTAGE } }),
            mkHdrCell('TIÊU CHÍ', { width: { size: 42, type: WidthType.PERCENTAGE } }),
            mkHdrCell('SỐ ĐIỂM', { width: { size: 12, type: WidthType.PERCENTAGE } }),
            mkHdrCell('HỆ SỐ', { width: { size: 10, type: WidthType.PERCENTAGE } }),
            mkHdrCell('TỔNG ĐIỂM', { width: { size: 14, type: WidthType.PERCENTAGE } }),
            mkHdrCell('ĐÁNH GIÁ', { width: { size: 14, type: WidthType.PERCENTAGE } }),
          ],
        }),
        new TableRow({ children: [mkCellC([RB('I.')]), mkCell([RB('Mức độ tuân thủ kỷ luật lao động')]), mkCellC([R('')]), mkCellC([RB('1')]), mkCellC([R('')]), mkCellC([R('')])] }),
        new TableRow({ children: [mkCellC([R('I.1')]), mkCell([R('- Thời gian làm việc')]), mkCellC([R('10')]), mkCellC([R('0.6')]), mkCellC([R('6')]), mkCellC([R('')])] }),
        new TableRow({ children: [mkCellC([R('I.2')]), mkCell([R('- Kỷ luật điều hành')]), mkCellC([R('10')]), mkCellC([R('0.4')]), mkCellC([R('4')]), mkCellC([R('')])] }),
        new TableRow({ children: [mkCellC([RB('II.')]), mkCell([RB('Tinh thần và thái độ làm việc')]), mkCellC([R('')]), mkCellC([RB('1')]), mkCellC([R('')]), mkCellC([R('')])] }),
        new TableRow({ children: [mkCellC([R('II.1')]), mkCell([R('- Sự phối hợp xử lý công việc (Làm việc nhóm)')]), mkCellC([R('10')]), mkCellC([R('0.5')]), mkCellC([R('5')]), mkCellC([R('')])] }),
        new TableRow({ children: [mkCellC([R('II.2')]), mkCell([R('- Thái độ tích cực')]), mkCellC([R('10')]), mkCellC([R('0.5')]), mkCellC([R('5')]), mkCellC([R('')])] }),
        new TableRow({ children: [mkCellC([RB('III.')]), mkCell([RB('Mức độ hoàn thành công việc được giao')]), mkCellC([R('')]), mkCellC([RB('6')]), mkCellC([R('')]), mkCellC([R('')])] }),
        new TableRow({ children: [mkCellC([R('III.1')]), mkCell([R('- Khối lượng công việc')]), mkCellC([R('10')]), mkCellC([R('2.4')]), mkCellC([R('24')]), mkCellC([R('')])] }),
        new TableRow({ children: [mkCellC([R('III.2')]), mkCell([R('- Chất lượng công việc')]), mkCellC([R('10')]), mkCellC([R('2.4')]), mkCellC([R('24')]), mkCellC([R('')])] }),
        new TableRow({ children: [mkCellC([R('III.3')]), mkCell([R('- Thời hạn')]), mkCellC([R('10')]), mkCellC([R('1.2')]), mkCellC([R('12')]), mkCellC([R('')])] }),
        new TableRow({ children: [mkCellC([RB('IV.')]), mkCell([RB('Đạo đức nghề nghiệp')]), mkCellC([RB('10')]), mkCellC([RB('1')]), mkCellC([RB('10')]), mkCellC([R('')])] }),
        new TableRow({ children: [mkCellC([RB('V.')]), mkCell([RB('Sáng kiến, cải tiến, giải pháp hữu ích')]), mkCellC([RB('0')]), mkCellC([RB('1')]), mkCellC([RB('0')]), mkCellC([R('')])] }),
        new TableRow({
          children: [
            new TableCell({ columnSpan: 2, borders: CB, children: [P([RB('Tổng kết:')], { alignment: AlignmentType.CENTER })] }),
            mkCellC([R('')]),
            mkCellC([R('')]),
            mkCellC([RB('90')]),
            mkCellC([R('')]),
          ],
        }),
      ],
    });

    const ratings = [
      { range: '00 đến dưới 30 điểm', rank: 'Xếp loại Kém' },
      { range: '30 đến dưới 50 điểm', rank: 'Xếp loại Yếu.' },
      { range: '50 đến dưới 65 điểm', rank: 'Xếp loại Trung Bình.' },
      { range: '65 đến dưới 80 điểm', rank: 'Xếp loại Khá.' },
      { range: '80 đến dưới 90 điểm', rank: 'Xếp loại Giỏi.' },
      { range: '90 đến dưới 100 điểm', rank: 'Xếp loại Xuất Sắc.' },
    ];

    const performedTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            mkHdrCell('NỘI DUNG BÁO CÁO', { width: { size: 80, type: WidthType.PERCENTAGE } }),
            mkHdrCell('THỰC HIỆN', { width: { size: 20, type: WidthType.PERCENTAGE } }),
          ],
        }),
        new TableRow({ children: [mkSpanCell('A/CÁC CÔNG VIỆC THỰC HIỆN', 2)] }),
        ...(data.tasks || []).map(
          (t) => new TableRow({ children: [mkCell([R(t.summary)]), mkCellC([R('Đã hoàn thành')])] }),
        ),
      ],
    });

    const planTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [mkSpanCell('B/KẾ HOẠCH THÁNG', 1)] }),
        new TableRow({ children: [mkCell([R('')])] }),
        new TableRow({ children: [mkCell([R('')])] }),
        new TableRow({ children: [mkCell([R('')])] }),
      ],
    });

    const opinionTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              borders: CB,
              children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [RB('C/Ý KIẾN, ĐỀ XUẤT', { size: 24 })] })],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: CB,
              children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [] })],
            }),
          ],
        }),
      ],
    });

    const ratingTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: NB,
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ spacing: { before: 20, after: 20 }, children: [RB('• Đánh giá :')] })],
            }),
            new TableCell({
              borders: NB,
              width: { size: 80, type: WidthType.PERCENTAGE },
              children: ratings.map(
                (item) =>
                  new Paragraph({
                    spacing: { before: 20, after: 20 },
                    children: [R(`${item.range}   =>   `), RB(item.rank, { underline: {} })],
                  }),
              ),
            }),
          ],
        }),
      ],
    });

    const margin = { top: 1200, bottom: 720, left: 1080, right: 720, header: 562, footer: 562 };

    const doc = new Document({
      styles: { default: { document: { run: { font: 'Times New Roman', size: 22 } } } },
      sections: [
        {
          headers: { default: mkHeader() },
          properties: { page: { margin } },
          children: [
            P([RB('BÁO CÁO VÀ ĐÁNH GIÁ HIỆU QUẢ CÔNG VIỆC', { size: 32 })], { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 } }),
            P([RB(`THÁNG ${m}/${y}`, { size: 26 })], { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 300 } }),
            P([RB('Họ & tên: '), R(user ? user.full_name : 'Nguyễn Văn A')]),
            P([RB('Chức danh: '), R(user && user.job_title ? user.job_title : 'Nhân viên')]),
            P([RB('Bộ phận: '), R(user ? user.department : 'Acorneri IT')], { spacing: { before: 60, after: 240 } }),
            P([R('')]),
            P([RB('I/ PHẦN ĐÁNH GIÁ (số điểm 01 -10)', { size: 24 })], { spacing: { before: 0, after: 120 } }),
            evalTable,
            P([R('')], { spacing: { before: 120, after: 40 } }),
            ratingTable,
          ],
        },
        {
          headers: { default: mkHeader() },
          properties: { page: { margin } },
          children: [
            P([RB('II/. BÁO CÁO CÔNG VIỆC', { size: 24 })], { spacing: { before: 160, after: 160 } }),
            performedTable,
            P([R('')], { spacing: { before: 120, after: 40 } }),
            planTable,
            P([R('')], { spacing: { before: 200, after: 60 } }),
            opinionTable,
            P([R('')]),
            mkSigBlock(100),
          ],
        },
        {
          headers: { default: mkHeader() },
          properties: { page: { margin } },
          children: [
            P([R('')]),
            P([RB('III/. NHẬN XÉT, ĐÁNH GIÁ CỦA TRƯỞNG BỘ PHẬN:', { size: 24 })], { spacing: { before: 300, after: 60 } }),
            P([R('')]),
            P([R('_____________________________________________________________________________')]),
            P([R('_____________________________________________________________________________')]),
            P([R('_____________________________________________________________________________')]),
            P([R('_____________________________________________________________________________')]),
            P([R('')]),
            mkSigBlock(100),
            P([R('')]),
            P([R('')]),
            P([R('')]),
            P([R('')]),
            P([RB('IV/. Ý KIẾN ĐÁNH GIÁ VÀ QUYẾT ĐỊNH CUỐI CÙNG CỦA LÃNH ĐẠO', { size: 24 })], { spacing: { before: 300, after: 60 } }),
            P([R('')]),
            P([R('_____________________________________________________________________________')]),
            P([R('_____________________________________________________________________________')]),
            P([R('_____________________________________________________________________________')]),
            P([R('_____________________________________________________________________________')]),
            P([R('_____________________________________________________________________________')]),
            P([R('_____________________________________________________________________________')]),
            P([R('_____________________________________________________________________________')]),
            P([R('')]),
            mkSigBlock(0),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const userName = user && user.full_name ? user.full_name.trim() : 'User';
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const exportDate = `${dd}${mm}${now.getFullYear()}`;
    a.href = url;
    a.download = `${userName}_BCCV_T${m}_${exportDate}.docx`;
    a.click();
    URL.revokeObjectURL(url);

    message.success(`Xuất báo cáo tháng thành công! ${data.tasks.length} tasks`);
  } catch (e: any) {
    message.error(`Lỗi Xuất báo cáo tháng: ${e.message}`);
  }
}
