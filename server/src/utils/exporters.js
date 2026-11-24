import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
import { getSettings } from '../models/index.js';
import { tabulate } from './tabulate.js';

const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''));

export async function schoolInfo() {
  const s = await getSettings();
  const m = /^\/api\/files\/([a-f0-9]{32}\.(?:jpg|png))$/.exec(s.logoUrl || ''); // PDFKit cannot draw WebP
  const p = m && path.join(path.resolve(env.uploadDir), m[1]);
  return { schoolName: s.schoolName, address: s.address, logoPath: p && fs.existsSync(p) ? p : null };
}

export async function sendXlsx(res, filename, sheetName, rows) {
  const { headers, data } = tabulate(rows);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet((sheetName || 'Sheet1').slice(0, 31));
  ws.addRow(headers); ws.getRow(1).font = { bold: true };
  data.forEach((r) => ws.addRow(r)); // strings stay text, so values like "=1+1" are never treated as formulas
  ws.columns.forEach((c) => { c.width = 18; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

export function sendPdfTable(res, { filename, title, schoolName, rows }) {
  const { headers, data } = tabulate(rows);
  const MAX = 9;
  const H = headers.slice(0, MAX); const D = data.map((r) => r.slice(0, MAX));
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(16).text(schoolName || 'SaheemOS');
  doc.font('Helvetica').fontSize(12).text(title);
  doc.fontSize(8).fillColor('#666').text(`Generated ${new Date().toLocaleString()}${headers.length > MAX ? ` · first ${MAX} of ${headers.length} columns (use Excel for all)` : ''}`).fillColor('#000');
  doc.moveDown(0.6);
  const width = doc.page.width - 72; const colW = width / Math.max(H.length, 1); const rowH = 18;
  let y = doc.y;
  const head = () => {
    doc.font('Helvetica-Bold').fontSize(8);
    H.forEach((h, i) => doc.text(h, 36 + i * colW, y, { width: colW - 4, lineBreak: false, ellipsis: true }));
    y += rowH; doc.moveTo(36, y - 3).lineTo(36 + width, y - 3).strokeColor('#999').stroke(); doc.font('Helvetica');
  };
  head();
  D.forEach((r) => {
    if (y + rowH > doc.page.height - 40) { doc.addPage(); y = 36; head(); }
    doc.font('Helvetica').fontSize(8);
    r.forEach((c, i) => doc.text(day(c), 36 + i * colW, y, { width: colW - 4, lineBreak: false, ellipsis: true }));
    y += rowH;
  });
  if (!D.length) doc.text('No records.', 36, y);
  doc.end();
}

// One-page document (receipt, payslip, report card). Built-in Latin font: use the browser print view for Urdu text.
export function sendDocPdf(res, { filename, info, title, pairs = [], table, notes = [] }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);
  if (info.logoPath) { try { doc.image(info.logoPath, 50, 45, { height: 44 }); doc.x = 50; doc.y = 100; } catch { /* unreadable logo: skip */ } }
  doc.font('Helvetica-Bold').fontSize(16).text(info.schoolName || 'School', 50);
  if (info.address) doc.font('Helvetica').fontSize(9).fillColor('#555').text(info.address);
  doc.moveDown(0.8).fillColor('#000').font('Helvetica-Bold').fontSize(13).text(title);
  doc.moveDown(0.5).font('Helvetica').fontSize(10);
  for (const [k, v] of pairs) {
    const y = doc.y;
    doc.fillColor('#666').text(k, 50, y, { width: 150 });
    doc.fillColor('#000').text(String(v ?? ''), 210, y, { width: 330 });
    doc.y = Math.max(doc.y, y + 14); doc.x = 50;
  }
  if (table) {
    doc.moveDown(0.8);
    const widths = table.widths || [250, 80, 80, 80];
    const row = (cells, bold) => {
      if (doc.y > 760) doc.addPage();
      const y = doc.y; let x = 50;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#000');
      cells.forEach((c, i) => { doc.text(String(c ?? ''), x, y, { width: widths[i] - 6, align: i === 0 ? 'left' : 'right', lineBreak: false, ellipsis: true }); x += widths[i]; });
      doc.y = y + 18; doc.x = 50;
    };
    row(table.head, true);
    doc.moveTo(50, doc.y - 3).lineTo(50 + widths.reduce((a, b) => a + b, 0), doc.y - 3).strokeColor('#999').stroke();
    table.rows.forEach((r) => row(r, false));
    if (table.foot) { doc.moveTo(50, doc.y - 3).lineTo(50 + widths.reduce((a, b) => a + b, 0), doc.y - 3).strokeColor('#999').stroke(); row(table.foot, true); }
  }
  doc.moveDown(0.8).font('Helvetica').fontSize(10).fillColor('#000');
  notes.forEach((n) => doc.text(n, 50));
  doc.end();
}
