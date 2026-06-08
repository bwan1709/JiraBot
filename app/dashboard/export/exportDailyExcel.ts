import * as XLSX from 'xlsx';
import type { MessageInstance } from 'antd/es/message/interface';
import { api } from '../../api';
import type { DailyReport } from '../../types';
import { fmtDate, formatISOToDateTime, secondsToJiraEstimateDash, todayStr } from '../../utils/format';

/** Excel export of today's daily report (tasks with worklog today). */
export async function exportDailyExcel(message: MessageInstance): Promise<void> {
  try {
    const today = todayStr();
    message.info(`Đang tải báo cáo ngày ${fmtDate(today)} từ Jira...`);
    const resData = await api.get<DailyReport>(`/api/daily-report?date=${today}`);
    const tasks = resData.tasks || [];

    if (tasks.length === 0) {
      message.info(`Không có công việc nào có worklog trong ngày hôm nay (${fmtDate(today)}).`);
      return;
    }

    const wsData: (string | number)[][] = [
      ['Key', 'Summary', 'Original Estimate', 'Actual Start', 'Actual End', 'Time Spent'],
    ];
    tasks.forEach((t) => {
      wsData.push([
        t.key,
        t.summary || '—',
        secondsToJiraEstimateDash(t.original_estimate),
        formatISOToDateTime(t.actual_start),
        formatISOToDateTime(t.actual_end),
        secondsToJiraEstimateDash(t.time_spent_seconds),
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Hyperlink the Key column to the Jira issue.
    tasks.forEach((t, i) => {
      const addr = `A${i + 2}`;
      ws[addr] = {
        v: t.key,
        t: 's',
        l: { Target: t.url, Tooltip: `Click để mở ${t.key} trên Jira` },
      };
    });

    ws['!cols'] = [{ wch: 16 }, { wch: 60 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo ngày');
    XLSX.writeFile(wb, `BaoCaoNgay_${today}.xlsx`);

    message.success(`Xuất báo cáo ngày thành công! ${tasks.length} tasks`);
  } catch (e: any) {
    message.error(`Lỗi xuất báo cáo ngày: ${e.message}`);
  }
}
