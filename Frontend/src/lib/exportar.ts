import * as XLSX from 'xlsx';

export function exportarXlsx(dados: Record<string, unknown>[], nomeArquivo: string) {
  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
}

export function exportarCsv(dados: Record<string, unknown>[], nomeArquivo: string) {
  const ws = XLSX.utils.json_to_sheet(dados);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomeArquivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
