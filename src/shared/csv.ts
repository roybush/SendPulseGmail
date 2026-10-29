/** RFC 4180 CSV with a BOM, so Excel opens Cyrillic and other non-Latin text correctly. */
export function toCsv(rows: string[][]): string {
  const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return '﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
