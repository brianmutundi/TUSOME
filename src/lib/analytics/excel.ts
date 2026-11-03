import ExcelJS from 'exceljs';
import { getSchoolProfile } from '@/lib/analytics/api';

export async function exportToExcel<T>(
  filename: string,
  sheetName: string,
  columns: { header: string; key: string; width?: number }[],
  rows: T[],
  valueGetter: (row: T, key: string) => string | number | null | undefined,
  meta?: { title?: string; filters?: Record<string, string> }
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  let rowIdx = 1;
  // School metadata rows
  try {
    const profile = await getSchoolProfile();
    if (profile?.name) {
      sheet.getCell(rowIdx, 1).value = profile.name;
      sheet.getCell(rowIdx, 1).font = { bold: true, size: 14 };
      rowIdx++;
    }
  } catch {
    // ignore
  }

  if (meta?.title) {
    sheet.getCell(rowIdx, 1).value = meta.title;
    sheet.getCell(rowIdx, 1).font = { bold: true, size: 12 };
    rowIdx++;
  }

  if (meta?.filters) {
    for (const [k, v] of Object.entries(meta.filters)) {
      sheet.getCell(rowIdx, 1).value = `${k}: ${v}`;
      rowIdx++;
    }
  }

  rowIdx++; // blank row

  // Header row
  const headerRow = sheet.getRow(rowIdx);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  });
  headerRow.commit();
  const headerRowNum = rowIdx;
  rowIdx++;

  // Data rows
  for (const row of rows) {
    const r = sheet.getRow(rowIdx);
    columns.forEach((col, i) => {
      const v = valueGetter(row, col.key);
      const cell = r.getCell(i + 1);
      cell.value = v ?? null;
      if (typeof v === 'number') cell.numFmt = '#,##0.00';
    });
    r.commit();
    rowIdx++;
  }

  // Column widths
  columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width ?? 18;
  });

  // Freeze header
  sheet.views = [{ state: 'frozen', ySplit: headerRowNum }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}