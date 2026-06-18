// Client-side premium handbook PDF generator (jsPDF).
// Renders markdown source (20_Complete_PDF_Product_Draft.md) into a styled
// multi-page PDF: cover, H1 page breaks, body, footer page numbers.
// No server, no secrets, no marketplace API.
import jsPDF from "jspdf";

export interface HandbookMeta {
  productName: string;
  niche: string;
  audience: string;
  license: string;
  version?: string;
  releaseDate?: string;
}

const MARGIN_X = 56; // pt
const TOP_Y = 64;
const BOTTOM_Y = 760;
const LINE_BODY = 16;
const LINE_H1 = 28;
const LINE_H2 = 22;
const LINE_H3 = 18;

function splitMarkdownIntoBlocks(md: string): Array<{ type: "h1" | "h2" | "h3" | "li" | "p" | "blank"; text: string }> {
  const out: Array<{ type: "h1" | "h2" | "h3" | "li" | "p" | "blank"; text: string }> = [];
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { out.push({ type: "blank", text: "" }); continue; }
    if (/^#\s+/.test(line)) { out.push({ type: "h1", text: line.replace(/^#\s+/, "") }); continue; }
    if (/^##\s+/.test(line)) { out.push({ type: "h2", text: line.replace(/^##\s+/, "") }); continue; }
    if (/^###\s+/.test(line)) { out.push({ type: "h3", text: line.replace(/^###\s+/, "") }); continue; }
    if (/^[-*]\s+/.test(line)) { out.push({ type: "li", text: line.replace(/^[-*]\s+/, "") }); continue; }
    out.push({ type: "p", text: line });
  }
  return out;
}

export function generateProductHandbookPdf(markdown: string, meta: HandbookMeta): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usableW = pageW - MARGIN_X * 2;

  // --- Cover page ---
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text(meta.productName || "Premium Product Handbook", MARGIN_X, 220, { maxWidth: usableW });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.text(meta.niche || "", MARGIN_X, 280, { maxWidth: usableW });
  doc.setFontSize(12);
  doc.text(`For: ${meta.audience || ""}`, MARGIN_X, 320, { maxWidth: usableW });
  doc.text(`License: ${meta.license || "Personal & Commercial"}`, MARGIN_X, 340);
  doc.text(`Version: ${meta.version || "1.0"}  •  ${meta.releaseDate || new Date().toISOString().slice(0, 10)}`, MARGIN_X, 360);
  doc.setFontSize(10);
  doc.setTextColor(180, 200, 230);
  doc.text("Manual Upload Only  •  Seller Review Required  •  Premium Product Architecture v2", MARGIN_X, pageH - 60);

  // --- Body ---
  doc.addPage();
  doc.setTextColor(20, 20, 20);
  let y = TOP_Y;
  let pageNum = 2;

  const ensureSpace = (need: number) => {
    if (y + need > BOTTOM_Y) { doc.addPage(); y = TOP_Y; pageNum += 1; }
  };

  const blocks = splitMarkdownIntoBlocks(markdown);
  for (const b of blocks) {
    if (b.type === "h1") {
      // New page per H1 (except the very first H1 right after cover)
      if (y > TOP_Y) { doc.addPage(); y = TOP_Y; pageNum += 1; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      const lines = doc.splitTextToSize(b.text, usableW);
      doc.text(lines, MARGIN_X, y);
      y += LINE_H1 * lines.length;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(1.5);
      doc.line(MARGIN_X, y - 8, MARGIN_X + 80, y - 8);
      y += 12;
    } else if (b.type === "h2") {
      ensureSpace(LINE_H2 + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      const lines = doc.splitTextToSize(b.text, usableW);
      doc.text(lines, MARGIN_X, y);
      y += LINE_H2 * lines.length + 4;
    } else if (b.type === "h3") {
      ensureSpace(LINE_H3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const lines = doc.splitTextToSize(b.text, usableW);
      doc.text(lines, MARGIN_X, y);
      y += LINE_H3 * lines.length + 2;
    } else if (b.type === "li") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(`• ${b.text}`, usableW - 12);
      ensureSpace(LINE_BODY * lines.length);
      doc.text(lines, MARGIN_X + 12, y);
      y += LINE_BODY * lines.length;
    } else if (b.type === "p") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(b.text, usableW);
      ensureSpace(LINE_BODY * lines.length);
      doc.text(lines, MARGIN_X, y);
      y += LINE_BODY * lines.length;
    } else {
      y += 8;
    }
  }

  // --- Footer page numbers on every page except cover ---
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`${meta.productName} — Premium Product Handbook`, MARGIN_X, pageH - 28);
    doc.text(`${p - 1} / ${total - 1}`, pageW - MARGIN_X, pageH - 28, { align: "right" });
  }

  return doc.output("blob");
}