// Deterministic mock engine. Pure functions only. Browser-safe.
// No real AI provider. No marketplace API. No secrets.
import {
  ArchitecturePayload,
  FORBIDDEN_CLAIMS,
  Marketplace,
  isForbiddenModuleKey,
} from "./types";

export function correctDescription(input: string): string {
  let t = (input ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  // Strip forbidden claims
  for (const f of FORBIDDEN_CLAIMS) {
    t = t.replace(new RegExp(f, "ig"), "berpotensi membantu");
  }
  // Capitalize sentences
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase());
  // Trim doubled punctuation
  t = t.replace(/([.!?]){2,}/g, "$1");
  // Ensure terminal punctuation
  if (!/[.!?]$/.test(t)) t += ".";
  // Append seller-safe closer when description is short
  if (t.length < 280) {
    t += " Cocok untuk seller yang ingin deskripsi produk yang rapi, jelas, dan siap dipakai untuk marketplace atau media sosial.";
  }
  return t;
}

export function generateKeyAnchors(args: {
  niche?: string;
  audience?: string;
  confirmedDescription?: string;
  marketplaces?: string[];
  tone?: string;
  adapter?: string;
}): string[] {
  const anchors = new Set<string>();
  const niche = (args.niche ?? "").toLowerCase().trim();
  const audience = (args.audience ?? "").toLowerCase().trim();
  if (niche) anchors.add(niche.split(/[,.;]/)[0].slice(0, 80));
  if (audience) {
    const first = audience.split(/[,.;]/)[0].trim();
    if (first) anchors.add(`untuk ${first}`);
  }
  anchors.add("deskripsi produk rapi");
  anchors.add("copywriting marketplace");
  anchors.add("deskripsi mentah menjadi menarik");
  anchors.add("UMKM dan seller online");
  anchors.add("bahasa jelas dan mudah dipahami");
  if (args.marketplaces?.length) {
    anchors.add(`siap dipakai untuk ${args.marketplaces.slice(0, 3).join("/")}`);
  } else {
    anchors.add("siap dipakai untuk Shopee/Tokopedia/media sosial");
  }
  if (args.tone) anchors.add(`gaya bahasa ${args.tone.toLowerCase()}`);
  return Array.from(anchors).slice(0, 8);
}

export function generateArchitecture(input: {
  brand?: string;
  niche?: string;
  audience?: string;
  confirmedDescription?: string;
  marketplaces?: string[];
  adapter?: string;
  promptCount?: number;
  tone?: string;
}): ArchitecturePayload {
  const brand = input.brand || "Brand Anda";
  const niche = input.niche || "produk prompt";
  const audience = input.audience || "UMKM dan seller online";
  const mps = (input.marketplaces?.length ? input.marketplaces : ["Shopee", "Tokopedia"]).join(", ");
  return {
    product_positioning: `${brand} memposisikan paket prompt untuk niche "${niche}" dengan tone ${input.tone || "Friendly"}. Fokus pada manfaat praktis dan hasil yang siap pakai oleh seller.`,
    target_audience_fit: `Audiens utama: ${audience}. Materi disusun agar mudah dipahami non-teknis dan langsung bisa diterapkan pada listing marketplace.`,
    weakness_detection: `Deskripsi awal perlu penegasan diferensiasi dari kompetitor dan contoh penggunaan konkret. Klaim sales/penghasilan tidak digunakan (kebijakan internal).`,
    prompt_architecture_overview: `Struktur paket: pengantar, panduan penggunaan, ${input.promptCount ?? 10} prompt utama, variasi tone, CSV index, dan panduan publish manual.`,
    marketplace_preview: `Marketplace target (manual upload): ${mps}. Setiap marketplace mendapat draft listing terpisah dengan judul, deskripsi, dan tag yang seller-safe.`,
    qc_readiness: `Kesiapan QC: cek jumlah prompt, cek CSV row count, cek anchor reflection, scan klaim terlarang, dan cek modul forbidden (API_*).`,
  };
}

export function seedAssumptions(adapter: string) {
  return [
    {
      text: "Target marketplace utama dapat menerima listing prompt-product dalam format teks panjang dengan tag (asumsi normal).",
      type: "normal",
      impact: "low",
    },
    {
      text: "Audiens memahami istilah dasar 'prompt' dan dapat menggunakan output di tools AI generatif populer.",
      type: "normal",
      impact: "medium",
    },
    {
      text: `Adapter "${adapter}" sesuai dengan jenis prompt yang akan diproduksi. Jika tidak, output bisa meleset.`,
      type: "critical",
      impact: "high",
    },
  ];
}

export const CORE_MODULES = [
  { key: "01_README", file: "01_README.md", chunks: 2 },
  { key: "02_PromptBook", file: "02_PromptBook.md", chunks: 5 },
  { key: "03_PromptIndex", file: "03_PromptIndex.csv", chunks: 1 },
  { key: "04_UsageGuide", file: "04_UsageGuide.md", chunks: 2 },
  { key: "05_QualityChecklist", file: "05_QualityChecklist.md", chunks: 1 },
  { key: "06_ManualUploadGuide", file: "06_ManualUploadGuide.md", chunks: 2 },
];

export function marketplaceModulesFor(marketplaces: string[]) {
  return marketplaces
    .map((m) => ({
      key: `MARKETPLACE_${m.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_LISTING`,
      file: `10_Listing_${m.replace(/[^A-Za-z0-9]+/g, "")}.md`,
      chunks: 2,
      marketplace: m,
    }))
    .filter((m) => !isForbiddenModuleKey(m.key));
}

export function buildManifestPayload(input: {
  adapter: string;
  marketplaces: string[];
  promptCount: number;
}) {
  const core = CORE_MODULES.map((m) => ({ ...m }));
  const mp = marketplaceModulesFor(input.marketplaces);
  const bundleIndex = {
    key: "11_BundleIndex",
    file: "11_BundleIndex.md",
    chunks: 1,
  };
  const modules = [...core, ...mp, bundleIndex].filter(
    (m) => !isForbiddenModuleKey(m.key)
  );
  return {
    mode: "MANUAL_UPLOAD_ONLY",
    api_disabled: true,
    no_api_modules: true,
    adapter: input.adapter,
    marketplaces: input.marketplaces,
    prompt_count: input.promptCount,
    expected_modules: modules,
    expected_chunks: modules.reduce((a, m) => a + m.chunks, 0),
  };
}

export function generateModuleContent(args: {
  moduleKey: string;
  fileName: string;
  seller: { brand?: string; niche?: string; audience?: string; promptCount?: number; tone?: string; confirmedDescription?: string };
  marketplaces: string[];
}): { content: string; validation: "PASS" | "FAIL" } {
  if (isForbiddenModuleKey(args.moduleKey)) {
    return { content: "", validation: "FAIL" };
  }
  const { brand = "Brand Anda", niche = "prompt", audience = "seller", promptCount = 10, tone = "Friendly", confirmedDescription = "" } = args.seller;

  if (args.moduleKey === "03_PromptIndex") {
    const rows = ["no,judul,kategori,tone"];
    for (let i = 1; i <= promptCount; i++) {
      rows.push(`${i},"Prompt ${i} — ${niche}","${args.moduleKey}","${tone}"`);
    }
    return { content: rows.join("\n"), validation: "PASS" };
  }
  if (args.moduleKey === "02_PromptBook") {
    const lines = [`# ${args.fileName}`, "", `Brand: ${brand}`, `Audiens: ${audience}`, `Tone: ${tone}`, ""];
    for (let i = 1; i <= promptCount; i++) {
      lines.push(`## Prompt ${i}`);
      lines.push(`Konteks: ${niche}`);
      lines.push(`Tugas: bantu seller menyusun deskripsi produk yang rapi, jelas, dan siap dipakai untuk marketplace atau media sosial.`);
      lines.push("");
    }
    return { content: lines.join("\n"), validation: "PASS" };
  }
  if (args.moduleKey.startsWith("MARKETPLACE_")) {
    const mp = args.moduleKey.replace(/^MARKETPLACE_/, "").replace(/_LISTING$/, "");
    const c = [
      `# Listing Draft — ${mp}`,
      "",
      `**Manual upload only.** Upload ke ${mp} secara manual setelah review seller.`,
      "",
      `## Judul`,
      `${brand} — Paket Prompt ${niche} (${promptCount} prompt)`,
      "",
      `## Deskripsi`,
      confirmedDescription || "Paket prompt siap pakai.",
      "",
      `## Tag`,
      `#prompt #${niche.split(" ").join("")} #seller #umkm`,
    ].join("\n");
    return { content: c, validation: "PASS" };
  }
  return {
    content: `# ${args.fileName}\n\nKonten otomatis untuk modul ${args.moduleKey}.\n\nBrand: ${brand}\nNiche: ${niche}\nAudiens: ${audience}\nTone: ${tone}\nJumlah prompt: ${promptCount}\n\nManual upload only. Seller review required.`,
    validation: "PASS",
  };
}

export function runQC(args: {
  promptCount: number;
  modules: { module_key: string; file_name: string; content: string | null; status: string; validation: string }[];
  anchors: string[];
  confirmedDescription: string;
}) {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Completeness
  const incomplete = args.modules.filter((m) => m.status !== "acked");
  if (incomplete.length) errors.push(`${incomplete.length} modul belum selesai.`);

  // Prompt count vs PromptBook
  const promptBook = args.modules.find((m) => m.module_key === "02_PromptBook");
  if (promptBook?.content) {
    const hits = (promptBook.content.match(/## Prompt \d+/g) || []).length;
    if (hits !== args.promptCount) {
      errors.push(`Jumlah prompt di PromptBook (${hits}) tidak cocok dengan input (${args.promptCount}).`);
    }
  }

  // CSV row count
  const csv = args.modules.find((m) => m.module_key === "03_PromptIndex");
  if (csv?.content) {
    const rows = csv.content.trim().split(/\n/).length - 1; // minus header
    if (rows !== args.promptCount) {
      errors.push(`Jumlah baris CSV (${rows}) tidak cocok dengan jumlah prompt (${args.promptCount}).`);
    }
  }

  // No forbidden modules
  const forbidden = args.modules.filter((m) => isForbiddenModuleKey(m.module_key));
  if (forbidden.length) errors.push(`Ditemukan modul API_* (${forbidden.length}). Tidak diizinkan di mode MANUAL_UPLOAD_ONLY.`);

  // Forbidden claims scan
  for (const m of args.modules) {
    if (!m.content) continue;
    for (const f of FORBIDDEN_CLAIMS) {
      if (new RegExp(f, "i").test(m.content)) {
        warnings.push(`Klaim terlarang "${f}" terdeteksi di ${m.file_name}.`);
      }
    }
  }

  // Anchor reflection
  const allText = args.modules.map((m) => m.content || "").join(" ").toLowerCase();
  const reflected = args.anchors.filter((a) => allText.includes(a.toLowerCase().split(" ")[0])).length;
  if (args.anchors.length && reflected < Math.min(3, args.anchors.length)) {
    warnings.push(`Hanya ${reflected} dari ${args.anchors.length} anchor terdeteksi di konten.`);
  }

  return {
    blocking_errors: errors.length,
    errors,
    warnings,
    checks: {
      completeness: incomplete.length === 0,
      prompt_count_match: !!promptBook,
      csv_row_count_match: !!csv,
      no_forbidden_modules: forbidden.length === 0,
      forbidden_claims: warnings.filter((w) => w.startsWith("Klaim")).length === 0,
      anchor_reflection: reflected,
    },
  };
}

export function generateRunRequestId(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RUN-${stamp}-${rand}`;
}

// Helper: filter selected marketplaces against forbidden API list (no-op, names are display names)
export function safeMarketplaces(mps: Marketplace[] | string[]): string[] {
  return mps.filter((m) => !isForbiddenModuleKey(String(m)));
}