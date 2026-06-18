// Client-side ZIP assembly for Premium Product Architecture v2 export modes.
// Uses JSZip. Three modes: buyer, seller toolkit, full system.
// Buyer ZIP NEVER includes seller-only files. No server, no secrets.
import JSZip from "jszip";
import {
  FINAL_BUYER_MODULES,
  FINAL_BUYER_FILES,
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
  const legacyNameLeaks = modules
    .map((m) => m.file_name)
    .filter((f) => IGNORED_LEGACY_MODULES.includes(f as any) || (!buyerSet.has(f) && (FINAL_BUYER_FILES as readonly string[]).includes(f)));
  const sellerLeakTerms = [
    "seller toolkit", "pricing heuristic", "marketplace draft", "upload checklist", "manual upload guide",
    "thumbnail brief", "cover generation brief", "marketing video script", "product manifest", "assumption register",
    "PASS_FINAL", "blocking errors",
  ];
  const contentLeaks = modules
    .filter((m) => buyerSet.has(m.file_name))
    .filter((m) => sellerLeakTerms.some((term) => new RegExp(term, "i").test(m.content || "")))
    .map((m) => `${m.file_name}: seller/admin leakage`);
  const leaks = [...legacyNameLeaks, ...contentLeaks];
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
