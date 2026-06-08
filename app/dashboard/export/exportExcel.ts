import * as XLSX from 'xlsx';
import type { MessageInstance } from 'antd/es/message/interface';
import { api } from '../../api';
import type { MonthData } from '../../types';

/** Excel export for the whole month (Done tasks). Refreshes from Jira first. */
export async function exportExcel(
  currentMonth: string | null,
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

    const rows: (string | number)[][] = [['Key', 'Summary', 'Status', 'Time Spent']];
    (data.tasks || []).forEach((t) => {
      rows.push([t.key, t.summary, t.status, Math.round((t.time_spent_hours || 0) * 3600)]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 16 }, { wch: 60 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, currentMonth);
    XLSX.writeFile(wb, `Jira_${currentMonth}.xlsx`);

    message.success(`Xuất Excel thành công! ${data.tasks.length} tasks`);
  } catch (e: any) {
    if (e.code === 'JIRA_401' || e.code === 'JIRA_MISSING_INFO') {
      message.error('Vui lòng cung cấp đầy đủ thông tin Jira trong mục Cài đặt cá nhân.');
    } else {
      message.error(`Lỗi xuất Excel: ${e.message}`);
    }
  }
}
