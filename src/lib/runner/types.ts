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
  return /^API_/i.test(key);
}

export function statusLabel(s: RunStatus): string {
  const map: Record<RunStatus, string> = {
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
  "automatic marketplace publishing",
  "dijamin laku",
  "pasti laris",
];

export const STAGING_EMAIL = "bisnis@internal.local";