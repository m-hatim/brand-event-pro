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

// ✅ FORBIDDEN_PDF_TERMS — Hardened buyer PDF guard
export const FORBIDDEN_PDF_TERMS: RegExp[] = [
  /manual upload only/i,
  /seller review required/i,
  /seller-reviewed/i,
  /premium product architecture v2/i,
  /PREMIUM_PRODUCT_ARCHITECTURE_V2/g,
  /marketplace draft/i,
  /seller toolkit/i,
  /seller master toolkit/i,
  /upload checklist/i,
  /pricing heuristic/i,
  /pricing recommendation/i,
  /thumbnail brief/i,
  /cover generation brief/i,
  /cover generation/i,
  /approval enabled/i,
  /blocking[_ ]errors/i,
  /PASS_FINAL/g,
  /insert content from/i,
  /06_QualityChecklist/gi,
  /07_License_Disclaimer/gi,
  /08_ManualUploadGuide/gi,
  /10_Pricing_Recommendation/gi,
  /11_Thumbnail_Brief/gi,
  /13_Ready_to_Upload_Checklist/gi,
  /14_Cover_Generation_Brief/gi,
  /15_Marketing_Video_CTA/gi,
  /21_Marketplace_Upload_Asset_Kit/gi,
  /99_Assumption_Register/gi,
  /QC_Scorecard\.md/gi,
  /00_Seller_Master_Toolkit/gi,
  /12_Product_Manifest/gi,
  /diunggah manual oleh seller/i,
  /draft ini harus direview/i,
  /tidak ada api marketplace/i,
  /no marketplace api/i,
  /no auto-publish/i,
  /seller wajib/i,
  /upload manual saja/i,
];

// ✅ scrubLine — Double-pass (defensive)
function scrubLine(line: string): string {
  let out = line || "";
  // PASS 1 — Replace forbidden terms
  for (const rx of FORBIDDEN_PDF_TERMS) {
    rx.lastIndex = 0;
    out = out.replace(rx, "");
  }
  // PASS 2 — Second pass (extra safety)
  for (const rx of FORBIDDEN_PDF_TERMS) {
    rx.lastIndex = 0;
    out = out.replace(rx, "");
  }
  // Cleanup whitespace dan bullet remnants
  return out.replace(/\s{2,}/g, " ").replace(/^[\[\s•\-–—]+$/g, "").trimEnd();
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

function parseMarkdownToBlocks(markdown: string): Block[] {
  const lines = (markdown || "").split(/\r?\n/);
  const blocks: Block[] = [];
  let inCodeBlock = false;
  let codeBuffer = "";

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({ type: "code", text: codeBuffer.trim() });
        codeBuffer = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer += line + "\n";
      continue;
    }

    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      blocks.push({ type: "h1", text: scrubLine(trimmed.slice(2).trim()) });
    } else if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: scrubLine(trimmed.slice(3).trim()) });
    } else if (trimmed.match(/^[-*•]\s+/)) {
      blocks.push({ type: "li", text: scrubLine(trimmed.replace(/^[-*•]\s+/, "")) });
    } else if (trimmed.length > 0) {
      blocks.push({ type: "p", text: scrubLine(trimmed) });
    } else if (blocks.length > 0 && blocks[blocks.length - 1].type !== "spacer") {
      blocks.push({ type: "spacer" });
    }
  }

  return blocks;
}

// ✅ generateProductHandbookPdf — Buyer-safe PDF generator
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

  // ---------- Content pages ----------
  const blocks = parseMarkdownToBlocks(markdown);

  for (const b of blocks) {
    if (b.type === "spacer") {
      y += 6;
    } else if (b.type === "h1") {
      ensure(32);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(17, 24, 39);
      const lines = doc.splitTextToSize(b.text, contentW);
      doc.text(lines, marginX, y);
      y += lines.length * 20 + 12;
      doc.setTextColor(0);
    } else if (b.type === "h2") {
      ensure(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(55, 65, 81);
      const lines = doc.splitTextToSize(b.text, contentW);
      doc.text(lines, marginX, y);
      y += lines.length * 14 + 6;
      doc.setTextColor(0);
    } else if (b.type === "li") {
      ensure(16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      const lines = doc.splitTextToSize(b.text, contentW - 16);
      doc.text("•", marginX, y);
      doc.text(lines, marginX + 12, y);
      y += lines.length * 14 + 3;
    } else if (b.type === "code") {
      ensure(24);
      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(b.text, contentW - 16);
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

// ✅ Helper untuk verify PDF aman dari leakage (dipanggil sebelum export)
export function verifyPdfSourceClean(pdfSourceMd: string): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const rx of FORBIDDEN_PDF_TERMS) {
    rx.lastIndex = 0;
    if (rx.test(pdfSourceMd)) {
      violations.push(rx.source);
    }
  }
  return { ok: violations.length === 0, violations };
}
