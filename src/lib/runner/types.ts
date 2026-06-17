// Shared pure types/constants. No browser APIs. No server secrets. Safe everywhere.

export const STATUSES = [
  "DRAFT_INPUT",
  "BLOCKED_INPUT_MISSING",
  "ARCHITECTURE_PENDING",
  "ARCHITECTURE_READY",
  "ASSUMPTIONS_PENDING",
  "BLOCKED_CRITICAL_ASSUMPTION",
  "MANIFEST_PENDING",
  "MANIFEST_READY",
  "CHUNK_RUNNING",
  "CHUNK_VALIDATION_FAILED",
  "BLOCKED_CONDENSED_OUTPUT",
  "BLOCKED_GENERIC_OUTPUT",
  "BLOCKED_MARKETPLACE_BUNDLE_VALIDATION_FAILED",
  "CHECKSUM_PENDING",
  "QC_PENDING",
  "FILES_PARTIAL",
  "UPGRADE_IN_PROGRESS",
  "READY_FOR_SELLER_REVIEW",
  "APPROVAL_PENDING",
  "PASS_FINAL",
  "STOPPED",
] as const;
export type RunStatus = (typeof STATUSES)[number];

export const ADAPTERS = [
  { id: "TEXT_TO_IMAGE", label: "Prompt Gambar AI" },
  { id: "IMAGE_EDITING", label: "Prompt Edit Gambar" },
  { id: "TEXT_TO_VIDEO", label: "Prompt Video AI" },
  { id: "ACADEMIC_WRITING", label: "Prompt Penulisan Akademik" },
  { id: "RESEARCH", label: "Prompt Riset" },
  { id: "CONTENT_CREATION", label: "Prompt Konten" },
  { id: "BUSINESS_MARKETING", label: "Prompt Bisnis & Marketing" },
  { id: "CODING_AUTOMATION", label: "Prompt Coding & Automasi" },
  { id: "EVIDENCE_HANDBOOK", label: "Evidence-Based Handbook / Vault" },
  { id: "CUSTOM", label: "Custom / Lainnya" },
] as const;
export type AdapterId = (typeof ADAPTERS)[number]["id"];

export const MARKETPLACES = [
  "Shopee",
  "Tokopedia",
  "Lynk.id",
  "Gumroad",
  "Etsy",
  "Payhip",
  "Lemon Squeezy",
] as const;
export type Marketplace = (typeof MARKETPLACES)[number];

export const TONES = [
  "Friendly",
  "Professional",
  "Premium",
  "Simple",
  "Persuasive",
  "Gen Z Casual",
  "Custom",
] as const;

export const LANGUAGES = ["Indonesia", "English", "Bilingual"] as const;
export const TARGET_MARKETS = ["Indonesia", "Global", "Indonesia + Global"] as const;
export const PROMPT_COUNTS = [10, 15, 20, 30] as const;
export const LICENSES = ["Personal Use Only", "Personal & Commercial", "Extended License"] as const;

export type ModuleCategory = "core" | "marketplace" | "bundle" | "qc";

export interface ModuleDefinition {
  key: string;
  file: string;
  chunks: number;
  category: ModuleCategory;
  marketplace?: Marketplace;
}

export const REQUIRED_CORE_MODULES: ModuleDefinition[] = [
  { key: "01_Product_Brief", file: "01_Product_Brief.md", chunks: 1, category: "core" },
  { key: "02_PromptBook", file: "02_PromptBook.md", chunks: 1, category: "core" },
  { key: "03_PromptLibrary", file: "03_PromptLibrary.csv", chunks: 1, category: "core" },
  { key: "04_UsageGuide", file: "04_UsageGuide.md", chunks: 1, category: "core" },
  { key: "05_Sample_Input_Output", file: "05_Sample_Input_Output.md", chunks: 1, category: "core" },
  { key: "06_QualityChecklist", file: "06_QualityChecklist.md", chunks: 1, category: "core" },
  { key: "07_License_Disclaimer", file: "07_License_Disclaimer.md", chunks: 1, category: "core" },
  { key: "08_ManualUploadGuide", file: "08_ManualUploadGuide.md", chunks: 1, category: "core" },
  { key: "09_Buyer_FAQ", file: "09_Buyer_FAQ.md", chunks: 1, category: "core" },
  { key: "10_Pricing_Recommendation", file: "10_Pricing_Recommendation.md", chunks: 1, category: "core" },
  { key: "11_Thumbnail_Brief", file: "11_Thumbnail_Brief.md", chunks: 1, category: "core" },
  { key: "12_Product_Manifest", file: "12_Product_Manifest.json", chunks: 1, category: "core" },
  { key: "13_Ready_to_Upload_Checklist", file: "13_Ready_to_Upload_Checklist.md", chunks: 1, category: "core" },
  { key: "99_Assumption_Register", file: "99_Assumption_Register.md", chunks: 1, category: "core" },
  { key: "QC_Scorecard", file: "QC_Scorecard.md", chunks: 1, category: "qc" },
] as const as ModuleDefinition[];

export const REQUIRED_CORE_FILES = REQUIRED_CORE_MODULES.map((m) => m.file);
export const REQUIRED_CORE_KEYS = REQUIRED_CORE_MODULES.map((m) => m.key);

export const MARKETPLACE_MODULES: Record<Marketplace, ModuleDefinition> = {
  Shopee: { key: "16_Shopee_Product_Listing_ID", file: "16_Shopee_Product_Listing_ID.md", chunks: 1, category: "marketplace", marketplace: "Shopee" },
  Tokopedia: { key: "17_Tokopedia_Product_Listing_ID", file: "17_Tokopedia_Product_Listing_ID.md", chunks: 1, category: "marketplace", marketplace: "Tokopedia" },
  "Lynk.id": { key: "18_LynkID_Sales_Page_ID", file: "18_LynkID_Sales_Page_ID.md", chunks: 1, category: "marketplace", marketplace: "Lynk.id" },
  Gumroad: { key: "06_Gumroad_Listing", file: "06_Gumroad_Listing.md", chunks: 1, category: "marketplace", marketplace: "Gumroad" },
  Etsy: { key: "07_Etsy_Listing", file: "07_Etsy_Listing.md", chunks: 1, category: "marketplace", marketplace: "Etsy" },
  Payhip: { key: "08_Payhip_Listing", file: "08_Payhip_Listing.md", chunks: 1, category: "marketplace", marketplace: "Payhip" },
  "Lemon Squeezy": { key: "09_LemonSqueezy_Listing", file: "09_LemonSqueezy_Listing.md", chunks: 1, category: "marketplace", marketplace: "Lemon Squeezy" },
};

export const MARKETPLACE_BUNDLE_MODULE: ModuleDefinition = {
  key: "19_Marketplace_Bundle_Index",
  file: "19_Marketplace_Bundle_Index.md",
  chunks: 1,
  category: "bundle",
};

export const QC_THRESHOLDS = {
  MIN_SELL_READY: 85,
  PREMIUM_MIN: 95,
} as const;

export type QCSellReadyStatus = "NOT_SELL_READY" | "SELL_READY_STARTER_BETA" | "SELL_READY_PREMIUM_DRAFT";

export const QC_CHECK_IDS = {
  ALL_CORE_FILES_EXIST: "all_core_files_exist",
  SELECTED_MARKETPLACE_FILES_EXIST: "selected_marketplace_files_exist",
  NO_UNSELECTED_MARKETPLACE_FILES: "no_unselected_marketplace_files",
  NO_API_MODULES: "no_api_modules",
  NO_PLACEHOLDER_TEXT: "no_placeholder_text",
  NO_FORBIDDEN_CLAIMS: "no_forbidden_claims",
  PROMPT_COUNT_MATCHES: "prompt_count_matches",
  CSV_ROW_COUNT_MATCHES: "csv_row_count_matches",
  UNIQUE_PROMPT_BODIES: "unique_prompt_bodies",
  SAMPLE_IO_EXISTS: "sample_io_exists",
  LICENSE_EXISTS: "license_exists",
  PRICING_MARKED_HEURISTIC: "pricing_marked_heuristic",
  MARKETPLACE_FAQ_AND_DELIVERY: "marketplace_faq_and_delivery",
  MANIFEST_JSON_VALID: "manifest_json_valid",
  ASSUMPTION_REGISTER_EXISTS: "assumption_register_exists",
  QC_SCORECARD_EXISTS: "qc_scorecard_exists",
  MANUAL_UPLOAD_DISCLAIMER: "manual_upload_disclaimer",
  ANCHOR_REFLECTION: "anchor_reflection",
} as const;
export type QCCheckId = (typeof QC_CHECK_IDS)[keyof typeof QC_CHECK_IDS];

export interface QCCheckItem {
  id: QCCheckId | string;
  name: string;
  status: "PASS" | "FAIL" | "WARNING";
  weight: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface QCResult {
  score: number;
  status: QCSellReadyStatus;
  blocking_errors: number;
  errors: string[];
  warnings: string[];
  checks: QCCheckItem[];
  approval_enabled: boolean;
  generated_at: string;
}

export interface ProductManifestPayload {
  mode: "MANUAL_UPLOAD_ONLY";
  api_disabled: true;
  no_api_modules: true;
  product_id: string;
  name: string;
  version: string;
  release_date: string;
  adapter: string;
  language: string;
  niche: string;
  license: string;
  marketplaces: string[];
  prompt_count: number;
  files: {
    core: string[];
    marketplace: string[];
  };
  expected_modules: ModuleDefinition[];
  expected_chunks: number;
  qc_status: QCSellReadyStatus;
  manual_upload_only: boolean;
  api_mode_enabled: boolean;
}

// Forbidden modules — must never appear in any manifest/chunk/file/qc/marketplace bundle
// when generation_mode = MANUAL_UPLOAD_ONLY (the only supported mode right now).
export const FORBIDDEN_API_MODULES = [
  "API_SHOPEE",
  "API_TOKOPEDIA",
  "API_LYNK_ID",
  "API_GUMROAD",
  "API_ETSY",
  "API_PAYHIP",
  "API_LEMON_SQUEEZY",
] as const;

export function isForbiddenModuleKey(key: string): boolean {
  return /^API_/i.test(key) || FORBIDDEN_API_MODULES.some((m) => m.toLowerCase() === key.toLowerCase());
}

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT_INPUT: "Draft input",
    BLOCKED_INPUT_MISSING: "Input belum lengkap",
    ARCHITECTURE_PENDING: "Arsitektur menunggu",
    ARCHITECTURE_READY: "Arsitektur siap",
    ASSUMPTIONS_PENDING: "Asumsi menunggu",
    BLOCKED_CRITICAL_ASSUMPTION: "Asumsi kritis belum dikonfirmasi",
    MANIFEST_PENDING: "Manifest menunggu",
    MANIFEST_READY: "Manifest siap",
    CHUNK_RUNNING: "Sedang generate file",
    CHUNK_VALIDATION_FAILED: "Validasi gagal",
    BLOCKED_CONDENSED_OUTPUT: "Output terlalu ringkas",
    BLOCKED_GENERIC_OUTPUT: "Output terlalu umum",
    BLOCKED_MARKETPLACE_BUNDLE_VALIDATION_FAILED: "Validasi bundle gagal",
    CHECKSUM_PENDING: "Checksum menunggu",
    QC_PENDING: "QC sedang berjalan",
    FILES_PARTIAL: "File belum lengkap",
    UPGRADE_IN_PROGRESS: "Upgrade package berjalan",
    READY_FOR_SELLER_REVIEW: "Siap untuk review seller",
    APPROVAL_PENDING: "Menunggu persetujuan",
    PASS_FINAL: "Disetujui (PASS_FINAL)",
    STOPPED: "Dihentikan",
  };
  return map[s] ?? s;
}

export const CHUNK_STATUS_LABEL: Record<string, string> = {
  pending: "Belum dibuat",
  running: "Sedang dibuat",
  ready_for_ack: "Aman",
  acked: "Selesai",
  failed: "Perlu diperbaiki",
};

export interface ArchitecturePayload {
  product_positioning: string;
  target_audience_fit: string;
  weakness_detection: string;
  prompt_architecture_overview: string;
  marketplace_preview: string;
  qc_readiness: string;
}

export const FORBIDDEN_CLAIMS = [
  "guaranteed sales",
  "guaranteed income",
  "proven conversion",
  "official marketplace partner",
  "marketplace-approved",
  "marketplace-approved product",
  "automatic marketplace publishing",
  "auto-publish",
  "uploads automatically to marketplace",
  "fake testimonials",
  "fake market validation",
  "fake citations",
  "fake DOI",
  "dijamin laku",
  "pasti laris",
  "pasti closing",
];

export const PLACEHOLDER_PATTERNS = [
  /Konten otomatis untuk modul/i,
  /Lorem ipsum/i,
  /\[TODO\]/i,
  /\[FILL\]/i,
  /<placeholder>/i,
  /continues\.\.\./i,
  /repeat for remaining prompts/i,
  /same as above/i,
  /see above/i,
  /due to response length limits/i,
];

export const STAGING_EMAIL = "bisnis@internal.local";
