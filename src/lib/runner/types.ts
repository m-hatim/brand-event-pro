// Client-side ZIP assembly for Premium Product Architecture v2 export modes.
// Uses JSZip. Three modes: buyer, seller toolkit, full system.
// Buyer ZIP NEVER includes seller-only files. No server, no secrets.
import JSZip from "jszip";
import {
  FINAL_BUYER_MODULES,
  IGNORED_LEGACY_MODULES,
  SELLER_TOOLKIT_FILE,
  ADMIN_MODULES,
} from "./types";
import { generateProductHandbookPdf, HandbookMeta } from "./pdf";

export type ExportMode = "buyer" | "seller" | "full";

export interface ModuleLike {
  file_name: string;
  module_key: string;
  content: string | null;
}

export interface BuildExportInput {
  modules: ModuleLike[];
  meta: HandbookMeta;
  pdfMarkdownFallback?: string;
}

function findContent(modules: ModuleLike[], file: string): string {
  const m = modules.find((x) => x.file_name === file);
  return m?.content ?? "";
}

function buildPdfBlob(modules: ModuleLike[], meta: HandbookMeta, fallbackMd?: string): Blob {
  const md = findContent(modules, "20_Complete_PDF_Product_Draft.md") || fallbackMd || `# ${meta.productName}\n\n${meta.niche}\n`;
  return generateProductHandbookPdf(md, meta);
}

export async function buildBuyerZip(input: BuildExportInput): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder("premium-product-system_v1.0")!;
  const buyer = root.folder("BUYER_PACKAGE")!;
  for (const file of FINAL_BUYER_MODULES) {
    const c = findContent(input.modules, file);
    if (c) buyer.file(file, c);
  }
  // PDF
  const pdfBlob = buildPdfBlob(input.modules, input.meta);
  buyer.file("Product_Handbook.pdf", pdfBlob);
  return zip.generateAsync({ type: "blob" });
}

export async function buildSellerZip(input: BuildExportInput): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder("premium-product-system_v1.0")!;
  const seller = root.folder("SELLER_TOOLKIT")!;
  const admin = root.folder("ADMIN_MANIFEST")!;
  const sellerContent = findContent(input.modules, SELLER_TOOLKIT_FILE);
  if (sellerContent) seller.file(SELLER_TOOLKIT_FILE, sellerContent);
  for (const file of ADMIN_MODULES) {
    const c = findContent(input.modules, file);
    if (c) admin.file(file, c);
  }
  return zip.generateAsync({ type: "blob" });
}

export async function buildFullSystemZip(input: BuildExportInput): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder("premium-product-system_v1.0")!;
  const buyer = root.folder("BUYER_PACKAGE")!;
  const seller = root.folder("SELLER_TOOLKIT")!;
  const admin = root.folder("ADMIN_MANIFEST")!;
  for (const file of FINAL_BUYER_MODULES) {
    const c = findContent(input.modules, file);
    if (c) buyer.file(file, c);
  }
  buyer.file("Product_Handbook.pdf", buildPdfBlob(input.modules, input.meta));
  const sellerContent = findContent(input.modules, SELLER_TOOLKIT_FILE);
  if (sellerContent) seller.file(SELLER_TOOLKIT_FILE, sellerContent);
  for (const file of ADMIN_MODULES) {
    const c = findContent(input.modules, file);
    if (c) admin.file(file, c);
  }
  return zip.generateAsync({ type: "blob" });
}

export function buyerPackageIsClean(modules: ModuleLike[]): { ok: boolean; leaks: string[] } {
  const buyerSet = new Set<string>(FINAL_BUYER_MODULES as readonly string[]);
  const leakagePatterns = [/seller toolkit/i, /pricing heuristic/i, /thumbnail brief/i, /cover generation/i, /upload manual/i, /marketplace draft/i, /approval enabled/i, /blocking errors/i, /06_QualityChecklist/i, /07_License_Disclaimer/i, /13_Ready_to_Upload_Checklist/i, /14_Cover_Generation_Brief/i, /15_Marketing_Video_CTA/i, /21_Marketplace_Upload_Asset_Kit/i, /Insert content from/i];
  const leaks = modules.filter((m) => buyerSet.has(m.file_name)).filter((m) => leakagePatterns.some((rx) => rx.test(m.content || ""))).map((m) => m.file_name);
  return { ok: leaks.length === 0, leaks };
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
