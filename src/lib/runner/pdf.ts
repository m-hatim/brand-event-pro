// src/lib/runner/pdf.ts
// Buyer-facing premium PDF generator. No seller/internal wording.
// Pure-ish: only uses jsPDF (browser). No secrets, no API.
import jsPDF from "jspdf";

export interface HandbookMeta {
  productName: string;
  niche: string;
  audience: string;
  license: string;
  version?: string;
  releaseDate?: string;
  language?: string; // "Indonesia" | "English" | "Bilingual"
}

// Words that must NEVER appear in any buyer-facing PDF text.
const FORBIDDEN_PDF_TERMS: RegExp[] = [
  /manual upload only/i,
  /seller review required/i,
  /premium product architecture v2/i,
  /marketplace draft/i,
  /seller toolkit/i,
  /upload checklist/i,
  /pricing heuristic/i,
  /\bmanifest\b/i,
  /approval enabled/i,
  /blocking errors/i,
  /PASS_FINAL/i,
  /insert content from/i,
  /06_QualityChecklist/i,
  /07_License_Disclaimer/i,
  /14_Cover_Generation_Brief/i,
  /15_Marketing_Video_CTA/i,
  /21_Marketplace_Upload_Asset_Kit/i,
  /QC_Scorecard\.md/i,
];

function scrubLine(line: string): string {
  let out = line;
  for (const rx of FORBIDDEN_PDF_TERMS) out = out.replace(rx, "");
  return out.replace(/\s{2,}/g, " ").replace(/^[\s•\-]+$/g, "").trimEnd();
}

function buyerFooterLabel(meta: HandbookMeta): string {
  return `${meta.productName} — Buyer Playbook`;
}

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "li"; text: string }
  | { type: "p"; text: string }
  | { type: "code"; text: string }
  | { type: "spacer" };

function parseMarkdownToBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = (md || "").split(/\r?\n/);
  let inCode = false;
  let codeBuf: string[] = [];
  for (const raw of lines) {
    const line = raw ?? "";
    if (/^```/.test(line.trim())) {
      if (inCode) {
        blocks.push({ type: "code", text: codeBuf.join("\n") });
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    const scrubbed = scrubLine(line);
    if (!scrubbed.trim()) {
      blocks.push({ type: "spacer" });
      continue;
    }
    if (/^#\s+/.test(scrubbed)) blocks.push({ type: "h1", text: scrubbed.replace(/^#\s+/, "") });
    else if (/^#{2,}\s+/.test(scrubbed)) blocks.push({ type: "h2", text: scrubbed.replace(/^#{2,}\s+/, "") });
    else if (/^[-*]\s+/.test(scrubbed)) blocks.push({ type: "li", text: scrubbed.replace(/^[-*]\s+/, "").replace(/^\[\s?\]\s*/, "") });
    else blocks.push({ type: "p", text: scrubbed.replace(/\*\*/g, "") });
  }
  if (inCode && codeBuf.length) blocks.push({ type: "code", text: codeBuf.join("\n") });
  return blocks;
}

export function generateProductHandbookPdf(markdown: string, meta: HandbookMeta): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const marginTop = 64;
  const marginBottom = 56;
  const contentW = pageW - marginX * 2;
  let y = marginTop;
  let pageNo = 1;
  const footer = buyerFooterLabel(meta);

  const drawFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(footer, marginX, pageH - 28);
    doc.text(`${pageNo}`, pageW - marginX, pageH - 28, { align: "right" });
    doc.setTextColor(0);
  };

  const newPage = () => {
    drawFooter();
    doc.addPage();
    pageNo += 1;
    y = marginTop;
  };

  const ensure = (needed: number) => {
    if (y + needed > pageH - marginBottom) newPage();
  };

  // ---------- Cover (buyer-safe) ----------
  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  const titleLines = doc.splitTextToSize(meta.productName, contentW);
  doc.text(titleLines, marginX, 220);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(200);
  doc.text("Buyer Playbook", marginX, 220 + titleLines.length * 30 + 18);
  doc.setFontSize(11);
  const sub = doc.splitTextToSize(meta.niche, contentW);
  doc.text(sub, marginX, 220 + titleLines.length * 30 + 42);
  doc.setFontSize(10);
  doc.setTextColor(170);
  const coverMeta = [
    `For: ${meta.audience}`,
    `License: ${meta.license}`,
    "Research and Decision-Support Toolkit",
    "Preliminary Due Diligence Support",
    `Version ${meta.version || "1.0"} • ${meta.releaseDate || new Date().toISOString().slice(0, 10)}`,
  ];
  doc.text(coverMeta, marginX, pageH - 140);
  doc.setTextColor(0);
  newPage();

  // ---------- Body ----------
  const blocks = parseMarkdownToBlocks(markdown);
  for (const b of blocks) {
    if (b.type === "spacer") { y += 6; continue; }
    if (b.type === "h1") {
      ensure(40);
      if (y > marginTop + 4) newPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(17, 24, 39);
      const lines = doc.splitTextToSize(b.text, contentW);
      doc.text(lines, marginX, y);
      y += lines.length * 22 + 8;
      doc.setDrawColor(220);
      doc.line(marginX, y, marginX + contentW, y);
      y += 14;
      doc.setTextColor(0);
    } else if (b.type === "h2") {
      ensure(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(31, 41, 55);
      const lines = doc.splitTextToSize(b.text, contentW);
      doc.text(lines, marginX, y);
      y += lines.length * 17 + 6;
      doc.setTextColor(0);
    } else if (b.type === "li") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      const lines = doc.splitTextToSize(b.text, contentW - 16);
      ensure(lines.length * 14 + 2);
      doc.text("•", marginX, y);
      doc.text(lines, marginX + 14, y);
      y += lines.length * 14 + 3;
    } else if (b.type === "code") {
      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(b.text, contentW - 16);
      ensure(lines.length * 12 + 12);
      doc.setFillColor(243, 244, 246);
      doc.rect(marginX, y - 10, contentW, lines.length * 12 + 14, "F");
      doc.setTextColor(55);
      doc.text(lines, marginX + 8, y);
      y += lines.length * 12 + 12;
      doc.setTextColor(0);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      const lines = doc.splitTextToSize(b.text, contentW);
      ensure(lines.length * 14 + 4);
      doc.text(lines, marginX, y);
      y += lines.length * 14 + 6;
    }
  }
  drawFooter();

  return doc.output("blob");
}
