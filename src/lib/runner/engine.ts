// Deterministic mock engine v3.4.9 — canonical local robustness patch.
// Adapter-specific PromptBook/Sample/Listing + QC/Manifest sync.
// Pure functions only. Browser-safe. No real AI, no marketplace API, no secrets.
// Pure functions only. Browser-safe. No real AI, no marketplace API, no secrets.
import {
  ArchitecturePayload,
  FORBIDDEN_CLAIMS,
  MARKETPLACE_BUNDLE_MODULE,
  MARKETPLACE_MODULES,
  MARKETPLACES,
  ModuleDefinition,
  PLACEHOLDER_PATTERNS,
  ProductManifestPayload,
  QC_CHECK_IDS,
  QC_THRESHOLDS,
  QCCheckItem,
  QCResult,
  REQUIRED_CORE_MODULES,
  FINAL_BUYER_MODULES,
  ADMIN_MODULES,
  IGNORED_LEGACY_MODULES,
  PPA_V2_VERSION,
  isForbiddenModuleKey,
  normalizeMarketplace,
  SELLER_TOOLKIT_FILE,
} from "./types";

export const CORE_MODULES = [
  ...FINAL_BUYER_MODULES.map((file) => ({ key: file.replace(/\.[^.]+$/, ""), file, chunks: 1, category: file === "QC_Scorecard.md" ? "qc" : "core" as const })),
  { key: "00_Seller_Master_Toolkit", file: SELLER_TOOLKIT_FILE, chunks: 1, category: "core" as const },
  ...ADMIN_MODULES.map((file) => ({ key: file.replace(/\.[^.]+$/, ""), file, chunks: 1, category: "core" as const })),
];

// ---------- Typo normalization ----------
const TYPO_MAP: Array<[RegExp, string]> = [
  [/\badvnced\b/gi, "advanced"],
  [/\bfullsatck\b/gi, "fullstack"],
  [/\bautomtion\b/gi, "automation"],
  [/\bdeksripsi\b/gi, "deskripsi"],
  [/\bdi lengkapi\b/gi, "dilengkapi"],
  [/\bpemulla\b/gi, "pemula"],
  [/\bbeginer\b/gi, "beginner"],
  [/\bproffesional\b/gi, "professional"],
  [/\blynkid\b/gi, "Lynk.id"],
];

export function normalizeText(input: string): string {
  let text = (input ?? "").toString();
  for (const [regex, replacement] of TYPO_MAP) text = text.replace(regex, replacement);
  return text.replace(/\s+/g, " ").trim();
}

export function titleCaseSoft(input: string): string {
  return normalizeText(input)
    .replace(/\bweb custom\b/gi, "Web Custom")
    .replace(/\bfullstack\b/gi, "Fullstack")
    .replace(/\bbackend\/api\b/gi, "Backend/API");
}

export function correctDescription(input: string): string {
  let text = normalizeText(input);
  if (!text) return "";
  for (const claim of FORBIDDEN_CLAIMS) {
    text = text.replace(new RegExp(claim, "ig"), "membantu menyusun draft yang perlu direview");
  }
  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p1, p2) => p1 + String(p2).toUpperCase());
  text = text.replace(/([.!?]){2,}/g, "$1");
  if (!/[.!?]$/.test(text)) text += ".";
  if (text.length < 260) {
    text += " Paket ini membantu pengguna menyusun draft, workflow, struktur, dan checklist secara lebih terarah. Semua hasil tetap perlu direview manual sebelum digunakan atau diunggah ke marketplace.";
  }
  return text;
}

export type ResolvedAdapter =
  | "CODING_AUTOMATION"
  | "TEXT_TO_IMAGE"
  | "IMAGE_EDITING"
  | "TEXT_TO_VIDEO"
  | "ACADEMIC_WRITING"
  | "RESEARCH"
  | "CONTENT_CREATION"
  | "BUSINESS_MARKETING"
  | "EVIDENCE_HANDBOOK"
  | "READY_TO_SELL_PRODUCT"
  | "CUSTOM";

export function resolveAdapter(adapter: string, niche: string): ResolvedAdapter {
  const selected = (adapter ?? "").toUpperCase();
  const known = [
    "CODING_AUTOMATION",
    "TEXT_TO_IMAGE",
    "IMAGE_EDITING",
    "TEXT_TO_VIDEO",
    "ACADEMIC_WRITING",
    "RESEARCH",
    "CONTENT_CREATION",
    "BUSINESS_MARKETING",
    "EVIDENCE_HANDBOOK",
    "READY_TO_SELL_PRODUCT",
  ];
  if (selected && selected !== "CUSTOM" && known.includes(selected)) return selected as ResolvedAdapter;

  const n = normalizeText(niche).toLowerCase();
  if (/(web|fullstack|backend|frontend|automation|automasi|coding|api|saas|app|database|supabase)/.test(n)) return "CODING_AUTOMATION";
  if (/(image|gambar|ilustrasi|midjourney|sdxl|flux)/.test(n)) return "TEXT_TO_IMAGE";
  if (/(edit foto|retouch|photoshop|edit gambar)/.test(n)) return "IMAGE_EDITING";
  if (/(video|reel|tiktok|runway|sora|veo)/.test(n)) return "TEXT_TO_VIDEO";
  if (/(ready[-\s]?to[-\s]?sell|siap jual|produk siap|productized|launch pack|cover|thumbnail|complete pdf|pdf product|gumroad product|marketplace asset|seller asset|sales asset|cta video|marketing video|product page asset|upload asset)/.test(n)) return "READY_TO_SELL_PRODUCT";
  if (/(handbook|vault|playbook|field guide|guidebook|reference pack|referensi kuat|evidence[-\s]?based handbook|supplement|suplemen|nutrition|nutrisi|fitness|health guide|claim checker|source log|evidence table)/.test(n)) return "EVIDENCE_HANDBOOK";
  if (/(academic|akademik|writing|penulisan|skripsi|tesis|jurnal|paper|laporan kasus|case report|case reflection|keperawatan|medis|medical|clinical|klinis|ners|evidence[-\s]?based)/.test(n)) return "ACADEMIC_WRITING";
  if (/(riset|research|literatur)/.test(n)) return "RESEARCH";
  if (/(konten|caption|copywriting|sosial media|content)/.test(n)) return "CONTENT_CREATION";
  if (/(bisnis|marketing|sales|funnel|brand)/.test(n)) return "BUSINESS_MARKETING";
  return "CUSTOM";
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
  const niche = normalizeText(args.niche ?? "").toLowerCase();
  const audience = normalizeText(args.audience ?? "").toLowerCase();
  const adapter = resolveAdapter(args.adapter ?? "CUSTOM", niche);
  if (niche) anchors.add(niche.split(/[,.;]/)[0].slice(0, 90));
  if (audience) anchors.add(`untuk ${audience.split(/[,.;]/)[0].trim()}`);
  adapterThemeAnchors(adapter).forEach((anchor) => anchors.add(anchor));
  if (args.marketplaces?.length) anchors.add(`upload manual ${args.marketplaces.slice(0, 3).join("/")}`);
  if (args.tone) anchors.add(`tone ${args.tone.toLowerCase()}`);
  return Array.from(anchors).filter(Boolean).slice(0, 8);
}

function adapterThemeAnchors(adapter: ResolvedAdapter): string[] {
  switch (adapter) {
    case "CODING_AUTOMATION": return ["Fullstack Web", "PRD", "database schema", "auth & role", "automation workflow", "testing deployment"];
    case "TEXT_TO_IMAGE": return ["visual prompt", "komposisi", "lighting", "negative prompt", "style direction"];
    case "IMAGE_EDITING": return ["brief edit gambar", "masking", "retouch", "before after", "style preservation"];
    case "TEXT_TO_VIDEO": return ["storyboard", "shot list", "camera movement", "voiceover", "scene pacing"];
    case "ACADEMIC_WRITING": return ["struktur akademik", "sitasi", "literature review", "metodologi", "argumen"];
    case "RESEARCH": return ["research question", "literature mapping", "sintesis", "analisis", "insight"];
    case "CONTENT_CREATION": return ["hook", "caption", "carousel", "script", "content pillar"];
    case "BUSINESS_MARKETING": return ["positioning", "USP", "funnel", "objection handling", "sales page"];
    case "EVIDENCE_HANDBOOK": return ["evidence table", "claim checker", "source verification", "safety disclaimer", "reference log", "handbook chapters"];
    case "READY_TO_SELL_PRODUCT": return ["cover prompt", "complete PDF draft", "Gumroad listing", "CTA video prompt", "seller asset kit", "upload checklist"];
    default: return ["paket prompt rapi", "panduan pemakaian", "template digital", "seller review"];
  }
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
  const brand = normalizeText(input.brand || "Brand Anda");
  const niche = titleCaseSoft(input.niche || "produk prompt");
  const audience = normalizeText(input.audience || "UMKM dan seller online");
  const marketplaces = input.marketplaces?.length ? input.marketplaces.join(", ") : "marketplace pilihan";
  const adapter = resolveAdapter(input.adapter || "CUSTOM", niche);
  return {
    product_positioning: `${brand} diposisikan sebagai paket prompt ${adapter} untuk niche "${niche}" dengan tone ${input.tone || "Friendly"}. Fokusnya adalah membuat buyer lebih mudah menyusun output terstruktur, bukan menjanjikan hasil bisnis.`,
    target_audience_fit: `Audiens utama: ${audience}. Struktur file dibuat agar buyer bisa mulai dari README, lalu PromptBook, Sample Input/Output, Usage Guide, dan Quality Checklist.`,
    weakness_detection: "Risiko utama: output bisa terlalu generik jika deskripsi, niche, dan target audiens terlalu pendek. Mitigasi: auto-correction, key anchors, sample input/output, testing report, dan QC scorecard.",
    prompt_architecture_overview: `Manifest wajib menghasilkan ${REQUIRED_CORE_MODULES.length} core file sell-ready, file marketplace hanya untuk ${marketplaces}, dan semua upload tetap manual.`,
    marketplace_preview: `Draft listing dibuat hanya untuk marketplace yang dipilih: ${marketplaces}. Tidak ada file API_* dan tidak ada klaim auto-publish.`,
    qc_readiness: `QC menilai kelengkapan file, prompt count, CSV, duplikasi prompt, sample IO, license, pricing heuristic, manifest JSON, assumption register, klaim terlarang, dan score sellability 85/95.`,
  };
}

export function seedAssumptions(adapter: string) {
  return [
    { text: "Target marketplace menerima produk digital berupa file ZIP/teks prompt jika seller mengikuti kebijakan platform terbaru.", type: "normal", impact: "medium" },
    { text: "Buyer memahami bahwa output AI tetap perlu direview dan diuji ulang sesuai konteks proyek mereka.", type: "normal", impact: "medium" },
    { text: `Adapter "${adapter}" sesuai dengan jenis prompt yang diproduksi. Jika tidak sesuai, output bisa meleset dan harus dibuat run baru.`, type: "critical", impact: "high" },
  ];
}

export function marketplaceModulesFor(marketplaces: string[]): ModuleDefinition[] {
  const selected = marketplaces
    .filter((m): m is keyof typeof MARKETPLACE_MODULES => Object.prototype.hasOwnProperty.call(MARKETPLACE_MODULES, m))
    .map((m) => MARKETPLACE_MODULES[m]);
  return selected.length ? [...selected, MARKETPLACE_BUNDLE_MODULE] : [];
}

export function buildManifestPayload(input: {
  runId?: string;
  brand?: string;
  language?: string;
  targetMarket?: string;
  niche?: string;
  adapter: string;
  marketplaces: string[];
  promptCount: number;
  license?: string;
}): ProductManifestPayload {
  const buyer = FINAL_BUYER_MODULES.map((file) => ({ key: file.replace(/\.[^.]+$/, ""), file, chunks: 1, category: file === "QC_Scorecard.md" ? "qc" : "core" as const }));
  const seller = [{ key: "00_Seller_Master_Toolkit", file: SELLER_TOOLKIT_FILE, chunks: 1, category: "core" as const }];
  const admin = ADMIN_MODULES.map((file) => ({ key: file.replace(/\.[^.]+$/, ""), file, chunks: 1, category: "core" as const }));
  const marketplace = marketplaceModulesFor(input.marketplaces).map((m) => ({ ...m }));
  const modules = [...buyer, ...seller, ...admin, ...marketplace].filter((m) => !isForbiddenModuleKey(m.key) && !(IGNORED_LEGACY_MODULES as readonly string[]).includes(m.file));
  const productId = input.runId ? `ppf-${input.runId}` : `ppf-${Date.now()}`;
  return {
    architecture: PPA_V2_VERSION,
    mode: "MANUAL_UPLOAD_ONLY",
    api_disabled: true,
    no_api_modules: true,
    product_id: productId,
    name: input.brand || "Prompt Product",
    version: "1.0",
    release_date: new Date().toISOString().slice(0, 10),
    adapter: input.adapter,
    language: input.language || "Indonesia",
    target_market: input.targetMarket || "Indonesia",
    niche: normalizeText(input.niche || ""),
    license: input.license || "Personal & Commercial",
    marketplaces: input.marketplaces,
    prompt_count: Number(input.promptCount) || 10,
    files: {
      buyer: [...FINAL_BUYER_MODULES, "Product_Handbook.pdf"],
      seller: [SELLER_TOOLKIT_FILE],
      admin: [...ADMIN_MODULES],
      core: [...FINAL_BUYER_MODULES, SELLER_TOOLKIT_FILE, ...ADMIN_MODULES],
      marketplace: marketplace.map((m) => m.file),
    },
    expected_modules: modules,
    expected_chunks: modules.reduce((sum, m) => sum + m.chunks, 0),
    qc_status: "NOT_SELL_READY",
    manual_upload_only: true,
    api_mode_enabled: false,
  } as ProductManifestPayload;
}

export interface PromptSpec {
  id: string;
  title: string;
  category: string;
  target_user: string;
  use_case: string;
  purpose: string;
  when_to_use: string;
  beginner_mode: string;
  advanced_mode: string;
  full_prompt: string;
  input_variables: string[];
  example_filled_input: string;
  expected_output: string;
  quality_checklist: string[];
  common_mistakes: string[];
  safe_use_note: string;
  output_type: string;
}

function codingAutomationPrompts(audience: string, tone: string): PromptSpec[] {
  const target = audience || "web developer pemula, UMKM, freelancer, creator produk digital";
  const safe = "Gunakan sebagai draft teknis. Review ulang sebelum eksekusi, deploy, atau dipakai untuk pekerjaan client.";
  return [
    {
      id: "coding-01-idea-clarifier",
      title: "Fullstack Web Product Idea Clarifier",
      category: "Discovery",
      target_user: target,
      use_case: "Memperjelas ide produk web fullstack sebelum masuk ke PRD.",
      purpose: "Mengubah ide kasar menjadi arah produk yang lebih spesifik dan bisa dieksekusi.",
      when_to_use: "Saat buyer baru punya ide awal dan belum tahu fitur, target user, serta pendekatan teknisnya.",
      beginner_mode: "Minta AI membuat one-liner, masalah utama, solusi, dan 3 fitur MVP dalam bahasa sederhana.",
      advanced_mode: "Minta AI membandingkan no-code, low-code, dan custom fullstack lengkap dengan trade-off, risiko, dan asumsi teknis.",
      full_prompt: "Saya punya ide produk web: {{ide_singkat}}. Target user: {{target_user}}. Bantu saya menyusun one-liner produk, masalah utama yang dipecahkan, alternatif pendekatan teknis no-code/low-code/custom fullstack, trade-off masing-masing, fitur MVP, risiko awal, dan rekomendasi pendekatan untuk pemula serta advanced user. Tone: {{tone}}.",
      input_variables: ["ide_singkat", "target_user", "tone"],
      example_filled_input: `ide_singkat: katalog online untuk UMKM fashion; target_user: pemilik toko kecil; tone: ${tone}`,
      expected_output: "Ringkasan produk, tabel trade-off, daftar fitur MVP, dan rekomendasi teknis.",
      quality_checklist: ["One-liner jelas", "Ada minimal 3 opsi teknis", "Trade-off dan risiko tertulis", "Tidak menjanjikan hasil bisnis"],
      common_mistakes: ["Ide terlalu umum", "Tidak menyebut target user", "Langsung memilih stack tanpa alasan"],
      safe_use_note: safe,
      output_type: "structured-markdown",
    },
    {
      id: "coding-02-requirement-interview",
      title: "User Requirement Interview Prompt",
      category: "Discovery",
      target_user: target,
      use_case: "Menggali kebutuhan calon user sebelum menentukan scope fitur.",
      purpose: "Membantu buyer menyusun pertanyaan discovery agar kebutuhan user tidak hanya berdasarkan asumsi.",
      when_to_use: "Sebelum membuat PRD, terutama ketika produk akan dipakai oleh UMKM, tim internal, atau client.",
      beginner_mode: "Minta 10 pertanyaan sederhana tentang masalah, kebiasaan, dan ekspektasi user.",
      advanced_mode: "Minta struktur wawancara lengkap dengan kategori pain point, workaround, willingness to pay, data privacy, dan deal-breaker.",
      full_prompt: "Bertindak sebagai product researcher. Susun interview guide untuk persona {{persona}} terkait produk {{produk}}. Bagi pertanyaan menjadi: konteks penggunaan, pain points, current workaround, fitur prioritas, willingness to pay, data/privacy concern, dan deal-breakers. Sertakan cara mencatat insight dan cara menyimpulkan prioritas fitur.",
      input_variables: ["persona", "produk"],
      example_filled_input: "persona: pemilik laundry kecil; produk: sistem booking dan invoice laundry online",
      expected_output: "Daftar pertanyaan terbuka, kategori wawancara, dan template ringkasan insight.",
      quality_checklist: ["Pertanyaan tidak leading", "Ada kategori jelas", "Ada cara menyimpulkan hasil", "Tidak membuat testimoni palsu"],
      common_mistakes: ["Pertanyaan terlalu mengarahkan", "Tidak menanyakan workflow saat ini", "Tidak menanyakan batasan budget"],
      safe_use_note: "Gunakan wawancara dengan persetujuan responden dan jangan mengarang data user.",
      output_type: "question-list",
    },
    {
      id: "coding-03-prd-generator",
      title: "PRD Generator for Web App",
      category: "Spec",
      target_user: target,
      use_case: "Membuat draft Product Requirement Document untuk web app.",
      purpose: "Menjadikan ide dan hasil discovery sebagai dokumen spesifikasi yang mudah dipahami developer/designer.",
      when_to_use: "Setelah buyer tahu target user, masalah utama, dan scope awal produk.",
      beginner_mode: "Minta PRD sederhana berisi ringkasan, tujuan, persona, fitur MVP, dan user story.",
      advanced_mode: "Minta PRD lengkap dengan goal/non-goal, acceptance criteria, success metric, risiko, dan dependency teknis.",
      full_prompt: "Susun PRD untuk web app {{nama_produk}} pada niche {{niche}}. Sertakan: ringkasan produk, background problem, goal dan non-goal, persona, user story format As a/I want/so that, fitur MVP vs v2, acceptance criteria, success metric, asumsi, risiko, dependency teknis, dan scope yang tidak dikerjakan dulu.",
      input_variables: ["nama_produk", "niche"],
      example_filled_input: "nama_produk: InvoiceFlow UMKM; niche: invoice dan reminder pembayaran untuk freelancer",
      expected_output: "Dokumen PRD markdown dengan heading lengkap dan user story minimal 5 item.",
      quality_checklist: ["Goal dan non-goal jelas", "Minimal 5 user story", "Acceptance criteria terukur", "Risiko tercantum"],
      common_mistakes: ["Mencampur MVP dan fitur v2", "Tidak menulis non-goal", "Success metric terlalu abstrak"],
      safe_use_note: safe,
      output_type: "document",
    },
    {
      id: "coding-04-user-flow",
      title: "User Flow and Feature Mapping Prompt",
      category: "UX",
      target_user: target,
      use_case: "Memetakan alur pengguna dan fitur yang mendukung setiap langkah.",
      purpose: "Membantu buyer melihat pengalaman user dari masuk aplikasi sampai menyelesaikan aksi utama.",
      when_to_use: "Setelah PRD awal ada dan sebelum membuat desain UI atau route frontend.",
      beginner_mode: "Minta flow sederhana: landing, login, dashboard, fitur utama, dan selesai.",
      advanced_mode: "Minta flow lengkap dengan friction point, empty state, error state, dan retention loop.",
      full_prompt: "Untuk produk {{nama_produk}}, buat user flow utama dari entry point sampai core action selesai. Bagi menjadi onboarding, authentication, dashboard, core workflow, success state, error/empty state, dan retention. Untuk tiap langkah, tulis fitur pendukung, data yang dibutuhkan, friction point, dan ide perbaikan UX.",
      input_variables: ["nama_produk"],
      example_filled_input: "nama_produk: ClientPortal untuk freelancer desain",
      expected_output: "Flow bernomor dan tabel feature mapping per langkah.",
      quality_checklist: ["Ada entry dan success state", "Friction point jelas", "Fitur dipetakan ke langkah user", "Ada error/empty state"],
      common_mistakes: ["Hanya menulis fitur, bukan flow", "Tidak ada state gagal", "Tidak menandai user role"],
      safe_use_note: "Validasi flow dengan calon user sebelum dibangun.",
      output_type: "flow-table",
    },
    {
      id: "coding-05-database-schema",
      title: "Database Schema Planning Prompt",
      category: "Architecture",
      target_user: target,
      use_case: "Merancang skema database awal untuk web app.",
      purpose: "Membantu buyer menyusun tabel, kolom, relasi, dan index sebelum development.",
      when_to_use: "Setelah fitur MVP dan user flow diketahui.",
      beginner_mode: "Minta daftar tabel utama dan relasi sederhana.",
      advanced_mode: "Minta schema Postgres lengkap dengan PK/FK, index, RLS, audit fields, dan soft delete policy.",
      full_prompt: "Rancang skema database Postgres untuk {{nama_produk}} dengan domain utama {{domain}}. Output harus mencakup daftar tabel, kolom, tipe data, primary key, foreign key, index yang disarankan, RLS/ACL policy awal, audit fields, dan alasan relasi. Pisahkan tabel auth/profile dari tabel domain.",
      input_variables: ["nama_produk", "domain"],
      example_filled_input: "nama_produk: BookingStudio; domain: jadwal studio, paket layanan, booking, pembayaran",
      expected_output: "Tabel schema dan penjelasan relasi per tabel.",
      quality_checklist: ["Ada PK/FK", "Index pada kolom penting", "RLS/ACL dipertimbangkan", "Tidak menyimpan role hanya di profile"],
      common_mistakes: ["Tidak ada index", "Relasi many-to-many diabaikan", "Tidak ada owner_id untuk multi-user"],
      safe_use_note: "Review dengan developer/database engineer sebelum produksi.",
      output_type: "schema-table",
    },
    {
      id: "coding-06-auth-role",
      title: "Auth and User Role Planning Prompt",
      category: "Architecture",
      target_user: target,
      use_case: "Merancang login, role, dan permission matrix.",
      purpose: "Mencegah sistem role dibuat asal-asalan dan rawan akses data silang.",
      when_to_use: "Saat produk punya admin, user, owner, staff, client, atau multi-role lain.",
      beginner_mode: "Minta daftar role dan fitur apa yang boleh diakses setiap role.",
      advanced_mode: "Minta permission matrix CRUD per resource, session policy, reset password, dan audit log.",
      full_prompt: "Rancang model auth dan role untuk {{nama_produk}}. Sertakan metode login, daftar role, permission matrix CRUD per resource, aturan owner_id, session/refresh token, password reset, audit log, dan contoh RLS/ACL policy jika memakai Supabase atau Postgres.",
      input_variables: ["nama_produk"],
      example_filled_input: "nama_produk: Dashboard Manajemen Order untuk UMKM katering",
      expected_output: "Permission matrix dan flow auth dari login sampai akses resource.",
      quality_checklist: ["Minimal 2 role", "CRUD matrix lengkap", "Ada owner_id/RLS", "Ada reset password dan audit log"],
      common_mistakes: ["Role disimpan sebagai teks bebas tanpa policy", "Tidak membedakan owner dan admin", "Tidak memikirkan session expiry"],
      safe_use_note: "Jangan menyimpan secret di frontend atau repository.",
      output_type: "permission-matrix",
    },
    {
      id: "coding-07-frontend-structure",
      title: "Frontend Page Structure Generator",
      category: "Frontend",
      target_user: target,
      use_case: "Menyusun route, halaman, komponen, dan state frontend.",
      purpose: "Membantu buyer merencanakan UI sebelum coding agar tidak acak.",
      when_to_use: "Setelah user flow dan fitur MVP sudah jelas.",
      beginner_mode: "Minta route publik, route login, dashboard, dan halaman fitur utama.",
      advanced_mode: "Minta struktur route nested, protected route, loading/empty/error state, dan komponen reusable.",
      full_prompt: "Untuk {{nama_produk}}, susun struktur frontend berbasis React. Buat tabel route, tujuan halaman, akses publik/protected, komponen utama, data yang dibutuhkan, state loading/empty/error, dan event user utama. Beri rekomendasi komponen reusable dan urutan implementasi.",
      input_variables: ["nama_produk"],
      example_filled_input: "nama_produk: Portal Invoice Freelancer",
      expected_output: "Tabel route dan komponen plus prioritas implementasi.",
      quality_checklist: ["Route publik/protected jelas", "Ada loading/empty/error state", "Komponen reusable disebut", "Data dependency tertulis"],
      common_mistakes: ["Tidak ada state loading", "Komponen terlalu spesifik", "Protected route tidak jelas"],
      safe_use_note: safe,
      output_type: "frontend-map",
    },
    {
      id: "coding-08-backend-api",
      title: "Backend/API Logic Planner",
      category: "Backend",
      target_user: target,
      use_case: "Memetakan endpoint, RPC, service function, dan side effect backend.",
      purpose: "Membantu buyer membuat backend yang konsisten dan mudah dites.",
      when_to_use: "Setelah database schema dan frontend route sudah tersedia.",
      beginner_mode: "Minta daftar endpoint CRUD utama dan input/output sederhana.",
      advanced_mode: "Minta endpoint/RPC lengkap dengan auth required, validation, side-effect, idempotency, dan error response.",
      full_prompt: "Susun backend/API plan untuk {{nama_produk}}. Buat tabel endpoint atau RPC dengan method, path/nama fungsi, domain, input schema, output schema, auth required, role allowed, side-effect, validation, idempotency, error response, dan test case dasar. Kelompokkan berdasarkan domain {{domain}}.",
      input_variables: ["nama_produk", "domain"],
      example_filled_input: "nama_produk: CRM sederhana; domain: contacts, deals, tasks, notes",
      expected_output: "API/RPC specification table dengan contoh payload.",
      quality_checklist: ["Auth required jelas", "Input/output schema ada", "Side-effect ditandai", "Error response konsisten"],
      common_mistakes: ["Endpoint tidak idempotent", "Tidak ada validasi server", "Role access tidak ditulis"],
      safe_use_note: "Validasi input di server, bukan hanya di frontend.",
      output_type: "api-spec",
    },
    {
      id: "coding-09-automation-workflow",
      title: "Automation Workflow Planner",
      category: "Automation",
      target_user: target,
      use_case: "Merancang workflow automation seperti cron, webhook, queue, dan reminder.",
      purpose: "Membantu buyer membuat automasi yang tahan error dan bisa dipantau.",
      when_to_use: "Saat produk membutuhkan background job, notifikasi, sinkronisasi, atau proses berkala.",
      beginner_mode: "Minta 3 workflow sederhana: trigger, langkah, output.",
      advanced_mode: "Minta retry policy, dead-letter, observability, idempotency, dan failure recovery.",
      full_prompt: "Rancang workflow automation untuk {{nama_produk}}. Sertakan minimal 3 workflow penting dengan trigger, precondition, langkah proses, data input/output, retry policy, dead-letter handling, logging, metric, alert, idempotency, dan cara monitoring. Jelaskan tool opsional seperti cron, queue, webhook, atau n8n jika relevan.",
      input_variables: ["nama_produk"],
      example_filled_input: "nama_produk: Sistem reminder pembayaran invoice",
      expected_output: "Workflow table plus retry/observability plan.",
      quality_checklist: ["Trigger jelas", "Retry policy ada", "Observability ada", "Failure path ditulis"],
      common_mistakes: ["Tidak ada retry", "Tidak ada log", "Workflow bisa dobel eksekusi"],
      safe_use_note: "Jangan memproses data sensitif tanpa kebijakan keamanan yang jelas.",
      output_type: "workflow-plan",
    },
    {
      id: "coding-10-testing-deployment",
      title: "Testing, Deployment, and Maintenance Checklist Prompt",
      category: "Ops",
      target_user: target,
      use_case: "Membuat checklist sebelum launch dan setelah live.",
      purpose: "Membantu buyer mengurangi risiko bug saat rilis produk web.",
      when_to_use: "Sebelum staging, production deploy, atau handover ke client.",
      beginner_mode: "Minta checklist pre-launch, launch, dan post-launch yang sederhana.",
      advanced_mode: "Minta unit/integration/E2E tests, rollback plan, monitoring, backup, incident response, dan maintenance window.",
      full_prompt: "Susun checklist testing, deployment, dan maintenance untuk {{nama_produk}}. Cakup unit test, integration test, E2E happy path, permission test, data migration test, staging deploy, production deploy, rollback plan, monitoring, backup, alerting, incident response, maintenance window, dan post-launch review.",
      input_variables: ["nama_produk"],
      example_filled_input: "nama_produk: Portal Booking Konsultasi Online",
      expected_output: "Checklist pre-launch, launch, post-launch, dan maintenance.",
      quality_checklist: ["Ada rollback plan", "Backup tertulis", "Monitoring eksplisit", "Permission test ada"],
      common_mistakes: ["Tidak ada rollback", "Tidak ada backup", "E2E hanya happy path"],
      safe_use_note: safe,
      output_type: "checklist",
    },
  ];
}


type AdapterConfig = {
  topicTitles: string[];
  contextRole: string;
  bestFor: string;
  outputType: string;
  variables: string[];
  safety: string;
  expected: string;
  checklist: string[];
  mistakes: string[];
};

const ADAPTER_CONFIGS: Record<Exclude<ResolvedAdapter, "CUSTOM">, AdapterConfig> = {
  TEXT_TO_IMAGE: {
    topicTitles: [
      "Product Image Prompt Generator",
      "Visual Style Direction Prompt",
      "Lighting & Camera Angle Prompt",
      "Background & Scene Builder",
      "Marketplace Thumbnail Prompt",
      "Social Media Product Visual Prompt",
      "Brand Moodboard Prompt",
      "Negative Prompt Optimizer",
      "Image Variation Prompt Builder",
      "Final Image Prompt QA Checklist",
    ],
    contextRole: "AI image prompt engineer untuk product photography dan visual marketplace",
    bestFor: "seller produk fisik/digital, creator visual, UMKM, brand owner, dan marketplace seller",
    outputType: "image-prompt",
    variables: ["product", "material", "style", "background", "lighting", "camera", "composition", "aspect_ratio", "negative_prompt"],
    safety: "Gunakan hanya untuk visual produk yang Anda miliki haknya. Hindari logo, karakter, wajah nyata, atau desain pihak ketiga tanpa izin.",
    expected: "Final image prompt lengkap dengan visual subject, lighting, background, camera angle, composition, aspect ratio, dan negative prompt.",
    checklist: ["Subjek visual spesifik", "Lighting jelas", "Background jelas", "Aspect ratio sesuai platform", "Negative prompt ada", "Tidak meniru merek/karakter pihak ketiga"],
    mistakes: ["Prompt terlalu pendek seperti 'foto produk bagus'", "Tidak menyebut lighting", "Tidak menyebut background", "Tidak menulis negative prompt", "Menyebut brand/karakter tanpa hak pakai"],
  },
  IMAGE_EDITING: {
    topicTitles: [
      "Background Removal / Replacement Prompt",
      "Object Cleanup Prompt",
      "Product Retouch Prompt",
      "Color Correction Prompt",
      "Lighting Improvement Prompt",
      "Marketplace Resize & Crop Prompt",
      "Before-After Edit Brief",
      "Style Consistency Prompt",
      "Defect Cleanup Prompt",
      "Final Edit QA Checklist",
    ],
    contextRole: "photo editing director untuk retouch, cleanup, dan marketplace image optimization",
    bestFor: "seller marketplace, editor foto produk, social media admin, dan brand owner",
    outputType: "image-editing-brief",
    variables: ["image_condition", "object_to_keep", "background_target", "cleanup_area", "color_target", "crop_ratio", "export_format"],
    safety: "Edit hanya gambar yang Anda miliki atau mendapat izin. Jangan membuat klaim visual palsu yang menyesatkan buyer.",
    expected: "Brief edit foto konkret berisi kondisi awal, target edit, cleanup, color correction, crop, export spec, dan QA checklist.",
    checklist: ["Before condition jelas", "Target edit spesifik", "Area yang tidak boleh berubah jelas", "Export size/ratio ada", "Tidak over-retouch", "Ready untuk marketplace"],
    mistakes: ["Instruksi 'buat lebih bagus' terlalu umum", "Tidak menyebut bagian yang harus dipertahankan", "Tidak menentukan crop ratio", "Warna produk berubah berlebihan"],
  },
  TEXT_TO_VIDEO: {
    topicTitles: [
      "3-Second Hook Video Prompt",
      "Scene Breakdown Prompt",
      "Shot List Prompt",
      "Camera Movement Prompt",
      "Transition & Pacing Prompt",
      "Product Demo Video Prompt",
      "Voiceover Direction Prompt",
      "Storyboard Prompt",
      "CTA Ending Prompt",
      "Final Video QA Checklist",
    ],
    contextRole: "short-form video director untuk iklan, demo produk, TikTok/Reels, dan AI video prompt",
    bestFor: "content creator, seller produk, brand owner, dan tim promosi",
    outputType: "video-production-prompt",
    variables: ["product", "duration", "platform", "hook", "scene_count", "camera_movement", "voiceover_tone", "cta"],
    safety: "Tidak ada klaim viral, FYP, atau hasil penjualan pasti. Semua footage, musik, dan aset harus punya izin pakai.",
    expected: "Video prompt berisi hook 3 detik, scene list, durasi, camera movement, transition, voiceover, dan CTA.",
    checklist: ["Hook 3 detik jelas", "Durasi tiap scene ada", "Camera movement spesifik", "CTA jelas", "Tidak menjanjikan viral/FYP", "Cocok dengan platform"],
    mistakes: ["Scene terlalu panjang", "Tidak ada shot list", "CTA tidak jelas", "Mengklaim pasti viral", "Tidak menyebut durasi"],
  },
  ACADEMIC_WRITING: {
    topicTitles: [
      "Academic Title & Research Gap Prompt",
      "Introduction / Latar Belakang Prompt",
      "Literature Review Synthesis Prompt",
      "Methodology Drafting Prompt",
      "Results & Discussion Prompt",
      "Abstract Generator",
      "Academic Paraphrase Prompt",
      "Citation Ethics Checker",
      "Limitation & Recommendation Prompt",
      "Final Academic QA Checklist",
    ],
    contextRole: "academic writing assistant yang menjaga integritas ilmiah, struktur, dan etika sitasi",
    bestFor: "mahasiswa, dosen, peneliti, dan penulis akademik yang butuh draft terstruktur",
    outputType: "academic-draft",
    variables: ["topic", "research_gap", "method", "population", "variables", "citation_style", "source_list"],
    safety: "Tidak boleh membuat sitasi, DOI, data, atau sumber palsu. Ini bukan jasa joki. Semua referensi wajib diverifikasi manual.",
    expected: "Draft akademik terstruktur dengan gap, argumen, metode, batasan, dan catatan verifikasi sitasi.",
    checklist: ["Gap penelitian jelas", "Logika akademik runtut", "Tidak ada sitasi palsu", "Metode sesuai", "Batasan ditulis", "Sumber wajib diverifikasi"],
    mistakes: ["Mengarang DOI", "Mencampur opini dengan fakta", "Tidak menyebut metode", "Parafrase terlalu dekat", "Tidak mencatat batasan"],
  },
  RESEARCH: {
    topicTitles: [
      "Research Question Framing Prompt",
      "Literature Mapping Prompt",
      "Source Triangulation Prompt",
      "Interview Guide Prompt",
      "Survey Design Prompt",
      "Thematic Analysis Prompt",
      "Insight Synthesis Prompt",
      "Assumption & Limitation Prompt",
      "Competitor / Domain Research Scan",
      "Final Research Report QA",
    ],
    contextRole: "research strategist untuk desain riset, validasi sumber, dan sintesis insight",
    bestFor: "researcher, product strategist, mahasiswa, marketer, dan founder",
    outputType: "research-framework",
    variables: ["research_topic", "research_question", "source_list", "respondent_profile", "method", "analysis_goal", "limitations"],
    safety: "Tidak boleh mengarang data, narasumber, statistik, atau sumber. Semua temuan wajib diberi batasan dan diverifikasi.",
    expected: "Framework riset dengan pertanyaan, mapping literatur, instrumen, triangulasi, analisis, insight, dan limitation.",
    checklist: ["Research question fokus", "Metode jelas", "Triangulasi ada", "Instrumen sesuai", "Tidak ada data palsu", "Limitasi eksplisit"],
    mistakes: ["Pertanyaan riset terlalu luas", "Tidak validasi sumber", "Menggeneralisasi sampel kecil", "Mengarang insight tanpa data"],
  },
  CONTENT_CREATION: {
    topicTitles: [
      "Hook Generator",
      "Caption Generator",
      "Carousel Outline Prompt",
      "Short Video Script Prompt",
      "Content Calendar Prompt",
      "Storytelling Angle Prompt",
      "Brand Voice Variation Prompt",
      "Content Repurposing Prompt",
      "Engagement Prompt",
      "Final Content QA Checklist",
    ],
    contextRole: "content strategist untuk social media, carousel, caption, dan short video script",
    bestFor: "creator, social media admin, personal brand, UMKM, dan edukator",
    outputType: "content-system",
    variables: ["content_goal", "platform", "audience", "topic", "hook_style", "cta", "brand_voice"],
    safety: "Tidak boleh menjanjikan viral, FYP, reach, engagement, atau growth pasti. Hindari klaim medis/keuangan tanpa dasar.",
    expected: "Konten siap edit berisi hook, caption, outline carousel/script, CTA, angle, dan repurposing idea.",
    checklist: ["Hook kuat", "Platform sesuai", "CTA jelas", "Brand voice konsisten", "Tidak klaim viral", "Ada variasi angle"],
    mistakes: ["Caption terlalu generic", "Tidak ada CTA", "Tidak menyesuaikan platform", "Mengklaim pasti FYP"],
  },
  BUSINESS_MARKETING: {
    topicTitles: [
      "Positioning Prompt",
      "USP Builder Prompt",
      "Sales Page Prompt",
      "Funnel Prompt",
      "Email Sequence Prompt",
      "Objection Handling Prompt",
      "Pricing Angle Prompt",
      "Campaign Plan Prompt",
      "Lead Magnet Prompt",
      "Final Marketing QA Checklist",
    ],
    contextRole: "ethical marketing strategist untuk positioning, funnel, sales page, dan campaign plan",
    bestFor: "seller digital product, UMKM, marketer, founder, dan copywriter",
    outputType: "marketing-system",
    variables: ["offer", "audience", "pain_point", "benefit", "proof", "price", "channel", "cta"],
    safety: "Tidak boleh menjamin sales, conversion, revenue, income, atau hasil bisnis. Semua klaim harus bisa dibuktikan.",
    expected: "Asset marketing berisi positioning, USP, sales page outline, funnel, email sequence, objection handling, dan campaign plan.",
    checklist: ["Positioning jelas", "USP spesifik", "Objection ditangani", "Klaim tidak berlebihan", "CTA jelas", "Harga ditulis sebagai heuristic jika perlu"],
    mistakes: ["USP terlalu umum", "Menjamin closing", "Tidak menyebut audience", "Menggunakan pressure tactic berlebihan"],
  },
  EVIDENCE_HANDBOOK: {
    topicTitles: [
      "Handbook Scope & Reader Promise Prompt",
      "Evidence Table Builder Prompt",
      "Source Verification & Citation Log Prompt",
      "Claim Strength Grading Prompt",
      "Chapter Outline & Section Writer Prompt",
      "Risk, Contraindication & Limitation Prompt",
      "Myth vs Evidence Explainer Prompt",
      "Reference-Backed FAQ Builder Prompt",
      "Update Log & Versioning Prompt",
      "Final Evidence Handbook QA Checklist",
    ],
    contextRole: "evidence-based handbook architect yang membuat handbook, vault, reference guide, dan playbook berbasis sumber terverifikasi",
    bestFor: "seller produk digital, researcher, educator, coach, writer, dan creator yang membuat handbook berbasis referensi",
    outputType: "evidence-handbook-system",
    variables: ["handbook_topic", "reader_profile", "scope", "source_list", "claim", "evidence_level", "limitation", "safety_note", "chapter_goal", "citation_style"],
    safety: "Tidak boleh membuat sumber, DOI, studi, data, klaim kesehatan/keuangan/hukum, dosis, rekomendasi medis, atau angka yang tidak diberikan pengguna. Semua klaim harus diberi evidence level, limitation, dan source verification status.",
    expected: "Handbook/vault framework berisi scope, chapter outline, evidence table, source log, claim checker, risk/limitation section, FAQ, update log, dan QA checklist tanpa klaim palsu.",
    checklist: ["Scope handbook jelas", "Evidence table ada", "Source log ada", "Claim strength diberi level", "Safety/limitation tertulis", "Tidak ada referensi palsu", "Manual verification required"],
    mistakes: ["Mengarang studi/DOI", "Memberi rekomendasi dosis/terapi tanpa sumber", "Menyamakan bukti lemah dengan fakta kuat", "Tidak menulis kontraindikasi/limitation", "Tidak membedakan claim dan evidence"],
  },

  READY_TO_SELL_PRODUCT: {
    topicTitles: [
      "Product Audit & Positioning Extractor",
      "Buyer Package Content Organizer",
      "Complete PDF Product Builder Prompt",
      "Cover Direction & Thumbnail Prompt",
      "Gumroad/Shopee/Etsy Listing Builder",
      "Marketing Video CTA Script Prompt",
      "Bonus & Bundle Builder Prompt",
      "FAQ & Delivery Instructions Builder",
      "Marketplace Upload Asset QA Checklist",
      "Final Sell-Ready Product Pack Checklist",
    ],
    contextRole: "productization strategist yang mengubah draft/ZIP produk digital menjadi paket siap jual dengan cover, PDF, listing, CTA, dan upload assets",
    bestFor: "seller produk digital, creator Gumroad, Etsy seller, Shopee/Tokopedia seller, course/handbook/prompt pack creator",
    outputType: "ready-to-sell-product-pack",
    variables: ["product_files_summary", "buyer_profile", "product_promise", "cover_style", "pdf_structure", "marketplace", "cta_goal", "bonus_assets", "pricing_note"],
    safety: "Tidak boleh mengklaim produk pasti laku, pasti viral, pasti income, atau marketplace-approved. Jika produk berisi kesehatan/finansial/hukum/akademik, semua klaim harus diverifikasi dan diberi disclaimer.",
    expected: "Paket siap jual berisi audit produk, buyer-ready PDF structure, cover generation brief, listing assets, CTA/video prompt, delivery instructions, dan final upload QA.",
    checklist: ["PDF product draft ada", "Cover prompt ada", "Marketplace assets ada", "Video CTA prompt opsional ada", "Delivery instruction jelas", "No overclaim", "Buyer/seller files terpisah"],
    mistakes: ["Hanya membuat prompt pack tanpa cover/PDF", "Listing tidak siap paste", "Tidak ada delivery instructions", "Mengklaim produk pasti laku", "Tidak ada asset checklist"],
  },
  CODING_AUTOMATION: {
    topicTitles: [],
    contextRole: "senior fullstack architect",
    bestFor: "developer, founder, product manager, dan automation builder",
    outputType: "technical-blueprint",
    variables: ["product_idea", "users", "features", "data_entities", "roles", "integrations"],
    safety: "Jangan hardcode secret/API key. Review keamanan, auth, validation, dan deployment sebelum production.",
    expected: "Blueprint teknis berisi PRD, user flow, database, auth, API, automation, testing, deployment.",
    checklist: ["PRD jelas", "Schema logis", "Auth/role ada", "API terdefinisi", "Testing ada", "No secrets"],
    mistakes: ["Langsung coding tanpa PRD", "Tidak ada auth rules", "Tidak ada test plan", "Hardcode secret"],
  },
};

function customMode(niche: string): keyof typeof CUSTOM_LIBRARIES {
  const n = normalizeText(niche).toLowerCase();
  if (/prompt|formula|framework|evaluator|refiner|template engine/.test(n)) return "PROMPT_ENGINEERING_FORMULA_PACK";
  if (/department|corporate|team|hr|sales|finance|operation|sop|perusahaan/.test(n)) return "DEPARTMENT_CORPORATE_PROMPTS";
  if (/marketplace|seller|jualan|shopee|tokopedia|etsy|gumroad|listing/.test(n)) return "MARKETPLACE_SELLER_PROMPT_OS";
  if (/planner|productivity|habit|workflow|notion|agenda|routine/.test(n)) return "PRODUCTIVITY_PLANNER_PROMPT_OS";
  return "CUSTOM_GENERIC";
}

const CUSTOM_LIBRARIES = {
  PROMPT_ENGINEERING_FORMULA_PACK: ["Role–Context–Task–Format Prompt Builder", "Prompt Diagnosis & Weakness Scanner", "Output Refinement Prompt", "Evaluator Prompt Generator", "Prompt Variation Builder", "Prompt Compression Prompt", "System Instruction Drafting Prompt", "Reusable Workflow Prompt", "Anti-Generic Output Checker", "Final Prompt QA Checklist"],
  DEPARTMENT_CORPORATE_PROMPTS: ["Executive Summary Prompt", "Department SOP Builder", "Meeting Notes to Action Plan Prompt", "Internal Memo Prompt", "HR Screening Prompt", "Customer Support Response Prompt", "Sales Follow-up Prompt", "Finance Review Prompt", "Risk Register Prompt", "Final Corporate QA Checklist"],
  MARKETPLACE_SELLER_PROMPT_OS: ["Product Listing Optimizer", "Marketplace Keyword Prompt", "Competitor Comparison Prompt", "Pricing Angle Prompt", "Bundle Offer Prompt", "Review Response Prompt", "Seller FAQ Prompt", "Promo Calendar Prompt", "Customer Message Prompt", "Final Seller QA Checklist"],
  PRODUCTIVITY_PLANNER_PROMPT_OS: ["Goal Breakdown Prompt", "Weekly Planner Prompt", "Priority Matrix Prompt", "Habit Tracker Prompt", "Project Milestone Prompt", "Decision Journal Prompt", "Meeting Prep Prompt", "Learning Plan Prompt", "Progress Review Prompt", "Final Productivity QA Checklist"],
  CUSTOM_GENERIC: ["Niche Clarifier Prompt", "Audience Fit Prompt", "Use Case Builder", "Template Generator", "Variation Prompt", "Quality Review Prompt", "Safe Use Prompt", "Output Formatter", "Buyer Guide Prompt", "Final Custom QA Checklist"],
} as const;

function makePromptSpec(adapter: ResolvedAdapter, title: string, index: number, niche: string, audience: string, tone: string, config: AdapterConfig): PromptSpec {
  const vars = config.variables;
  const variableList = vars.map((v) => `{{${v}}}`).join(", ");
  const exampleMap: Record<string, string> = {
    product: `${niche} premium`, material: "material/fitur utama yang perlu terlihat", style: `${tone} premium`, background: "neutral clean background", lighting: "soft natural light", camera: "50mm lens, product angle 45°", composition: "rule of thirds, negative space 40%", aspect_ratio: "4:5", negative_prompt: "blurry, watermark, low resolution, distorted text",
    image_condition: "foto produk agak gelap dengan background ramai", object_to_keep: "produk utama dan tekstur asli", background_target: "clean beige marketplace background", cleanup_area: "debu, bayangan keras, objek distraksi", color_target: "warna asli produk, sedikit lebih hangat", crop_ratio: "4:5", export_format: "JPG 3000px high quality",
    duration: "15 detik", platform: "TikTok/Reels", hook: "masalah utama buyer dalam 3 detik", scene_count: "5 scene", camera_movement: "slow push-in, top view, close-up", voiceover_tone: tone, cta: "lihat detail produk",
    topic: niche, research_gap: "gap utama berdasarkan sumber terverifikasi", method: "metode yang dipakai", population: audience, variables: "variabel utama", citation_style: "APA 7", source_list: "daftar sumber valid, bukan dibuat-buat",
    research_topic: niche, research_question: "pertanyaan riset fokus", respondent_profile: audience, analysis_goal: "insight yang ingin dicari", limitations: "batasan data dan metode",
    content_goal: "edukasi dan konversi ringan", audience, hook_style: "problem-solution", brand_voice: tone, offer: niche, pain_point: "masalah utama audiens", benefit: "manfaat realistis", proof: "bukti/fitur yang valid", price: "harga heuristic", channel: "marketplace/social/email",
  };
  const filled = vars.map((v) => `${v}: ${exampleMap[v] || `${v} untuk ${niche}`}`).join("; ");
  return {
    id: `${adapter.toLowerCase()}-${index + 1}`,
    title,
    category: index < 3 ? "Strategy" : index < 7 ? "Production" : "Optimization",
    target_user: audience || config.bestFor,
    use_case: `${title} untuk ${niche}`,
    purpose: `Membantu buyer membuat ${title.toLowerCase()} yang spesifik untuk ${niche}, bukan template generik.`,
    when_to_use: `Gunakan saat buyer perlu output ${config.outputType} yang siap direview untuk ${niche}.`,
    beginner_mode: `Isi variabel utama (${variableList}) dengan konteks singkat. Minta output ringkas, terstruktur, dan mudah diedit.`,
    advanced_mode: `Tambahkan batasan kualitas, contoh input, target platform, gaya visual/bahasa, format akhir, risiko, dan QA checklist sebelum memakai output.`,
    full_prompt: `Anda adalah ${config.contextRole}. Buat ${title} untuk niche {{niche}} dengan audiens {{audiens}} dan tone {{tone}}. Gunakan variabel: ${variableList}. Output harus spesifik, konkret, aman untuk produk digital, dan tidak berisi klaim hasil pasti. Sertakan: 1) tujuan, 2) input yang dibutuhkan, 3) output final siap pakai, 4) variasi beginner dan advanced, 5) checklist kualitas, 6) common mistakes, 7) safe use note.`,
    input_variables: ["niche", "audiens", "tone", ...vars],
    example_filled_input: `niche: ${niche}; audiens: ${audience}; tone: ${tone}; ${filled}`,
    expected_output: config.expected,
    quality_checklist: config.checklist,
    common_mistakes: config.mistakes,
    safe_use_note: config.safety,
    output_type: config.outputType,
  };
}

export function buildPromptLibrary(adapter: ResolvedAdapter, niche: string, count: number, audience = "", tone = "Friendly"): PromptSpec[] {
  if (adapter === "CODING_AUTOMATION") {
    const base = codingAutomationPrompts(audience, tone);
    return base.slice(0, count);
  }
  const titles = adapter === "CUSTOM" ? CUSTOM_LIBRARIES[customMode(niche)] : ADAPTER_CONFIGS[adapter].topicTitles;
  const config = adapter === "CUSTOM" ? {
    topicTitles: titles as unknown as string[],
    contextRole: "prompt product architect untuk custom prompt product yang sangat spesifik terhadap niche",
    bestFor: "seller produk prompt digital, creator, dan tim internal",
    outputType: "custom-prompt-system",
    variables: ["niche", "audience", "goal", "output_format", "constraints", "quality_bar"],
    safety: "Custom prompt harus tetap aman, tidak mengarang klaim, tidak menjanjikan hasil, dan wajib direview manual sebelum dijual.",
    expected: "Prompt system custom yang spesifik ke niche, punya format output, contoh input, checklist, dan batasan penggunaan.",
    checklist: ["Niche jelas", "Output format jelas", "Variabel lengkap", "Ada QA gate", "Tidak generic", "Safe use note ada"],
    mistakes: ["Custom terlalu luas", "Tidak mendeteksi use case", "Tidak menulis format output", "Tidak memberi contoh"],
  } satisfies AdapterConfig : ADAPTER_CONFIGS[adapter];
  const base = titles.map((title, index) => makePromptSpec(adapter, title, index, niche, audience, tone, config));
  while (base.length < count) {
    const source = base[base.length % Math.max(1, base.length)];
    base.push({ ...source, id: `${source.id}-advanced-${base.length + 1}`, title: `${source.title} — Advanced Variant ${base.length + 1}`, full_prompt: `${source.full_prompt}\n\nAdvanced variant: buat 2 opsi output dengan tingkat detail berbeda, lalu beri rekomendasi kapan memakai masing-masing opsi.` });
  }
  return base.slice(0, count);
}

export type SellerMeta = {
  brand?: string;
  niche?: string;
  audience?: string;
  prompt_count?: number;
  promptCount?: number;
  tone?: string;
  confirmed_product_description?: string;
  confirmedDescription?: string;
  license?: string;
  language?: string;
  target_market?: string;
  target_price?: string;
};

function sellerMeta(raw: SellerMeta) {
  return {
    brand: normalizeText(raw.brand || "Assetflow"),
    niche: titleCaseSoft(raw.niche || "produk prompt digital"),
    audience: normalizeText(raw.audience || "seller produk digital"),
    prompt_count: Number(raw.prompt_count ?? raw.promptCount ?? 10),
    tone: normalizeText(raw.tone || "Friendly"),
    confirmed_product_description: normalizeText(raw.confirmed_product_description || raw.confirmedDescription || "Paket ini membantu buyer menyusun output yang lebih rapi, terstruktur, dan mudah direview."),
    license: normalizeText(raw.license || "Personal & Commercial"),
    language: normalizeText(raw.language || "Indonesia"),
    target_market: normalizeText(raw.target_market || "Indonesia"),
    target_price: normalizeText(raw.target_price || "Rp 49.000–149.000"),
  };
}

function mdList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}


type ProductIntentResult = {
  intent: "DUE_DILIGENCE_SYSTEM" | "CONTENT_REPURPOSING" | "RESEARCH_SYSTEM" | "TEXT_TO_IMAGE_SYSTEM" | "CONTENT_CREATION" | "GENERAL_PROMPT_PACK";
  recommendedAdapter: ResolvedAdapter;
  promptCategories: string[];
  mismatchWarning?: string;
};

function detectProductIntentFromInputs(args: { niche: string; description: string; brand: string; audience: string; adapter?: string }): ProductIntentResult {
  const combined = normalizeText(`${args.niche} ${args.description} ${args.brand} ${args.audience}`).toLowerCase();
  if (/(due diligence|akuisisi bisnis|akuisisi usaha|membeli bisnis|membeli usaha|business acquisition|risk review|seller interview|business risk|operational risk|financial red flag|acquisition checklist|validasi akuisisi|calon investor)/i.test(combined)) {
    return { intent: "DUE_DILIGENCE_SYSTEM", recommendedAdapter: "RESEARCH", promptCategories: [
      "Acquisition Goal Clarifier",
      "Seller Interview Question Builder",
      "Business Model Snapshot",
      "Revenue Verification Checklist",
      "Operational Risk Mapping",
      "Customer Dependency Analysis",
      "Supplier and Vendor Risk Review",
      "Basic Financial Red Flag Scanner",
      "Legal Document Question List",
      "Deal Assumption Register",
      "Risk Summary Report Builder",
      "Final Due Diligence Review Checklist",
    ] };
  }
  if (/(repurpose|hook|short.?form|short form|tiktok|reels|youtube shorts|instagram shorts|caption|social media|short content|script)/i.test(combined)) {
    return { intent: "CONTENT_REPURPOSING", recommendedAdapter: "CONTENT_CREATION", promptCategories: ["Hook Generation", "Long-Form to Short-Form Repurposing", "Short-Form Script Builder", "Caption Variants", "CTA Builder", "Platform Adaptation Logic", "Content Batching Strategy", "Audience Angle Finder", "Content Performance Testing", "Final Output QA"] };
  }
  if (/(riset|research|market research|competitor analysis|survey|interview|data collection|analysis|insight|report|market sizing|validation)/i.test(combined)) {
    return { intent: "RESEARCH_SYSTEM", recommendedAdapter: "RESEARCH", promptCategories: ["Research Question Framing", "Source Mapping & Evaluation", "Data Collection Strategy", "Triangulation Methodology", "Interview Guide Builder", "Survey Design Prompt", "Thematic Analysis Workflow", "Insight Synthesis", "Assumption Register Creator", "Research QA & Validation"] };
  }
  return { intent: "GENERAL_PROMPT_PACK", recommendedAdapter: resolveAdapter(args.adapter || "CUSTOM", args.niche), promptCategories: ["Prompt System", "Workflow", "QA"] };
}

function isDueDiligenceSystem(seller: ReturnType<typeof sellerMeta>): boolean {
  return detectProductIntentFromInputs({ niche: seller.niche, description: seller.confirmed_product_description, brand: seller.brand, audience: seller.audience }).intent === "DUE_DILIGENCE_SYSTEM";
}

function dueDiligencePromptSpecs(seller: ReturnType<typeof sellerMeta>, categories: string[]): PromptSpec[] {
  const cats = categories.slice(0, seller.prompt_count);
  const vars = ["business_context", "seller_claims", "available_documents", "risk_tolerance", "questions_to_verify"];
  return cats.map((title, i) => ({
    id: `dd-${String(i + 1).padStart(2, "0")}`,
    title,
    category: "Due Diligence",
    target_user: seller.audience,
    use_case: `Membantu buyer menilai aspek ${title.toLowerCase()} sebelum akuisisi bisnis kecil.`,
    purpose: `Menyusun ${title.toLowerCase()} yang konkret untuk due diligence awal, tanpa memberi nasihat hukum/finansial final.`,
    when_to_use: i < 3 ? "Di tahap awal screening bisnis yang ingin dibeli." : i < 8 ? "Saat buyer mulai memeriksa klaim penjual dan risiko operasional." : "Sebelum membuat ringkasan risiko dan berdiskusi dengan profesional.",
    beginner_mode: "Isi konteks bisnis, klaim utama penjual, dokumen yang tersedia, dan hal yang belum jelas. Minta output berupa checklist dan pertanyaan verifikasi.",
    advanced_mode: "Tambahkan skenario downside, red flag, bukti yang perlu diminta, batasan data, serta pertanyaan lanjutan untuk akuntan/konsultan/hukum.",
    full_prompt: `Anda adalah analis due diligence awal untuk calon pembeli bisnis kecil. Bantu saya membuat ${title} untuk bisnis berikut:\n\nKonteks bisnis: {{business_context}}\nKlaim penjual: {{seller_claims}}\nDokumen/data tersedia: {{available_documents}}\nToleransi risiko buyer: {{risk_tolerance}}\nPertanyaan yang perlu diverifikasi: {{questions_to_verify}}\n\nBuat output dengan format:\n1. Tujuan pemeriksaan\n2. Data/bukti yang harus diminta\n3. Pertanyaan untuk pemilik bisnis\n4. Red flag yang perlu diwaspadai\n5. Cara verifikasi manual\n6. Ringkasan risiko: rendah/sedang/tinggi beserta alasan\n7. Catatan batasan: ini bukan nasihat hukum, pajak, investasi, atau finansial final.`,
    input_variables: vars,
    example_filled_input: "business_context: laundry kiloan dengan 2 cabang kecil; seller_claims: omzet stabil Rp60 juta/bulan; available_documents: rekap transaksi 6 bulan, daftar pelanggan, kontrak sewa; risk_tolerance: sedang; questions_to_verify: konsistensi omzet dan ketergantungan pelanggan besar",
    expected_output: "Checklist due diligence awal, pertanyaan wawancara seller, daftar bukti yang perlu diminta, red flag, dan ringkasan risiko awal.",
    quality_checklist: ["Pertanyaan spesifik ke bisnis yang dinilai", "Ada bukti/dokumen yang perlu diminta", "Ada red flag", "Ada batasan dan verifikasi manual", "Tidak memberi keputusan beli/tidak beli secara absolut"],
    common_mistakes: ["Langsung percaya klaim omzet", "Tidak mengecek repeat customer", "Mengabaikan kontrak sewa dan izin", "Menggunakan AI sebagai keputusan final"],
    safe_use_note: "Gunakan sebagai alat bantu riset awal. Untuk keputusan transaksi, konsultasikan dengan akuntan, pajak, hukum, atau advisor bisnis yang relevan.",
    output_type: "due-diligence-checklist",
  }));
}

function isAcademicCaseReportNiche(niche: string): boolean {
  return /(laporan kasus|case report|case reflection|clinical|klinis|keperawatan|medis|medical|ners|patient|pasien|asuhan keperawatan|evidence[-\s]?based)/i.test(niche);
}

function adapterBuyerProblem(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  if (adapter === "ACADEMIC_WRITING" && isAcademicCaseReportNiche(seller.niche)) {
    return "Mahasiswa kesehatan sering kesulitan menyusun laporan kasus klinis yang runtut, etis, berbasis bukti, dan aman secara sitasi. Tantangan utama biasanya ada pada penyusunan latar belakang, tinjauan pustaka, pembahasan klinis, refleksi, edukasi pasien, serta verifikasi sumber tanpa mengarang DOI, data, atau klaim medis.";
  }
  const map: Record<ResolvedAdapter, string> = {
    TEXT_TO_IMAGE: "Seller sering menghasilkan visual prompt yang terlalu umum sehingga gambar produk tampak tidak konsisten, salah aspect ratio, background terlalu ramai, atau memunculkan watermark dan artefak teks.",
    IMAGE_EDITING: "Seller/editor sering memberi instruksi edit foto yang terlalu kabur sehingga hasil retouch berubah berlebihan, warna produk tidak akurat, edge tampak halo, atau crop marketplace tidak aman.",
    TEXT_TO_VIDEO: "Creator sering membuat brief video pendek yang tidak punya hook 3 detik, shot list, durasi scene, camera movement, voiceover, dan CTA yang jelas.",
    ACADEMIC_WRITING: "Penulis akademik sering kesulitan menjaga struktur, logika argumen, etika sitasi, dan verifikasi sumber ketika memakai AI untuk menyusun draft.",
    RESEARCH: "Tim riset sering punya topik luas tetapi belum memiliki pertanyaan riset, desain instrumen, triangulasi sumber, dan batasan analisis yang jelas.",
    CONTENT_CREATION: "Creator sering membuat caption, hook, carousel, atau script yang generik, tidak konsisten dengan brand voice, dan terlalu bergantung pada klaim viral/FYP.",
    BUSINESS_MARKETING: "Seller sering punya offer yang menarik tetapi positioning, USP, sales page, funnel, email, dan objection handling masih tidak spesifik dan berisiko overclaim.",
    EVIDENCE_HANDBOOK: "Creator handbook/vault sering menyusun materi terlihat lengkap tetapi klaimnya tidak dipisahkan dari bukti, sumber belum diverifikasi, evidence level tidak jelas, dan risk/limitation sering hilang. Ini berbahaya terutama untuk topik kesehatan, suplemen, finansial, hukum, pendidikan, atau niche teknis.",
    READY_TO_SELL_PRODUCT: "Seller sering punya file produk digital yang isinya sudah ada, tetapi belum siap dijual karena belum punya cover, PDF product draft, listing marketplace, CTA/video prompt, delivery instruction, asset checklist, dan final QA upload.",
    CODING_AUTOMATION: "Builder sering langsung coding tanpa PRD, user flow, schema, auth role, API planning, automation workflow, dan testing checklist yang rapi.",
    CUSTOM: "Buyer sering membutuhkan prompt pack niche yang rapi tetapi input awal masih terlalu umum, variabel belum jelas, output format belum dikunci, dan QA gate belum tersedia.",
  };
  return map[adapter];
}

function adapterSolutionDetails(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string[] {
  if (adapter === "ACADEMIC_WRITING" && isAcademicCaseReportNiche(seller.niche)) {
    return [
      "Prompt akademik untuk menyusun judul, gap, latar belakang, tinjauan pustaka, struktur laporan kasus, pembahasan klinis, refleksi, edukasi pasien, dan QA final.",
      "Citation ethics guard: tidak membuat sitasi/DOI/sumber palsu dan selalu meminta pengguna memverifikasi sumber.",
      "Clinical safety guard: output hanya membantu struktur penulisan, bukan menggantikan diagnosis, keputusan klinis, bimbingan dosen, atau kebijakan institusi.",
      "Sample Input/Output dibuat spesifik untuk laporan kasus klinis, bukan contoh akademik umum seperti R&D/e-LKPD.",
    ];
  }
  const map: Record<ResolvedAdapter, string[]> = {
    TEXT_TO_IMAGE: ["Final image prompts dengan lighting, lens, background, composition, aspect ratio, dan negative prompt.", "Thumbnail/social visual guidance untuk marketplace dan konten.", "QA checklist untuk mencegah watermark, blur, distorted text, extra objects, dan wrong material."],
    IMAGE_EDITING: ["Brief retouch konkret untuk background cleanup, object cleanup, lighting correction, color correction, crop, export spec.", "Before-after edit brief dan style consistency guard.", "QA checklist agar edit tidak mengubah bentuk, warna, dan klaim visual produk."],
    TEXT_TO_VIDEO: ["Hook 3 detik, scene breakdown, shot list, camera movement, transition, voiceover, storyboard, CTA.", "Durasi per scene dan pacing prompt yang siap dipakai untuk short-form video.", "No guaranteed viral/FYP guard."],
    ACADEMIC_WRITING: ["Prompt title/gap, introduction, literature review, methodology, results-discussion, abstract, paraphrase, citation ethics, limitation, final QA.", "No fake citation/DOI guard dan verifikasi sumber manual.", "Struktur academic draft siap direview, bukan jasa joki."],
    RESEARCH: ["Research question framing, literature mapping, triangulation, interview guide, survey design, thematic analysis, insight synthesis.", "Limitation dan no fabricated data guard.", "Framework riset yang dapat direview manual."],
    CONTENT_CREATION: ["Hook, caption, carousel, short video script, calendar, storytelling angle, brand voice, repurposing, engagement prompt.", "No guaranteed viral/FYP/engagement guard.", "Content QA untuk brand consistency."],
    BUSINESS_MARKETING: ["Positioning, USP, sales page, funnel, email sequence, objection handling, pricing angle, campaign, lead magnet.", "No guaranteed sales/conversion/revenue guard.", "Ethical marketing checklist."],
    EVIDENCE_HANDBOOK: ["Evidence-based handbook/vault builder untuk topik apa pun: suplemen, riset, pendidikan, productivity, market guide, atau domain expert reference.", "Evidence Table, Source Verification Log, Claim Strength Grading, Risk/Contraindication/Limitation, Myth vs Evidence, FAQ, dan Update Log.", "No fake source/DOI/data guard; semua klaim wajib diberi status sumber dan batasan sebelum dipakai/dijual."],
    READY_TO_SELL_PRODUCT: ["Productization workflow untuk mengubah file/draft/ZIP menjadi paket siap upload manual.", "Cover Generation Brief, Marketing Video CTA Prompt, Complete PDF Product Draft, Marketplace Upload Asset Kit, dan final sell-ready checklist.", "No overclaim guard: tidak ada jaminan sales, traffic, approval, income, atau klaim sensitif tanpa verifikasi."],
    CODING_AUTOMATION: ["PRD, requirement interview, user flow, database schema, auth/role, frontend pages, backend/API logic, automation, testing/deployment.", "No secrets and security review guard.", "MVP scope control."],
    CUSTOM: ["Prompt system niche dengan variables, output format, example input, QA checklist, dan safe use note.", "Custom mode inference untuk formula pack, corporate prompts, seller OS, atau productivity planner.", "Manual review and no overclaim guard."],
  };
  return map[adapter];
}

function productBrief(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[]): string {
  const due = isDueDiligenceSystem(seller);
  if (due) {
    return [
      `# Product Brief — ${seller.brand}`,
      "",
      `**Nama Produk:** ${seller.brand}`,
      `**Niche:** ${seller.niche}`,
      `**Target Audiens:** ${seller.audience}`,
      `**Jumlah Prompt:** ${seller.prompt_count}`,
      `**Lisensi:** ${seller.license}`,
      "",
      "## Product Promise",
      "Paket ini membantu calon pembeli bisnis kecil melakukan due diligence awal secara lebih terstruktur sebelum membeli usaha. Buyer dapat menyusun pertanyaan untuk pemilik bisnis, memetakan risiko operasional, mengecek konsistensi pendapatan dasar, menilai ketergantungan pelanggan, dan merangkum red flag sebelum berkonsultasi dengan profesional.",
      "",
      "## Masalah Buyer",
      "Calon pembeli bisnis kecil sering menerima informasi dari penjual yang belum lengkap: omzet belum tervalidasi, catatan transaksi sederhana, pelanggan utama tidak jelas, risiko operasional tersembunyi, dan dokumen penting belum tertata. Tanpa kerangka due diligence, buyer mudah melewatkan pertanyaan penting sebelum transaksi.",
      "",
      "## Solusi Produk",
      seller.confirmed_product_description,
      "",
      "## Apa yang Didapat Buyer",
      mdList(["10 prompt due diligence awal", "PromptLibrary CSV dengan variabel dan contoh input", "Usage guide untuk workflow pemula dan advanced", "Sample input-output untuk skenario bisnis kecil", "Product handbook / playbook", "Buyer output review checklist", "FAQ penggunaan dan batasan aman"]),
      "",
      "## Untuk Siapa",
      mdList([seller.audience, "Buyer yang ingin menyiapkan pertanyaan sebelum bertemu pemilik usaha", "Konsultan bisnis pemula yang butuh kerangka audit awal", "Entrepreneur yang ingin memetakan risiko sebelum meminta bantuan profesional"]),
      "",
      "## Tidak Cocok Untuk",
      mdList(["Pengguna yang mencari nasihat hukum, pajak, investasi, atau finansial final", "Pengguna yang ingin jaminan bisnis aman dibeli", "Pengguna yang tidak mau melakukan verifikasi dokumen dan wawancara manual"]),
      "",
      "## Catatan Aman",
      "Produk ini bukan nasihat hukum, finansial, investasi, pajak, atau valuasi resmi. Output AI harus diverifikasi manual dan sebaiknya dibawa ke profesional terkait sebelum transaksi.",
    ].join("\n");
  }
  return [`# Product Brief — ${seller.brand}`, "", `**Nama Produk:** ${seller.brand}`, `**Niche:** ${seller.niche}`, `**Target Audiens:** ${seller.audience}`, `**Jumlah Prompt:** ${seller.prompt_count}`, `**Lisensi:** ${seller.license}`, "", "## Product Promise", seller.confirmed_product_description, "", "## Masalah Buyer", `Buyer di niche ${seller.niche} sering membutuhkan workflow yang lebih terstruktur, contoh konkret, dan checklist review agar output AI tidak terlalu umum.`, "", "## Apa yang Didapat Buyer", mdList(["PromptBook dengan mode pemula dan advanced", "PromptLibrary CSV", "Usage Guide", "Sample Input/Output", "Product Handbook", "QC Scorecard buyer-facing", "Buyer FAQ"]), "", "## Catatan Aman", "Tidak ada jaminan hasil bisnis, pendapatan, approval marketplace, atau performa tertentu. Semua output perlu direview manual."].join("\n");
}


function promptBook(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, promptCategories?: string[]): string {
  const intent = detectProductIntentFromInputs({ niche: seller.niche, description: seller.confirmed_product_description, brand: seller.brand, audience: seller.audience, adapter });
  const prompts = intent.intent === "DUE_DILIGENCE_SYSTEM" ? dueDiligencePromptSpecs(seller, promptCategories || intent.promptCategories) : buildPromptLibrary(intent.recommendedAdapter || adapter, seller.niche, seller.prompt_count, seller.audience, seller.tone);
  const lines = [`# PromptBook — ${seller.brand}`, "", `Intent: ${intent.intent} • Niche: ${seller.niche} • Tone: ${seller.tone}`, `Prompt count: ${prompts.length}`, ""];
  prompts.slice(0, seller.prompt_count).forEach((prompt, index) => {
    lines.push(`<!-- PROMPT_ANCHOR:id:${prompt.id} -->`, `## ${index + 1}. ${prompt.title}`, `**Purpose:** ${prompt.purpose}`, `**Best For:** ${prompt.target_user}`, `**When to Use:** ${prompt.when_to_use}`, `**Beginner Mode:** ${prompt.beginner_mode}`, `**Advanced Mode:** ${prompt.advanced_mode}`, "**Full Prompt:**", "```", prompt.full_prompt, "```", `**Input Variables:** ${prompt.input_variables.map((v) => `{{${v}}}`).join(", ")}`, "**Example Filled Input:**", "```", prompt.example_filled_input, "```", `**Expected Output:** ${prompt.expected_output}`, "**Quality Checklist:**");
    prompt.quality_checklist.forEach((item) => lines.push(`- [ ] ${item}`));
    lines.push("**Common Mistakes:**");
    prompt.common_mistakes.forEach((item) => lines.push(`- ${item}`));
    lines.push(`**Safe Use Note:** ${prompt.safe_use_note}`, "");
  });
  return lines.join("\n");
}


function promptLibraryCsv(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, promptCategories?: string[]): string {
  const intent = detectProductIntentFromInputs({ niche: seller.niche, description: seller.confirmed_product_description, brand: seller.brand, audience: seller.audience, adapter });
  const prompts = intent.intent === "DUE_DILIGENCE_SYSTEM" ? dueDiligencePromptSpecs(seller, promptCategories || intent.promptCategories) : buildPromptLibrary(intent.recommendedAdapter || adapter, seller.niche, seller.prompt_count, seller.audience, seller.tone);
  const escape = (value: string) => `"${String(value || "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  return ["id,title,prompt,variables,sample_input,notes", ...prompts.slice(0, seller.prompt_count).map((p, i) => [i + 1, escape(p.title), escape(p.full_prompt), escape(p.input_variables.map((v) => `{{${v}}}`).join("; ")), escape(p.example_filled_input), escape(`${p.purpose} Safe note: ${p.safe_use_note}`)].join(","))].join("\n");
}


function usageGuide(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  const due = isDueDiligenceSystem(seller);
  return [
    `# Usage Guide — ${seller.brand}`,
    "",
    `Panduan ini membantu buyer memakai paket **${seller.niche}** secara terstruktur.`,
    "",
    "## Quick Start",
    "1. Buka `Product_Handbook.pdf` untuk gambaran lengkap.",
    "2. Pilih prompt dari `02_PromptBook.md` sesuai tahap kerja.",
    "3. Isi variabel dengan konteks bisnis, data, dokumen, dan batasan yang nyata.",
    "4. Jalankan prompt di ChatGPT, Claude, Gemini, atau tool AI teks lain.",
    "5. Review output menggunakan `QC_Scorecard.md`.",
    "",
    "## Beginner Workflow",
    due ? "1. Mulai dari Acquisition Goal Clarifier agar tujuan akuisisi jelas." : "1. Mulai dari prompt pertama yang paling dekat dengan kebutuhan Anda.",
    due ? "2. Lanjutkan ke Seller Interview Question Builder sebelum bertanya ke pemilik usaha." : "2. Isi variabel wajib dengan konteks singkat.",
    due ? "3. Gunakan Revenue Verification dan Operational Risk Mapping untuk menandai bukti yang perlu diminta." : "3. Jalankan prompt dan bandingkan hasil dengan sample.",
    due ? "4. Simpan semua red flag di Deal Assumption Register." : "4. Revisi input jika hasil terlalu umum.",
    due ? "5. Buat Risk Summary Report sebelum berdiskusi dengan profesional." : "5. Gunakan QC Scorecard sebelum output final.",
    "",
    "## Advanced Workflow",
    "1. Siapkan dokumen awal: ringkasan bisnis, rekap transaksi, daftar pelanggan, biaya operasional, kontrak sewa, izin, dan pertanyaan terbuka.",
    "2. Jalankan beberapa prompt sebagai workflow berurutan, bukan satu prompt terpisah.",
    "3. Tandai pernyataan penjual yang belum punya bukti.",
    "4. Pisahkan fakta, asumsi, red flag, dan hal yang perlu dikonsultasikan.",
    "5. Jangan gunakan output AI sebagai keputusan final transaksi.",
    "",
    "## Cara Mengisi Variabel",
    "Variabel ditandai dengan `{{nama_variabel}}`. Isi dengan data spesifik, bukan kalimat umum.",
    "",
    "## Batasan Aman",
    "Produk ini bukan nasihat hukum, finansial, pajak, investasi, valuasi, atau audit resmi. Gunakan sebagai alat bantu riset awal dan verifikasi semua output secara manual.",
  ].join("\n");
}


function sampleInputOutput(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  if (isDueDiligenceSystem(seller)) {
    return [`# Sample Input & Output — ${seller.brand}`, "", "Semua contoh bersifat synthetic dan harus diverifikasi manual. Produk ini bukan nasihat hukum, finansial, pajak, investasi, atau valuasi resmi.", "", "## Sample 1: Seller Interview Question Builder", "**Sample User Input:**", "```", "business_context: laundry kiloan dengan 2 cabang kecil; seller_claims: omzet stabil Rp60 juta/bulan; available_documents: rekap transaksi 6 bulan dan kontrak sewa; risk_tolerance: sedang; questions_to_verify: repeat customer, biaya operasional, dan alasan dijual", "```", "**Example AI Output:**", "```", "Pertanyaan utama: 1) Dari omzet Rp60 juta/bulan, berapa persen berasal dari 10 pelanggan terbesar? 2) Apakah ada bulan dengan penurunan transaksi signifikan? 3) Berapa biaya tetap per bulan termasuk sewa, gaji, listrik, deterjen, maintenance mesin? 4) Apakah mesin milik sendiri atau sewa? 5) Mengapa bisnis dijual sekarang?\nBukti yang diminta: rekap transaksi bulanan, daftar pelanggan anonim, tagihan biaya utama, kontrak sewa, daftar aset.\nRed flag: omzet hanya dari beberapa pelanggan, kontrak sewa hampir habis, mesin sering rusak, alasan jual tidak konsisten.", "```", "**Review Note:** Jangan langsung percaya angka omzet. Minta bukti transaksi dan cek konsistensi biaya.", "", "## Sample 2: Revenue Verification Checklist", "**Sample User Input:**", "```", "business_context: warung kopi kecil; seller_claims: profit bersih Rp18 juta/bulan; available_documents: catatan kas manual 4 bulan; risk_tolerance: rendah; questions_to_verify: margin, biaya bahan baku, dan repeat customer", "```", "**Example AI Output:**", "```", "Checklist verifikasi: 1) Pisahkan omzet, HPP, gaji, sewa, listrik, marketplace delivery, dan owner withdrawal. 2) Cocokkan catatan kas dengan mutasi rekening atau bukti transaksi. 3) Hitung margin per menu utama. 4) Cek apakah profit sudah memperhitungkan gaji owner. 5) Tandai gap data: catatan hanya 4 bulan, belum mencakup musim sepi/ramai.", "```", "**Review Note:** Output ini bukan audit keuangan. Gunakan untuk menyiapkan diskusi dengan akuntan atau advisor.", "", "## Sample 3: Risk Summary Report", "**Sample User Input:**", "```", "business_context: toko frozen food rumahan; seller_claims: 70% penjualan dari reseller; available_documents: daftar reseller dan omzet 6 bulan; risk_tolerance: sedang; questions_to_verify: customer dependency dan supplier risk", "```", "**Example AI Output:**", "```", "Risk Summary:\nOperational Risk: sedang, karena proses masih bergantung pada owner lama.\nCustomer Dependency: tinggi, karena 70% penjualan berasal dari reseller dan belum jelas apakah relasi berpindah ke buyer baru.\nSupplier Risk: sedang, perlu cek apakah supplier utama punya kontrak atau hanya hubungan informal.\nNext Step: minta data reseller anonim, histori pembelian, kontrak/komitmen supplier, dan rencana transisi 30-90 hari.", "```", "**Review Note:** Gunakan ringkasan ini sebagai bahan tanya lanjut, bukan keputusan final membeli bisnis."].join("\n");
  }
  return [`# Sample Input & Output — ${seller.brand}`, "", "## Sample 1: Basic Use", "**Sample User Input:**", "```", `niche: ${seller.niche}; audience: ${seller.audience}; goal: membuat output terstruktur`, "```", "**Example AI Output:**", "```", "Output disusun dalam format tujuan, input, langkah kerja, hasil yang diharapkan, dan checklist review.", "```", "", "## Sample 2: Advanced Use", "**Sample User Input:**", "```", "context: data tersedia terbatas; risk: output terlalu umum; format: checklist", "```", "**Example AI Output:**", "```", "Checklist dibuat dengan asumsi, data yang perlu ditambahkan, batasan, dan langkah verifikasi manual.", "```", "", "## Sample 3: QA Review", "**Sample User Input:**", "```", "output_to_review: draft AI; criteria: clarity, specificity, safety", "```", "**Example AI Output:**", "```", "Review: output cukup jelas, tetapi perlu contoh lebih spesifik dan catatan batasan. Tidak ada klaim hasil pasti.", "```"].join("\n");
}


function qualityChecklist(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  const coding = adapter === "CODING_AUTOMATION" ? [
    "## Checklist PRD", "- [ ] Goal dan non-goal jelas", "- [ ] Minimal 5 user story", "- [ ] Acceptance criteria terukur", "- [ ] Risiko dan asumsi tercantum", "",
    "## Checklist Database/Auth/API", "- [ ] Schema punya PK/FK dan index", "- [ ] Role dan permission matrix jelas", "- [ ] Endpoint punya input/output dan auth required", "- [ ] Validasi server-side tertulis", "",
    "## Checklist Automation & Ops", "- [ ] Trigger workflow jelas", "- [ ] Retry/dead-letter/logging tersedia", "- [ ] Testing pre-launch, launch, post-launch lengkap", "- [ ] Rollback, backup, monitoring tercantum", "",
  ] : [];
  return [
    `# Quality Checklist — ${seller.brand}`,
    "",
    ...coding,
    "## Checklist Prompt Pack",
    "- [ ] Semua prompt punya purpose, when to use, full prompt, variables, expected output, dan safe use note.",
    "- [ ] Tidak ada prompt body duplikat.",
    "- [ ] CSV jumlah barisnya sesuai jumlah prompt.",
    "- [ ] Sample Input/Output minimal 3 contoh.",
    "",
    "## Checklist Klaim Aman",
    ...(adapter === "EVIDENCE_HANDBOOK" ? ["- [ ] Evidence Table berisi claim, source status, evidence level, limitation, dan verification status.", "- [ ] Tidak ada DOI, studi, penulis, tahun, dosis, angka, atau guideline yang dikarang.", "- [ ] Klaim kesehatan/keuangan/hukum diberi safety disclaimer dan source verification requirement.", "- [ ] Semua bagian yang belum punya sumber diberi label [SOURCE NEEDED] atau [VERIFY ORIGINAL].", ""] : []),
    "- [ ] Tidak menjanjikan income.",
    "- [ ] Tidak menjamin produk laku.",
    "- [ ] Tidak menjamin angka sales.",
    "- [ ] Tidak mengklaim marketplace-approved atau partner resmi.",
    "- [ ] Semua listing menyebut upload manual dan seller review required.",
  ].join("\n");
}

function licenseDisclaimer(seller: ReturnType<typeof sellerMeta>): string {
  return [
    `# License & Disclaimer — ${seller.brand}`,
    "",
    `**License Type:** ${seller.license}`,
    "",
    "## Allowed Use",
    "- Buyer boleh memakai prompt untuk proyek personal, internal, atau client sesuai lisensi yang dibeli.",
    "- Buyer boleh mengubah prompt agar sesuai kebutuhan proyek.",
    "- Buyer boleh memakai output AI yang dihasilkan setelah review manual.",
    "",
    "## Not Allowed",
    "- Buyer tidak boleh menjual ulang prompt pack ini secara utuh/as-is sebagai produk baru.",
    "- Buyer tidak boleh mengklaim sebagai partner resmi marketplace atau AI provider.",
    "- Buyer tidak boleh memakai materi ini untuk membuat klaim palsu, testimoni palsu, atau validasi pasar palsu.",
    "",
    "## Disclaimer",
    "Prompt ini adalah template dan heuristic. Kualitas output bergantung pada model AI, kualitas input, konteks, dan review manual. Tidak ada jaminan hasil, income, sales, approval marketplace, atau performa bisnis tertentu.",
    "",
    "## Marketplace Responsibility",
    "Seller dan buyer wajib memverifikasi kebijakan marketplace, AI provider ToS, dan aturan produk digital sebelum upload/publish.",
  ].join("\n");
}

function manualUploadGuide(marketplaces: string[]): string {
  const targets = marketplaces.length ? marketplaces : ["marketplace pilihan"];
  return [
    "# Manual Upload Guide",
    "",
    "## Packing File",
    "1. Pastikan semua file di 19_Marketplace_Bundle_Index.md atau 13_Ready_to_Upload_Checklist.md sudah lengkap.",
    "2. Kompres file buyer menjadi ZIP.",
    "3. Siapkan cover/thumbnail sesuai 11_Thumbnail_Brief.md.",
    "4. Simpan backup file sumber sebelum upload.",
    "",
    "## Upload Manual ke Marketplace",
    ...targets.map((mp) => `- **${mp}**: Login ke dashboard seller → buat produk digital/listing → upload ZIP atau link delivery → tempel draft listing → review kebijakan → publish manual.`),
    "",
    "## Policy Verification Reminder",
    "Verifikasi aturan produk digital, delivery file, refund, deskripsi, kategori, dan tag di marketplace tujuan sebelum publish.",
    "",
    "## No Automatic Publishing",
    "Sistem ini tidak memakai API marketplace dan tidak melakukan auto-publish. Semua upload dilakukan manual oleh seller.",
  ].join("\n");
}

function buyerFAQ(seller: ReturnType<typeof sellerMeta>): string {
  if (isDueDiligenceSystem(seller)) {
    return [`# Buyer FAQ — ${seller.brand}`, "", "## 1. Apa produk ini?", "Paket prompt untuk membantu calon pembeli bisnis kecil melakukan due diligence awal secara lebih terstruktur sebelum membeli usaha.", "", "## 2. Apakah ini nasihat hukum atau finansial?", "Tidak. Produk ini bukan nasihat hukum, finansial, pajak, investasi, valuasi, atau audit resmi. Gunakan sebagai alat bantu riset awal.", "", "## 3. Data apa yang perlu saya siapkan?", "Siapkan konteks bisnis, klaim penjual, dokumen yang tersedia, rekap transaksi, daftar aset, biaya operasional, kontrak, izin, dan pertanyaan yang belum terjawab.", "", "## 4. Apakah produk ini bisa menentukan bisnis layak dibeli?", "Tidak. Produk ini membantu menyusun pertanyaan, checklist, dan ringkasan risiko. Keputusan transaksi tetap memerlukan verifikasi manual dan saran profesional.", "", "## 5. Cocok untuk pemula?", "Ya. Setiap prompt memiliki beginner mode, contoh input, expected output, common mistakes, dan safe use note.", "", "## 6. Tool AI apa yang bisa dipakai?", "ChatGPT, Claude, Gemini, atau tool AI teks lain.", "", "## 7. Boleh dipakai untuk client?", `Boleh sesuai lisensi ${seller.license}, tetapi output harus direview dan disesuaikan dengan konteks client.`, "", "## 8. Apakah boleh dijual ulang?", "Tidak boleh menjual ulang file asli/as-is sebagai paket yang sama. Gunakan sesuai lisensi produk yang dibeli.", "", "## 9. Bagaimana jika output AI terlalu umum?", "Tambahkan data lebih spesifik: jenis bisnis, lokasi, klaim penjual, dokumen tersedia, risiko yang dikhawatirkan, dan format ringkasan yang diinginkan.", "", "## 10. Apa batasan paling penting?", "AI dapat membantu menyusun kerangka, tetapi tidak dapat menggantikan audit, legal review, tax review, financial due diligence, atau keputusan bisnis profesional."].join("\n");
  }
  return [`# Buyer FAQ — ${seller.brand}`, "", "## 1. Apa produk ini?", `Paket prompt sistem untuk ${seller.niche}.`, "", "## 2. Apa yang saya dapat?", "PromptBook, PromptLibrary CSV, Usage Guide, Sample Input/Output, Product Handbook, QC Scorecard, dan FAQ.", "", "## 3. Tool AI apa yang bisa dipakai?", "ChatGPT, Claude, Gemini, atau tool AI teks lain.", "", "## 4. Apakah ada jaminan hasil?", "Tidak. Output tetap perlu review manual."].join("\n");
}


function pricingRecommendation(seller: ReturnType<typeof sellerMeta>): string {
  const base = Math.max(49000, Math.round(seller.prompt_count * 7500));
  return [
    `# Pricing Recommendation — ${seller.brand}`,
    "",
    "## Pricing Method",
    "Rekomendasi ini bersifat heuristic only, bukan validasi pasar dan bukan jaminan sales. Seller tetap perlu riset kompetitor dan menyesuaikan harga dengan positioning, kualitas cover, bonus, serta support.",
    "",
    "## Suggested Tiers",
    `- Starter/Beta: Rp ${Math.round(base * 0.65).toLocaleString("id-ID")}`,
    `- Standard: Rp ${base.toLocaleString("id-ID")}`,
    `- Premium Bundle: Rp ${Math.round(base * 1.8).toLocaleString("id-ID")}`,
    "",
    "## Recommendation",
    `Untuk paket ${seller.prompt_count} prompt dengan sample, testing report, dan marketplace listing, rentang awal yang masuk akal adalah ${seller.target_price || "Rp 49.000–149.000"}.`,
    "",
    "## Disclaimer",
    "Harga ini heuristic only. Tidak ada jaminan income, penjualan, konversi, atau performa marketplace.",
  ].join("\n");
}

function thumbnailBrief(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  return [
    `# Thumbnail Brief — ${seller.brand}`,
    "",
    "## Concept",
    `Cover modern untuk paket prompt ${seller.niche} dengan kesan ${seller.tone.toLowerCase()}, rapi, dan teknis.`,
    "",
    "## Title Text",
    `${seller.prompt_count} AI Prompts untuk ${adapter === "CODING_AUTOMATION" ? "Web Fullstack Automation" : adapter === "EVIDENCE_HANDBOOK" ? "Evidence-Based Handbook / Vault" : seller.niche}`,
    "",
    "## Subtitle Text",
    "PromptBook + Sample + Checklist + Listing Draft",
    "",
    "## Visual Direction",
    "Gunakan layout clean, ikon code/bracket/dashboard, card mockup, dan badge 'Manual Upload Draft'. Hindari logo marketplace resmi kecuali diperbolehkan oleh kebijakan platform.",
    "",
    "## Color Direction",
    "Primary: biru/indigo gelap. Accent: cyan atau emerald. Background: putih/off-white atau dark tech gradient.",
    "",
    "## Shopee Cover Idea",
    "Gunakan judul besar, benefit 3 bullet, dan preview isi file. Pastikan teks tetap terbaca di ukuran kecil.",
    "",
    "## Lynk.id Cover Idea",
    "Gunakan hero cover seperti sales page: problem → solution → file bundle. Tambahkan CTA singkat tanpa klaim berlebihan.",
  ].join("\n");
}

function coverGenerationBrief(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  const isEvidence = adapter === "EVIDENCE_HANDBOOK" || /suplemen|supplement|health|kesehatan|medical|medis|clinical|klinis|finance|financial|hukum|legal/i.test(seller.niche);
  return [
    `# Cover Generation Brief — ${seller.brand}`,
    "",
    "## Purpose",
    "File ini membuat produk lebih siap jual: cover/thumbnail bisa langsung digenerate di tool image AI atau dibuat ulang di Canva/Figma.",
    "",
    "## Cover Positioning",
    `- Product: ${seller.brand} — ${seller.niche}`,
    `- Target Audience: ${seller.audience}`,
    `- Tone: ${seller.tone}`,
    `- Marketplace Target: Gumroad, Shopee/Tokopedia, Lynk.id, Etsy/Payhip/Lemon Squeezy sesuai pilihan seller`,
    "",
    "## Main Cover Text",
    `${seller.brand}`,
    "",
    "## Subtitle Options",
    mdList([
      `${seller.niche} — Ready-to-use digital product pack`,
      "PromptBook + Sample + Checklist + Marketplace Assets",
      adapter === "EVIDENCE_HANDBOOK" ? "Evidence table + source verification + claim safety workflow" : "Complete PDF draft + cover prompt + upload checklist",
    ]),
    "",
    "## Gumroad / Marketplace Cover Prompt",
    "```",
    `Create a premium digital product cover for "${seller.brand}" about "${seller.niche}". Style: modern premium, clean editorial layout, high contrast typography, subtle 3D ebook/handbook mockup, professional marketplace thumbnail, strong readable title, ${seller.tone.toLowerCase()} tone, dark/navy background with clean accent gradient, minimal icons related to the topic, no brand logos, no platform logos, no exaggerated claims. Include empty-safe margins for marketplace crop. Commercial digital product cover, Gumroad-ready, high-resolution, 4:3 cover composition.`,
    "```",
    "",
    "## Negative Prompt",
    "```",
    "blurry, low resolution, unreadable text, distorted typography, fake logos, official marketplace badge, guaranteed income claim, exaggerated medical claim, cluttered layout, messy mockup, watermark, typo, random text, illegible letters",
    "```",
    "",
    "## Canva/Figma Layout Direction",
    mdList([
      "Canvas: 1600×1200 px for Gumroad/discovery preview; export PNG high quality.",
      "Main title must be readable at small size.",
      "Use 1 hero mockup: ebook, PDF stack, dashboard card, or handbook mockup.",
      "Use max 3 benefit bullets on cover.",
      "Avoid official logos unless you own or have permission.",
      "Add a small badge: Manual Upload Draft / Digital Product Pack / Evidence-Safe Workflow depending on niche.",
    ]),
    "",
    "## Marketplace Thumbnail Variants",
    "### Gumroad / Payhip / Lemon Squeezy",
    "Wide premium cover, large title, mockup, concise subtitle, visible at search result size.",
    "",
    "### Shopee / Tokopedia",
    "Square or 4:5 crop-safe version, less text, high contrast, title + 2 benefits only.",
    "",
    "### Etsy",
    "Cleaner mockup, more white space, product bundle preview, fewer claims.",
    "",
    ...(isEvidence ? [
      "## Sensitive Topic Safety Overlay",
      "For health/finance/legal/academic evidence products, do NOT put dosage, cure, diagnosis, income, legal guarantee, or strong outcome claims on the cover. Use safer wording such as: 'Evidence workflow', 'source verification', 'claim checker', or 'educational reference framework'.",
      "",
    ] : []),
    "## Final Cover QA",
    mdList([
      "Title readable at 25% zoom.",
      "No forbidden claim.",
      "No fake official badge.",
      "No platform logo misuse.",
      "Cover matches actual product contents.",
      "Export PNG/JPG and store in seller-marketplace-pack/assets/ when ready.",
    ]),
  ].join("\n");
}

function marketingVideoCtaPrompt(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  return [
    `# Marketing Video CTA Prompt — ${seller.brand}`,
    "",
    "## Purpose",
    "File ini opsional. Gunakan untuk membuat video CTA/marketing seperti Gumroad preview, TikTok/Reels, Shorts, atau marketplace teaser. Ini prompt/script, bukan file video jadi.",
    "",
    "## 15-Second Product Teaser Prompt",
    "```",
    `Create a 15-second marketing video concept for a digital product named "${seller.brand}" in the niche "${seller.niche}". Audience: ${seller.audience}. Tone: ${seller.tone}. Structure: 0-3s problem hook, 3-7s show product contents, 7-12s show benefits without overclaiming, 12-15s soft CTA. Visual style: premium digital product mockup, scrolling PDF pages, checklist cards, prompt library CSV preview, marketplace-ready cover. CTA: "Preview the pack and decide if it fits your workflow." Do not claim guaranteed income, guaranteed results, guaranteed approval, medical cure, or fake credentials.`,
    "```",
    "",
    "## Scene Breakdown",
    mdList([
      "0–3s Hook: show the painful before-state related to the niche.",
      "3–7s Product Reveal: show PDF cover, PromptBook, CSV, sample output, checklist.",
      "7–12s Practical Benefit: show how buyer uses the pack step-by-step.",
      "12–15s CTA: soft CTA with product mockup and marketplace page preview.",
    ]),
    "",
    "## Voiceover Script Option",
    "```",
    `Kalau kamu punya ide produk digital tapi masih mentah, ${seller.brand} membantu merapikan isi, cover direction, prompt library, sample output, dan checklist upload manual. Ini bukan jaminan hasil — ini workflow siap review agar produkmu lebih rapi sebelum dipublish.`,
    "```",
    "",
    "## Text Overlay Options",
    mdList([
      "Turn messy ideas into a structured digital product pack",
      "PromptBook + CSV + Sample Output + Upload Checklist",
      "Manual upload only — seller review required",
      "Preview the pack before publishing",
    ]),
    "",
    "## Negative / Forbidden Claims",
    mdList([
      "Do not say: guaranteed sales, guaranteed viral, guaranteed income, guaranteed approved.",
      "Do not say: cures, treats, diagnoses, legal/financial guarantee, fake DOI/source.",
      "Do not use official marketplace logos unless permitted.",
    ]),
    "",
    "## Output Format for AI Video Tools",
    "Use this as source prompt for Runway/Sora/Veo/Pika or as brief for manual editing. Add your own product screenshots after reviewing all content.",
  ].join("\n");
}

function completePdfProductDraft(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[]): string {
  if (isDueDiligenceSystem(seller)) {
    return [`# ${seller.brand}`, "## Product Handbook / Buyer Playbook", "", "# Cover", `${seller.brand}`, `${seller.niche}`, `For: ${seller.audience}`, `License: ${seller.license}`, "", "## Product Promise", "This handbook helps small business buyers structure early-stage due diligence before acquiring a small business. It helps users prepare seller questions, request evidence, map risks, identify red flags, and organize findings before consulting legal, financial, tax, or business professionals.", "", "## Why Due Diligence Matters", "Small business acquisitions often rely on informal records, owner explanations, simple bookkeeping, and relationship-based operations. A buyer needs a structured way to separate claims, evidence, assumptions, risks, and next steps before making a decision.", "", "## Who This Helps", mdList([seller.audience, "first-time business acquisition buyers", "small business owners exploring acquisition", "consultants helping clients structure preliminary checks"]), "", "## System Overview", "Use the prompts as a sequence: clarify acquisition goals, interview the seller, map the business model, verify revenue, identify operational risks, review customer/supplier dependency, scan red flags, list legal document questions, register assumptions, and summarize risk.", "", "## Beginner Workflow", mdList(["Start with Acquisition Goal Clarifier", "Use Seller Interview Question Builder", "Request evidence listed by the prompts", "Mark every unverified claim", "Summarize risks with QC_Scorecard.md"]), "", "## Advanced Workflow", mdList(["Run all prompts as a sequential due diligence workflow", "Separate facts, seller claims, assumptions, red flags, and professional questions", "Compare revenue claims with available documents", "Create a transition-risk list for the first 30-90 days", "Bring the summary to accounting/legal/tax/business advisors"]), "", "## Core Due Diligence Prompt System", mdList((detectProductIntentFromInputs({ niche: seller.niche, description: seller.confirmed_product_description, brand: seller.brand, audience: seller.audience }).promptCategories).slice(0, seller.prompt_count)), "", "## Example 1: Buying a Small Coffee Shop", "Input: Seller claims stable monthly profit, but documents are only four months of manual notes. Output should request transaction evidence, cost breakdown, lease status, supplier dependency, owner salary adjustment, and seasonality limitation.", "", "## Example 2: Buying a Laundry Business", "Input: Two branches, claimed recurring customers, equipment included. Output should check customer concentration, equipment condition, maintenance cost, lease terms, employee dependency, and transition plan.", "", "## Red Flag Checklist", mdList(["Revenue claim cannot be tied to evidence", "Profit excludes owner salary or hidden costs", "One or two customers dominate revenue", "Lease/permit status unclear", "Supplier terms are informal", "Seller reason for exit is inconsistent", "Operations depend heavily on current owner"]), "", "## Manual Verification Guide", "Never treat AI output as verified fact. Ask for documents, compare claims across sources, interview the seller, observe operations if possible, and consult professionals before signing or transferring funds.", "", "## FAQ", "This is a research and decision-support toolkit. It is not legal, financial, tax, valuation, investment, or audit advice.", "", "## License and Safe Use", `License: ${seller.license}. Do not resell the original files as-is. Outputs must be reviewed manually. Results vary based on input quality and available evidence.`, "", "## Final Notes", "The goal is not to make the decision for the buyer. The goal is to make the buyer's questions, evidence requests, and risk summary more structured before seeking professional advice."].join("\n");
  }
  return [`# ${seller.brand}`, "## Product Handbook / Buyer Playbook", "", "## Product Promise", seller.confirmed_product_description, "", "## System Overview", `This product helps ${seller.audience} use prompts for ${seller.niche} in a structured way.`, "", "## Workflow", mdList(["Read Product Brief", "Open PromptBook", "Fill variables", "Run prompt", "Review with QC Scorecard"]), "", "## Safe Use", "No guaranteed results. Review all output manually."].join("\n");
}


function marketplaceUploadAssetKit(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[]): string {
  return [
    `# Marketplace Upload Asset Kit — ${seller.brand}`,
    "",
    "## Purpose",
    "Copy-ready asset draft untuk upload manual ke Gumroad, Shopee, Tokopedia, Etsy, Payhip, Lemon Squeezy, Lynk.id, atau marketplace lain. Review ulang sebelum publish.",
    "",
    "## Product Title Options",
    mdList([
      `${seller.brand} — ${seller.niche}`,
      `${seller.niche} Digital Product Pack`,
      `${seller.brand}: PromptBook + PDF Draft + Marketplace Assets`,
    ]),
    "",
    "## Short Description",
    `${seller.brand} membantu ${seller.audience} menyusun ${seller.niche} secara lebih terstruktur dengan PromptBook, Sample Input/Output, Quality Checklist, cover prompt, complete PDF draft, dan marketplace upload guide.`,
    "",
    "## Long Description Structure",
    mdList([
      "Problem: jelaskan masalah buyer tanpa menakut-nakuti berlebihan.",
      "Solution: jelaskan isi paket dan workflow.",
      "What You Get: file-file dalam Buyer ZIP.",
      "How to Use: 3–5 langkah singkat.",
      "Who It Is For / Not For.",
      "License and Disclaimer.",
      "Manual upload/delivery note.",
    ]),
    "",
    "## Bullet Benefits",
    mdList([
      "PromptBook structured for practical use",
      "CSV prompt library for quick browsing",
      "Concrete sample input/output",
      "Complete PDF product draft source",
      "Cover generation brief",
      "Marketplace listing drafts",
      "Quality and safety checklist",
    ]),
    "",
    "## Tag Ideas",
    mdList(["prompt pack", "digital product", "AI prompts", "template", "Gumroad", "seller tools", seller.niche.toLowerCase()].filter(Boolean)),
    "",
    "## Pricing Note",
    `Suggested price should be tested manually. Current target price: ${seller.target_price || "use 10_Pricing_Recommendation.md"}. Do not claim guaranteed ROI or sales.`,
    "",
    "## Upload Checklist per Marketplace",
    ...((marketplaces.length ? marketplaces : ["Gumroad", "Shopee", "Tokopedia", "Etsy"]).map((mp) => `### ${mp}\n- [ ] Cover uploaded.\n- [ ] Buyer ZIP or delivery link tested.\n- [ ] Description pasted and reviewed.\n- [ ] Tags/categories selected.\n- [ ] License/disclaimer included.\n- [ ] No forbidden claims.\n`)),
    "## Final Policy Reminder",
    "This app does not publish automatically. Seller must manually upload, review marketplace policies, and verify claims before publishing.",
  ].join("\n");
}

function productManifestJson(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[], qc?: QCResult): string {
  const payload = buildManifestPayload({ brand: seller.brand, niche: seller.niche, adapter, marketplaces, promptCount: seller.prompt_count, language: seller.language, targetMarket: seller.target_market, license: seller.license });
  const enriched = {
    ...payload,
    architecture: PPA_V2_VERSION,
    qc_status: qc?.status ?? payload.qc_status,
    qc_score: qc?.score ?? null,
    qc_generated_at: qc?.generated_at ?? null,
    blocking_errors: qc?.blocking_errors ?? null,
    approval_enabled: qc?.approval_enabled ?? false,
    validation_policy: { manual_upload_only: true, no_real_ai_api: true, no_marketplace_api: true, no_api_modules: true, buyer_package_must_be_clean: true },
  };
  return JSON.stringify(enriched, null, 2);
}



function readyToUploadChecklist(seller: ReturnType<typeof sellerMeta>): string {
  return [
    `# Ready to Upload Checklist — ${seller.brand}`,
    "",
    "## File Completeness",
    ...REQUIRED_CORE_MODULES.map((m) => `- [ ] ${m.file}`),
    "",
    "## Content Review",
    "- [ ] Tidak ada placeholder, TODO, atau konten kosong.",
    "- [ ] PromptBook berisi prompt unik sesuai jumlah prompt.",
    "- [ ] CSV bisa dibuka di spreadsheet dan jumlah baris cocok.",
    "- [ ] Sample Input/Output berisi minimal 3 contoh konkret.",
    "- [ ] Pricing Recommendation menyebut heuristic only.",
    "- [ ] License Disclaimer melarang resell as-is.",
    "",
    "## Marketplace Review",
    "- [ ] Judul, deskripsi, harga, kategori, dan tag sudah dicek.",
    "- [ ] Tidak ada klaim income/sales/approval marketplace.",
    "- [ ] Upload manual dan seller review required tertulis.",
    "- [ ] Kebijakan marketplace terbaru sudah diverifikasi.",
  ].join("\n");
}

function assumptionRegister(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[]): string {
  const assumptions = [
    ["A-01", "Buyer memahami konsep dasar prompt dan dapat memakai tool AI generatif.", "NONCRITICAL", "medium", "Usage Guide dan FAQ menjelaskan cara pakai."],
    ["A-02", "Marketplace tujuan mengizinkan produk digital berbasis file/prompt dengan upload manual.", "CRITICAL", "high", "Seller wajib verifikasi kebijakan sebelum publish."],
    ["A-03", `Adapter ${adapter} sesuai dengan niche ${seller.niche}.`, "CRITICAL", "high", "Jika tidak sesuai, buat run baru dengan adapter yang tepat."],
    ["A-04", "Buyer tidak menganggap paket ini sebagai software jadi otomatis.", "NONCRITICAL", "medium", "FAQ menjelaskan bahwa ini prompt pack, bukan app builder otomatis."],
    ["A-05", "Output AI berbeda antar model dan akun pengguna.", "NONCRITICAL", "medium", "Disclaimer menyebut model dependency."],
    ["A-06", "Harga bersifat heuristic, bukan validasi pasar.", "NONCRITICAL", "medium", "Pricing file menyebut heuristic only."],
    ["A-07", "Seller melakukan review final sebelum upload.", "CRITICAL", "high", "Ready-to-upload checklist disediakan."],
    ["A-08", `Marketplace yang dipilih: ${marketplaces.join(", ") || "tidak ada"}.`, "NONCRITICAL", "low", "Listing hanya dibuat untuk marketplace terpilih."],
  ];
  return [`# Assumption Register — ${seller.brand}`, "", ...assumptions.map(([id, statement, type, impact, mitigation]) => [`## Assumption ${id}`, `**Statement:** ${statement}`, `**Type:** ${type}`, `**Impact:** ${impact}`, `**Status:** Pending seller review`, `**Mitigation:** ${mitigation}`, ""].join("\n"))].join("\n");
}

function qcScorecardTemplate(seller: ReturnType<typeof sellerMeta>, qc?: QCResult): string {
  return [
    `# Buyer Output Review Checklist — ${seller.brand}`,
    "",
    "Gunakan checklist ini untuk mengecek output AI sebelum dipakai dalam konteks nyata.",
    "",
    "## Input Completeness",
    mdList(["Konteks bisnis sudah jelas", "Klaim penjual ditulis terpisah dari fakta", "Dokumen yang tersedia disebutkan", "Batasan data ditulis", "Pertanyaan yang belum terjawab dicatat"]),
    "",
    "## Output Clarity",
    mdList(["Output menjawab tujuan prompt", "Format mudah dibaca", "Ada daftar bukti yang perlu diminta", "Ada red flag", "Ada langkah verifikasi manual"]),
    "",
    "## Due Diligence Safety",
    mdList(["Tidak menyimpulkan bisnis pasti aman dibeli", "Tidak memberi nasihat hukum/pajak/finansial final", "Tidak membuat angka atau dokumen palsu", "Tidak mengabaikan risiko operasional", "Menyarankan konsultasi profesional untuk keputusan transaksi"]),
    "",
    "## Revision Checklist",
    mdList(["Tambahkan data jika output terlalu umum", "Minta output membedakan fakta, asumsi, dan red flag", "Ulangi prompt dengan dokumen tambahan", "Bandingkan output dengan wawancara dan bukti nyata"]),
    "",
    "## Final Buyer Note",
    "Checklist ini membantu review kualitas output. Keputusan akhir tetap berada pada buyer dan profesional yang relevan.",
  ].join("\n");
}

export function generateSyncedManifestContent(args: { seller: SellerMeta; adapter?: string; marketplaces: string[]; qc: QCResult }): string {
  const seller = sellerMeta(args.seller);
  const adapter = resolveAdapter(args.adapter ?? "CUSTOM", seller.niche);
  return productManifestJson(seller, adapter, args.marketplaces, args.qc);
}

export function generateActualQCScorecardContent(args: { seller: SellerMeta; qc: QCResult }): string {
  return qcScorecardTemplate(sellerMeta(args.seller));
}


function marketplaceListing(fileName: string, seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[]): string {
  const marketplace = /Shopee/i.test(fileName) ? "Shopee"
    : /Tokopedia/i.test(fileName) ? "Tokopedia"
    : /Lynk/i.test(fileName) ? "Lynk.id"
    : /Gumroad/i.test(fileName) ? "Gumroad"
    : /Etsy/i.test(fileName) ? "Etsy"
    : /Envato/i.test(fileName) ? "Envato"
    : /LemonSqueezy/i.test(fileName) ? "LemonSqueezy"
    : /Payhip/i.test(fileName) ? "Payhip"
    : /Lemon/i.test(fileName) ? "Lemon Squeezy"
    : "Marketplace";
  if (fileName === "19_Marketplace_Bundle_Index.md") return marketplaceBundleIndex(seller, marketplaces);
  const adapterCopy: Record<ResolvedAdapter, { title: string; hook: string; description: string; benefits: string[]; faq: string[]; tags: string[] }> = {
    TEXT_TO_IMAGE: {
      title: `${seller.brand} — ${seller.prompt_count} AI Image Prompts untuk ${seller.niche}`,
      hook: "Buat prompt gambar produk yang lebih spesifik: lighting, background, composition, aspect ratio, dan negative prompt sudah dipandu.",
      description: `Paket ini membantu buyer membuat prompt visual untuk product photography, marketplace thumbnail, social media visual, moodboard brand, dan variasi gambar AI. Cocok untuk ${seller.audience}.`,
      benefits: ["Prompt gambar produk siap edit", "Negative prompt untuk mengurangi artifact", "Panduan lighting dan camera angle", "Aspect ratio untuk marketplace/social", "Sample output konkret"],
      faq: ["Apakah ini jasa desain? Tidak, ini prompt pack visual.", "Apakah hasil gambar dijamin sama? Tidak, hasil bergantung pada model AI dan input.", "Apakah boleh untuk produk sendiri? Bisa, selama Anda punya hak atas produk/brand."],
      tags: ["AI image prompt", "product photo", "visual prompt", "marketplace thumbnail"],
    },
    IMAGE_EDITING: {
      title: `${seller.brand} — ${seller.prompt_count} Image Editing Prompt Briefs untuk ${seller.niche}`,
      hook: "Ubah instruksi edit foto yang biasanya kabur menjadi brief konkret: background, cleanup, retouch, color, crop, dan export spec.",
      description: `Paket ini berisi prompt/brief editing untuk memperjelas kebutuhan retouch foto produk, background replacement, cleanup, color correction, dan resize marketplace. Cocok untuk ${seller.audience}.`,
      benefits: ["Brief before-after jelas", "Panduan cleanup dan retouch", "Crop/resize marketplace", "Color correction tetap menjaga warna asli", "Checklist QA final"],
      faq: ["Apakah ini mengedit foto otomatis? Tidak, ini brief/prompt editing.", "Apakah bisa untuk semua foto? Kualitas hasil bergantung pada file awal.", "Apakah boleh mengedit foto orang? Hanya dengan izin yang sah."],
      tags: ["image editing", "product retouch", "background removal", "photo brief"],
    },
    TEXT_TO_VIDEO: {
      title: `${seller.brand} — ${seller.prompt_count} AI Video Prompt Scripts untuk ${seller.niche}`,
      hook: "Bangun prompt video dengan hook 3 detik, scene breakdown, shot list, camera movement, transition, voiceover, dan CTA.",
      description: `Paket ini membantu buyer menyusun prompt video pendek untuk demo produk, iklan ringan, Reels/TikTok, dan storyboard visual. Tidak ada klaim viral/FYP.`,
      benefits: ["Hook 3 detik", "Scene dan durasi jelas", "Camera movement dan transition", "Voiceover direction", "CTA ending"],
      faq: ["Apakah menjamin viral? Tidak.", "Apakah ini file video jadi? Tidak, ini prompt/script video.", "Apakah musik/footage disediakan? Tidak, seller/buyer wajib memakai aset legal."],
      tags: ["video prompt", "shot list", "storyboard", "short video script"],
    },
    ACADEMIC_WRITING: {
      title: `${seller.brand} — Academic Writing Prompt Kit untuk ${seller.niche}`,
      hook: "Susun draft akademik dengan struktur, gap, metodologi, pembahasan, dan etika sitasi yang lebih aman.",
      description: `Paket ini membantu menyusun bagian akademik seperti latar belakang, literature review, metodologi, abstrak, paraphrase akademik, limitation, dan citation ethics. Bukan jasa joki dan tidak membuat DOI/sitasi palsu.`,
      benefits: ["Struktur akademik lebih rapi", "Citation ethics checker", "No fake DOI/source", "Paraphrase akademik", "Final academic QA"],
      faq: ["Apakah ini joki? Tidak.", "Apakah membuat referensi otomatis? Tidak, sumber harus diverifikasi pengguna.", "Apakah boleh untuk skripsi/jurnal? Bisa sebagai alat bantu draft etis."],
      tags: ["academic writing", "literature review", "citation ethics", "research paper"],
    },
    RESEARCH: {
      title: `${seller.brand} — Research Prompt Pack untuk ${seller.niche}`,
      hook: "Rancang riset lebih terstruktur: question framing, literature mapping, triangulasi, interview guide, survey, dan limitation.",
      description: `Paket ini membantu buyer menyusun desain riset, instrumen, analisis tematik, sintesis insight, dan QA report. Tidak mengarang data, narasumber, atau temuan.`,
      benefits: ["Research question lebih fokus", "Literature mapping", "Source triangulation", "Interview/survey guide", "Limitation register"],
      faq: ["Apakah data disediakan? Tidak.", "Apakah boleh membuat klaim riset? Hanya berdasarkan data/sumber valid.", "Apakah cocok untuk market research? Ya, dengan verifikasi manual."],
      tags: ["research prompt", "interview guide", "survey design", "triangulation"],
    },
    CONTENT_CREATION: {
      title: `${seller.brand} — Content Creation Prompt Kit untuk ${seller.niche}`,
      hook: "Buat hook, caption, carousel, script video pendek, calendar, storytelling angle, dan repurpose plan lebih cepat.",
      description: `Paket ini membantu content creator dan social media admin membuat ide konten yang lebih rapi dan konsisten. Tidak ada klaim pasti viral, FYP, reach, atau engagement.`,
      benefits: ["Hook dan caption", "Carousel outline", "Short video script", "Content calendar", "Brand voice variation"],
      faq: ["Apakah menjamin FYP? Tidak.", "Apakah caption langsung publish? Tetap perlu review brand voice.", "Apakah cocok untuk UMKM? Ya, terutama untuk struktur ide."],
      tags: ["content creation", "caption", "carousel", "social media prompts"],
    },
    BUSINESS_MARKETING: {
      title: `${seller.brand} — Marketing Prompt Pack untuk ${seller.niche}`,
      hook: "Bangun positioning, USP, sales page, funnel, email sequence, objection handling, pricing angle, dan campaign plan.",
      description: `Paket ini membantu buyer menyusun asset marketing secara etis dan terstruktur. Tidak menjamin sales, conversion, revenue, closing, atau income.`,
      benefits: ["Positioning dan USP", "Sales page outline", "Funnel map", "Email sequence", "Objection handling"],
      faq: ["Apakah menjamin penjualan? Tidak.", "Apakah ini strategi final? Ini draft yang perlu review dan testing.", "Apakah boleh untuk client? Sesuai lisensi dan review manual."],
      tags: ["marketing prompt", "sales page", "funnel", "email sequence"],
    },
  
    READY_TO_SELL_PRODUCT: {
      title: `${seller.brand} — Ready-to-Sell Product Pack untuk ${seller.niche}`,
      hook: "Ubah draft/ZIP produk digital menjadi paket siap upload: cover prompt, PDF product draft, listing, CTA video prompt, delivery instructions, dan upload asset kit.",
      description: `Paket ini membantu seller menyiapkan ${seller.niche} menjadi produk digital yang lebih siap dijual di Gumroad, Shopee, Tokopedia, Etsy, Payhip, Lynk.id, atau marketplace lain. Output tetap manual upload, bukan auto-publish, dan semua klaim harus direview sebelum publish.`,
      benefits: ["Cover generation brief", "Complete PDF product draft", "Marketplace product page assets", "Marketing video CTA prompts", "Buyer delivery instructions", "Seller upload checklist", "No overclaim guard"],
      faq: ["Apakah ini membuat cover/PDF otomatis di aplikasi? Tidak, app membuat brief/prompt dan PDF source draft siap dirender manual.", "Apakah listing siap paste? Draft listing disediakan, tetapi seller wajib review kebijakan marketplace.", "Apakah menjamin penjualan? Tidak, tidak ada jaminan sales, conversion, atau traffic."],
      tags: ["ready to sell", "Gumroad product", "digital product pack", "cover prompt", "PDF product"],
    },

  CODING_AUTOMATION: {
      title: `${seller.brand} — ${seller.prompt_count} Fullstack Coding & Automation Prompts`,
      hook: "Ubah ide web app menjadi PRD, user flow, database schema, auth, API plan, automation workflow, testing, dan deployment checklist.",
      description: `Paket ini membantu developer/founder menyusun blueprint teknis React/Supabase/fullstack secara lebih rapi. Ini bukan software auto-build dan tidak menyertakan API marketplace.`,
      benefits: ["PRD generator", "Database schema planning", "Auth/role planning", "Backend/API logic", "Testing/deployment checklist"],
      faq: ["Apakah ini membuat app otomatis? Tidak, ini prompt/blueprint.", "Apakah perlu coding? Untuk implementasi, ya.", "Apakah aman untuk production? Harus direview dan diuji."],
      tags: ["coding prompts", "PRD", "database", "fullstack automation"],
    },
    EVIDENCE_HANDBOOK: {
      title: `${seller.brand} — Evidence-Based Handbook / Vault Builder untuk ${seller.niche}`,
      hook: "Bangun handbook, vault, atau reference guide yang lebih serius: evidence table, source log, claim checker, limitation, safety note, dan update log sudah dipandu.",
      description: `Paket ini membantu buyer menyusun handbook/vault berbasis referensi untuk ${seller.niche}. Cocok untuk suplemen, riset, edukasi, market guide, productivity, atau domain expert reference. Tidak membuat sumber, DOI, data, dosis, klaim medis/finansial/hukum, atau rekomendasi profesional secara otomatis.`,
      benefits: ["Handbook scope & reader promise", "Evidence table builder", "Source verification log", "Claim strength grading", "Risk/limitation/safety section", "No fake reference checker", "Update log/versioning"],
      faq: ["Apakah ini handbook jadi dengan referensi final? Tidak, ini prompt system dan framework; sumber asli wajib ditambahkan dan diverifikasi.", "Apakah boleh untuk suplemen/kesehatan? Bisa untuk struktur edukatif, tetapi tidak boleh memberi dosis/diagnosis/klaim medis tanpa sumber dan review profesional.", "Apakah boleh membuat DOI sendiri? Tidak. DOI, jurnal, guideline, data, dan angka tidak boleh dikarang."],
      tags: ["evidence handbook", "research vault", "source verification", "claim checker", "reference guide"],
    },
    CUSTOM: {
      title: `${seller.brand} — Custom Prompt Pack untuk ${seller.niche}`,
      hook: "Prompt pack custom yang disusun berdasarkan niche, audiens, output format, dan QA gate agar tidak generic.",
      description: `Paket ini membantu buyer membuat workflow prompt custom untuk ${seller.niche}. Gunakan sebagai draft, lalu review manual sebelum dijual atau dipakai untuk client.`,
      benefits: ["Custom prompt system", "Niche-specific workflow", "Example input/output", "QA checklist", "Safe use notes"],
      faq: ["Apakah ini generic? Tidak, harus disesuaikan dengan niche input.", "Apakah menjamin hasil? Tidak.", "Apakah bisa untuk berbagai kebutuhan? Bisa selama direview manual."],
      tags: ["custom prompts", "prompt engineering", "prompt pack", "digital product"],
    },
  };
  const copy = adapterCopy[adapter];
  return [
    `# Listing Draft — ${marketplace}`,
    "",
    "**Manual upload only.** Draft ini harus direview dan diunggah manual oleh seller. Tidak ada API marketplace dan tidak ada auto-publish.",
    "",
    "## Product Title",
    copy.title,
    "",
    "## Hero Hook",
    copy.hook,
    "",
    "## Product Description",
    seller.confirmed_product_description,
    copy.description,
    "",
    "## Buyer Problem",
    `Buyer di niche ${seller.niche} sering membutuhkan output yang lebih spesifik, tetapi prompt awal terlalu pendek dan hasil AI menjadi generik.`,
    "",
    "## Solution",
    `Paket ini menyediakan ${seller.prompt_count} prompt unik, PromptLibrary CSV, Sample Input/Output, Usage Guide, Quality Checklist, License Disclaimer, Pricing Recommendation, Thumbnail Brief, dan Manual Upload Guide.`,
    "",
    "## What Buyer Gets",
    mdList(copy.benefits.concat(["PromptBook lengkap", "PromptLibrary CSV", "Sample Input/Output", "License & Disclaimer", "Manual Upload Guide", "Buyer FAQ"])),
    "",
    "## Suggested Tags",
    mdList(copy.tags),
    "",
    "## Delivery Instructions",
    "Produk dikirim sebagai file digital/ZIP atau link unduhan yang seller kelola sendiri sesuai aturan marketplace.",
    "",
    "## FAQ",
    copy.faq.map((item) => `**${item.split("?")[0]}?** ${item.includes("?") ? item.split("?").slice(1).join("?").trim() : ""}`).join("\n"),
    "",
    "## Policy Reminder",
    `Verifikasi kebijakan ${marketplace} untuk produk digital sebelum publish manual.`,
    "",
    "## Disclaimer",
    "Tidak ada jaminan hasil bisnis. Tidak ada auto-publish. Tidak ada klaim official marketplace partner. Seller dan buyer wajib review manual.",
  ].join("\n");
}


function marketplaceBundleIndex(seller: ReturnType<typeof sellerMeta>, marketplaces: string[]): string {
  return [
    `# Marketplace Bundle Index — ${seller.brand}`,
    "",
    "## Marketplace Files Generated",
    ...marketplaceModulesFor(marketplaces).map((m) => `- ${m.file}`),
    "",
    "## Recommended Upload Order",
    "1. Review product ZIP and license.",
    "2. Prepare thumbnail/cover.",
    "3. Copy listing draft for selected marketplace.",
    "4. Verify policy and publish manually.",
    "",
    "## Manual Upload Reminder",
    "Semua marketplace file adalah draft. Seller harus upload manual, mengecek kebijakan, dan mereview klaim sebelum publish.",
  ].join("\n");
}

// ---------- Premium Product Architecture v2: Seller Master Toolkit ----------

function platformVoice(platform: string): { tone: string; currency: string; lang: string } {
  const p = normalizeMarketplace(platform);
  if (p === "Shopee") return { tone: "SEO-heavy Bahasa Indonesia, short bullet-driven", currency: "IDR", lang: "id" };
  if (p === "Tokopedia") return { tone: "Formal e-commerce Bahasa Indonesia, emphasize file digital + manual download", currency: "IDR", lang: "id" };
  if (p === "Lynk.id") return { tone: "Creator-funnel, personal, direct CTA", currency: "IDR", lang: "id" };
  if (p === "Gumroad") return { tone: "Global storytelling, transformation-focused", currency: "USD", lang: "en" };
  if (p === "Etsy") return { tone: "Digital template positioning, tag-heavy, instant download wording (no platform-approval claims)", currency: "USD", lang: "en" };
  if (p === "Envato") return { tone: "Structured documentation, technical quality, organized files", currency: "USD", lang: "en" };
  if (p === "LemonSqueezy") return { tone: "SaaS-like product page, clean headline, conversion-focused, license clarity", currency: "USD", lang: "en" };
  return { tone: "Neutral", currency: "USD", lang: "en" };
}

function marketplaceAdapterCopy(platform: string, seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  const v = platformVoice(platform);
  const p = normalizeMarketplace(platform);
  const title = `${seller.brand} — ${seller.niche}`;
  const sub = adapter === "CODING_AUTOMATION"
    ? "PRD + Database Schema + Auth + API + Automation + Deployment Prompts"
    : adapter === "EVIDENCE_HANDBOOK"
      ? "Evidence Table + Source Log + Claim Checker + Safety Notes"
      : `${seller.prompt_count} structured prompts + sample + checklist`;
  return [
    `### ${p}`,
    `**Voice / Tone:** ${v.tone}`,
    `**Suggested Currency:** ${v.currency}`,
    "",
    `**Title:** ${title} — ${sub}`,
    `**Subtitle/Headline:** ${v.lang === "id"
      ? `Paket prompt terstruktur untuk ${seller.audience}. Upload manual, review seller, no fake claims.`
      : `Structured prompt system for ${seller.audience}. Manual delivery. Seller-reviewed. No income guarantee.`}`,
    "",
    "**Bullet Benefits:**",
    "- " + (v.lang === "id" ? "PromptBook lengkap (purpose, full prompt, contoh input/output, checklist QA)" : "Premium PromptBook with purpose, full prompt, examples, QA checklist"),
    "- " + (v.lang === "id" ? "CSV PromptLibrary siap dibuka di spreadsheet" : "CSV PromptLibrary opens in any spreadsheet"),
    "- " + (v.lang === "id" ? "Sample Input/Output untuk pemula dan advanced" : "Sample Input/Output for beginner and advanced users"),
    "- " + (v.lang === "id" ? "Usage Guide + Buyer FAQ" : "Usage Guide + Buyer FAQ"),
    "- " + (v.lang === "id" ? "Premium PDF Handbook" : "Premium PDF Handbook"),
    "",
    "**Full Description:**",
    v.lang === "id"
      ? `${seller.confirmed_product_description}\n\nPaket ini membantu ${seller.audience} menyusun ${seller.niche} secara terstruktur menggunakan ${seller.prompt_count} prompt yang sudah dipasangkan dengan contoh input/output, panduan pemakaian, FAQ, premium PDF handbook, dan QC scorecard. Semua file dikirim sebagai file digital, dengan upload manual oleh seller. Tidak ada klaim penjualan, viral, atau approval marketplace.`
      : `${seller.confirmed_product_description}\n\nThis pack helps ${seller.audience} build ${seller.niche} workflows using ${seller.prompt_count} prompts paired with worked examples, usage guide, FAQ, a premium PDF handbook, and a QC scorecard. Files are delivered digitally and listed manually by the seller. No sales/viral/marketplace approval claims are made.`,
    "",
    `**Keywords / Tags:** ${v.lang === "id" ? "prompt pack, prompt AI, " : "ai prompts, prompt pack, "}${seller.niche.toLowerCase()}, ${adapter.toLowerCase().replace(/_/g, " ")}, ${p.toLowerCase()}`,
    `**Suggested Category:** Digital Goods / Templates / AI Prompts`,
    "",
    "**Upload Checklist:**",
    "- [ ] Cover image disiapkan sesuai brief.",
    "- [ ] Buyer ZIP atau link delivery tested.",
    "- [ ] Description direview tanpa klaim terlarang.",
    "- [ ] Tags / category dipilih sesuai aturan platform.",
    "- [ ] License & disclaimer disertakan.",
    "- [ ] Kebijakan platform terbaru sudah dicek.",
    "",
    "**Recommended Image Order:**",
    "1. Hero cover (title + subtitle + 3 benefit bullets)",
    "2. File map mockup (preview isi folder)",
    "3. PromptBook page preview",
    "4. Sample Input/Output preview",
    "5. PDF Handbook cover preview",
    "",
    `**Platform-Specific Positioning:** ${v.tone}.`,
    "",
  ].join("\n");
}

function sellerMasterToolkit(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[]): string {
  const mps = (marketplaces ?? []).map(normalizeMarketplace);
  const base = Math.max(49000, Math.round(seller.prompt_count * 7500));
  return [
    `# Seller Master Toolkit — ${seller.brand}`,
    "",
    "> Konsolidasi semua materi seller-side: pricing, brief visual, video CTA, dan listing per marketplace. **File ini tidak boleh dimasukkan ke Buyer ZIP.**",
    "",
    "## 1. Seller Overview",
    `- **Product Name:** ${seller.brand}`,
    `- **Niche:** ${seller.niche}`,
    `- **Target Buyer:** ${seller.audience}`,
    `- **Product Format:** Digital pack (Markdown + CSV + premium PDF handbook)`,
    `- **License:** ${seller.license}`,
    `- **Marketplace Targets:** ${mps.join(", ") || "—"}`,
    `- **Recommended Positioning:** Premium digital product system (PromptBook + PDF handbook + seller toolkit). Manual upload only.`,
    "",
    "## 2. Pricing Recommendation",
    `- **Starter (IDR):** Rp ${Math.round(base * 0.65).toLocaleString("id-ID")}`,
    `- **Standard (IDR):** Rp ${base.toLocaleString("id-ID")}`,
    `- **Premium (IDR):** Rp ${Math.round(base * 1.8).toLocaleString("id-ID")}`,
    `- **Bundle (IDR):** Rp ${Math.round(base * 2.6).toLocaleString("id-ID")}`,
    `- **Standard (USD):** $${Math.max(9, Math.round((base / 15500) * 1.0))}`,
    `- **Premium (USD):** $${Math.max(19, Math.round((base / 15500) * 1.8))}`,
    `- **Justification:** Heuristic dari jumlah prompt (${seller.prompt_count}), kompleksitas adapter (${adapter}), dan kelengkapan (PDF handbook, QC scorecard, multi-marketplace listing).`,
    "- **Note:** Pricing bersifat heuristic only dan wajib divalidasi manual lewat kompetitor + price test.",
    "",
    "## 3. Thumbnail Brief",
    "**5 Konsep Thumbnail:**",
    "1. Bold typography + file mockup di belakang.",
    "2. Hero cover dark editorial + 3 benefit bullets.",
    "3. Mockup laptop/tablet menampilkan PDF handbook.",
    "4. Split layout: problem (kiri) → solution (kanan).",
    "5. Badge \"Premium Product Architecture v2\" + nama produk.",
    "**Recommended First Image:** konsep 2 (hero cover + 3 benefit bullets) — paling kuat untuk thumbnail kecil.",
    "**Size:** 1200×1500 (Shopee/Tokopedia), 1280×800 (Gumroad/LemonSqueezy), 2000×2000 (Etsy/Envato).",
    "**Text Display:** judul produk, niche, 3 benefit, tag manual upload.",
    "**Visual Hierarchy:** judul → benefit → file mockup → CTA tipis.",
    "**Safe Notes:** jangan pakai logo resmi marketplace atau badge palsu.",
    "",
    "## 4. Cover Generation Brief",
    "**A4 PDF Cover Prompt:** Editorial premium book cover, niche-specific iconography, clean serif title, soft gradient background, no logos, no faces, A4 portrait.",
    "**Square Marketplace Cover Prompt:** 1:1 cover with bold title, subtitle, 3 benefit bullets, soft 3D mockup of a PDF and a CSV file, dark editorial palette.",
    "**Gumroad/Etsy Style Cover Prompt:** 4:3 hero shot with file-stack mockup, friendly typography, neutral background, leave bottom 20% empty for marketplace overlay.",
    "**Negative Prompt:** no logos, no marketplace badges, no celebrity faces, no fake \"#1 bestseller\" stickers, no copyrighted brand artwork.",
    "**Text That Must Appear:** product name, subtitle, manual-upload note.",
    "**Visual Style:** premium editorial, calm, high-contrast typography.",
    "",
    "## 5. Marketing Video CTA Script",
    "**15-second:**",
    "- 0–3s Hook: \"Stop selling raw prompts. Sell a system.\"",
    "- 3–9s Scene: mockup of files (PromptBook, CSV, PDF handbook, seller toolkit).",
    "- 9–12s Voiceover: \"Premium Product Architecture v2 — terstruktur dan siap upload manual.\"",
    "- 12–15s CTA: \"Preview the pack di link.\" Caption: \"Manual upload only. Seller-reviewed.\"",
    "**30-second:**",
    "- 0–3s Hook (same).",
    "- 3–10s Problem framing: prompt pack biasa terlalu generic.",
    "- 10–20s Solution: tunjukkan struktur 3-layer (Buyer / Seller / Admin).",
    "- 20–27s Benefit bullets on screen.",
    "- 27–30s CTA + safe wording.",
    "**Safe Wording:** tidak menjanjikan sales/income/viral.",
    "",
    "## 6. Marketplace Listing Drafts",
    ...(mps.length ? mps.map((mp) => marketplaceAdapterCopy(mp, seller, adapter)) : ["_Belum ada marketplace yang dipilih._"]),
    "",
    "## 7. Product Manifest Summary",
    "- **Architecture:** PREMIUM_PRODUCT_ARCHITECTURE_V2",
    "- **Mode:** MANUAL_UPLOAD_ONLY",
    `- **Adapter:** ${adapter}`,
    `- **Language:** ${seller.language}`,
    `- **Niche:** ${seller.niche}`,
    `- **License:** ${seller.license}`,
    `- **Prompt Count:** ${seller.prompt_count}`,
    `- **Marketplaces:** ${mps.join(", ") || "—"}`,
    "- **Manual Upload Only:** true",
    "",
    "## 8. Bundle Index",
    "```text",
    "/premium-product-system_v1.0/",
    "  BUYER_PACKAGE/",
    "    01_Product_Brief.md",
    "    02_PromptBook.md",
    "    03_PromptLibrary.csv",
    "    04_UsageGuide.md",
    "    05_Sample_Input_Output.md",
    "    09_Buyer_FAQ.md",
    "    20_Complete_PDF_Product_Draft.md",
    "    Product_Handbook.pdf",
    "    QC_Scorecard.md",
    "  SELLER_TOOLKIT/",
    "    00_Seller_Master_Toolkit.md",
    "  ADMIN_MANIFEST/",
    "    12_Product_Manifest.json",
    "    19_Marketplace_Bundle_Index.md",
    "```",
    "**ZIP Names:**",
    "- `premium-product-system_v1.0_buyer.zip`",
    "- `premium-product-system_v1.0_seller-toolkit.zip`",
    "- `premium-product-system_v1.0_full-system.zip`",
    "",
    "## 9. Safety Reminder",
    "Manual upload only. No marketplace API. No auto-publish. No fake testimonials, no income claims, no marketplace-approval claims. Seller wajib review tiap listing sebelum publish.",
  ].join("\n");
}

export function generateModuleContent(args: {
  moduleKey: string;
  fileName: string;
  seller: SellerMeta;
  marketplaces: string[];
  adapter?: string;
}): { content: string; validation: "PASS" | "FAIL" } {
  if (isForbiddenModuleKey(args.moduleKey) || isForbiddenModuleKey(args.fileName)) return { content: "", validation: "FAIL" };
  if ((IGNORED_LEGACY_MODULES as readonly string[]).includes(args.fileName)) return { content: "", validation: "FAIL" };
  const seller = sellerMeta(args.seller);
  const intent = detectProductIntentFromInputs({ niche: seller.niche, description: seller.confirmed_product_description, brand: seller.brand, audience: seller.audience, adapter: args.adapter });
  const adapter = intent.recommendedAdapter || resolveAdapter(args.adapter ?? "CUSTOM", seller.niche);
  let content = "";
  switch (args.fileName) {
    case "01_Product_Brief.md": content = productBrief(seller, adapter, args.marketplaces); break;
    case "02_PromptBook.md": content = promptBook(seller, adapter, intent.promptCategories); break;
    case "03_PromptLibrary.csv": content = promptLibraryCsv(seller, adapter, intent.promptCategories); break;
    case "04_UsageGuide.md": content = usageGuide(seller, adapter); break;
    case "05_Sample_Input_Output.md": content = sampleInputOutput(seller, adapter); break;
    case "09_Buyer_FAQ.md": content = buyerFAQ(seller); break;
    case "20_Complete_PDF_Product_Draft.md": content = completePdfProductDraft(seller, adapter, args.marketplaces); break;
    case "QC_Scorecard.md": content = qcScorecardTemplate(seller); break;
    case "00_Seller_Master_Toolkit.md": content = sellerMasterToolkit(seller, adapter, args.marketplaces); break;
    case "12_Product_Manifest.json": content = productManifestJson(seller, adapter, args.marketplaces); break;
    case "19_Marketplace_Bundle_Index.md": content = marketplaceBundleIndex(seller, args.marketplaces); break;
    default:
      if (Object.values(MARKETPLACE_MODULES).some((m) => m.file === args.fileName) || args.fileName === MARKETPLACE_BUNDLE_MODULE.file) content = marketplaceListing(args.fileName, seller, adapter, args.marketplaces);
      else return { content: "", validation: "FAIL" };
  }
  const clean = sanitizeOutput(content);
  return { content: clean, validation: validateGeneratedContent(clean) ? "PASS" : "FAIL" };
}


function sanitizeOutput(content: string): string {
  let out = content;
  for (const [regex, replacement] of TYPO_MAP) out = out.replace(regex, replacement);
  return out.replace(/\n{4,}/g, "\n\n\n").trim() + "\n";
}

function validateGeneratedContent(content: string): boolean {
  if (!content || content.trim().length < 200) return false;
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(content));
}

function extractPromptBodies(content: string): string[] {
  const matches = [...content.matchAll(/\*\*Full Prompt:\*\*\s*```\s*([\s\S]*?)```/g)];
  if (matches.length) return matches.map((m) => normalizeText(m[1] || "").toLowerCase()).filter(Boolean);
  return content.split(/^##\s+\d+\./gm).slice(1).map((part) => normalizeText(part).toLowerCase()).filter(Boolean);
}

function csvDataRows(content: string): number {
  return content.trim().split(/\r?\n/).filter(Boolean).length - 1;
}

function hasNegation(line: string): boolean {
  return /(tidak|jangan|hindari|bukan|never|do not|don't|no\s+)/i.test(line);
}

const QC_WEIGHTS: Record<string, number> = {
  [QC_CHECK_IDS.ALL_CORE_FILES_EXIST]: 18,
  [QC_CHECK_IDS.SELECTED_MARKETPLACE_FILES_EXIST]: 5,
  [QC_CHECK_IDS.NO_UNSELECTED_MARKETPLACE_FILES]: 3,
  [QC_CHECK_IDS.NO_API_MODULES]: 10,
  [QC_CHECK_IDS.NO_PLACEHOLDER_TEXT]: 10,
  [QC_CHECK_IDS.NO_FORBIDDEN_CLAIMS]: 7,
  [QC_CHECK_IDS.PROMPT_COUNT_MATCHES]: 6,
  [QC_CHECK_IDS.CSV_ROW_COUNT_MATCHES]: 6,
  [QC_CHECK_IDS.UNIQUE_PROMPT_BODIES]: 8,
  [QC_CHECK_IDS.SAMPLE_IO_EXISTS]: 5,
  [QC_CHECK_IDS.LICENSE_EXISTS]: 5,
  [QC_CHECK_IDS.PRICING_MARKED_HEURISTIC]: 3,
  [QC_CHECK_IDS.MARKETPLACE_FAQ_AND_DELIVERY]: 4,
  [QC_CHECK_IDS.MANIFEST_JSON_VALID]: 4,
  [QC_CHECK_IDS.ASSUMPTION_REGISTER_EXISTS]: 3,
  [QC_CHECK_IDS.QC_SCORECARD_EXISTS]: 2,
  [QC_CHECK_IDS.MANUAL_UPLOAD_DISCLAIMER]: 3,
  [QC_CHECK_IDS.ANCHOR_REFLECTION]: 1,
};

function scoreStatus(score: number): "NOT_SELL_READY" | "SELL_READY_STARTER_BETA" | "SELL_READY_PREMIUM_DRAFT" {
  if (score < QC_THRESHOLDS.MIN_SELL_READY) return "NOT_SELL_READY";
  if (score < QC_THRESHOLDS.PREMIUM_MIN) return "SELL_READY_STARTER_BETA";
  return "SELL_READY_PREMIUM_DRAFT";
}

const BLOCKING_IDS = new Set<string>([
  QC_CHECK_IDS.ALL_CORE_FILES_EXIST,
  QC_CHECK_IDS.NO_API_MODULES,
  QC_CHECK_IDS.NO_PLACEHOLDER_TEXT,
  QC_CHECK_IDS.NO_FORBIDDEN_CLAIMS,
  QC_CHECK_IDS.PROMPT_COUNT_MATCHES,
  QC_CHECK_IDS.CSV_ROW_COUNT_MATCHES,
  QC_CHECK_IDS.UNIQUE_PROMPT_BODIES,
  QC_CHECK_IDS.SAMPLE_IO_EXISTS,
  QC_CHECK_IDS.LICENSE_EXISTS,
  QC_CHECK_IDS.MANIFEST_JSON_VALID,
  QC_CHECK_IDS.ASSUMPTION_REGISTER_EXISTS,
  QC_CHECK_IDS.QC_SCORECARD_EXISTS,
]);

export function runQC(args: {
  promptCount: number;
  modules: { module_key: string; file_name: string; content: string | null; status: string; validation: string }[];
  anchors: string[];
  confirmedDescription: string;
  marketplaces?: string[];
}): QCResult {
  const modules = args.modules ?? [];
  const checks: QCCheckItem[] = [];
  const add = (id: string, name: string, status: "PASS" | "FAIL" | "WARNING", message: string, weight = 5) => checks.push({ id, name, status, weight, message });
  const fileSet = new Set(modules.map((m) => m.file_name));
  const byFile = (file: string) => modules.find((m) => m.file_name === file);
  const expectedFiles = [...FINAL_BUYER_MODULES, SELLER_TOOLKIT_FILE, ...ADMIN_MODULES];
  const missing = expectedFiles.filter((file) => !fileSet.has(file));
  add("PPA_V2_FILES_COMPLETE", "PPA v2 file lengkap", missing.length ? "FAIL" : "PASS", missing.length ? `Missing: ${missing.join(", ")}` : "Buyer, seller, dan admin files lengkap.", 12);
  const legacy = modules.filter((m) => (IGNORED_LEGACY_MODULES as readonly string[]).includes(m.file_name));
  add("NO_IGNORED_LEGACY_FILES", "Tidak ada legacy file", legacy.length ? "FAIL" : "PASS", legacy.length ? `Legacy files: ${legacy.map((m) => m.file_name).join(", ")}` : "Tidak ada legacy file di output.", 12);
  const leakage = [/seller toolkit/i, /pricing heuristic/i, /thumbnail brief/i, /cover generation/i, /upload manual/i, /manual upload guide/i, /marketplace draft/i, /approval enabled/i, /blocking errors/i, /PASS_FINAL/i, /06_QualityChecklist/i, /07_License_Disclaimer/i, /13_Ready_to_Upload_Checklist/i, /14_Cover_Generation_Brief/i, /15_Marketing_Video_CTA/i, /21_Marketplace_Upload_Asset_Kit/i, /Insert content from/i];
  const leaks = modules.filter((m) => (FINAL_BUYER_MODULES as readonly string[]).includes(m.file_name) && leakage.some((rx) => rx.test(m.content || "")));
  add("BUYER_CONTENT_CLEAN", "Buyer content bebas seller/internal leakage", leaks.length ? "FAIL" : "PASS", leaks.length ? `Leakage: ${leaks.map((m) => m.file_name).join(", ")}` : "Buyer content bersih.", 12);
  const apiModules = modules.filter((m) => isForbiddenModuleKey(m.module_key) || isForbiddenModuleKey(m.file_name));
  add(QC_CHECK_IDS.NO_API_MODULES, "Tidak ada API_* module", apiModules.length ? "FAIL" : "PASS", apiModules.length ? `API module: ${apiModules.map((m) => m.file_name).join(", ")}` : "Manual upload only aman.", 8);
  const unfinished = modules.filter((m) => m.status !== "acked" || m.validation !== "PASS" || !m.content);
  add("all_modules_acked", "Semua modul selesai", unfinished.length ? "FAIL" : "PASS", unfinished.length ? `${unfinished.length} modul belum acked/PASS.` : "Semua modul acked dan PASS.", 8);
  const placeholderFiles = modules.filter((m) => (m.content || "") && PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(m.content || "")));
  add(QC_CHECK_IDS.NO_PLACEHOLDER_TEXT, "Tidak ada placeholder", placeholderFiles.length ? "FAIL" : "PASS", placeholderFiles.length ? `Placeholder di: ${placeholderFiles.map((m) => m.file_name).join(", ")}` : "Tidak ada placeholder.", 10);
  const forbiddenFiles: string[] = [];
  for (const m of modules) for (const claim of FORBIDDEN_CLAIMS) {
    const rx = new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if ((m.content || "").split(/\r?\n/).some((line) => rx.test(line) && !hasNegation(line))) forbiddenFiles.push(`${m.file_name}: ${claim}`);
  }
  add(QC_CHECK_IDS.NO_FORBIDDEN_CLAIMS, "Tidak ada klaim terlarang", forbiddenFiles.length ? "FAIL" : "PASS", forbiddenFiles.length ? forbiddenFiles.slice(0, 5).join("; ") : "Tidak ada klaim terlarang positif.", 8);
  const bodies = extractPromptBodies(byFile("02_PromptBook.md")?.content || "");
  add(QC_CHECK_IDS.PROMPT_COUNT_MATCHES, "Jumlah prompt sesuai", bodies.length === args.promptCount ? "PASS" : "FAIL", `PromptBook: ${bodies.length}, expected: ${args.promptCount}`, 7);
  add(QC_CHECK_IDS.UNIQUE_PROMPT_BODIES, "Prompt body unik", bodies.length > 0 && new Set(bodies).size === bodies.length ? "PASS" : "FAIL", bodies.length ? `Unique ${new Set(bodies).size}/${bodies.length}` : "Prompt bodies tidak ditemukan.", 7);
  const csv = byFile("03_PromptLibrary.csv");
  const header = (csv?.content || "").split(/\r?\n/)[0]?.replace(/^\uFEFF/, "").split(",").map((x) => x.trim().toLowerCase()).join(",");
  add("CSV_HEADER_VALID", "CSV header valid", header === "id,title,prompt,variables,sample_input,notes" ? "PASS" : "FAIL", `Header: ${header || "missing"}`, 6);
  const csvRows = csv?.content ? csvDataRows(csv.content) : 0;
  add(QC_CHECK_IDS.CSV_ROW_COUNT_MATCHES, "CSV row count sesuai", csvRows === args.promptCount ? "PASS" : "FAIL", `CSV rows: ${csvRows}, expected: ${args.promptCount}`, 6);
  const sampleCount = (byFile("05_Sample_Input_Output.md")?.content?.match(/^##\s+Sample\s+\d+/gim) || []).length;
  add(QC_CHECK_IDS.SAMPLE_IO_EXISTS, "Sample Input/Output ada", sampleCount >= 3 ? "PASS" : "FAIL", `Sample sections: ${sampleCount}`, 5);
  let manifestValid = false;
  try { const parsed = JSON.parse(byFile("12_Product_Manifest.json")?.content || "{}"); manifestValid = parsed.architecture === PPA_V2_VERSION && Array.isArray(parsed.files?.buyer) && Array.isArray(parsed.files?.seller) && Array.isArray(parsed.files?.admin) && parsed.manual_upload_only === true && parsed.api_mode_enabled === false; } catch (_e) {}
  add(QC_CHECK_IDS.MANIFEST_JSON_VALID, "Product Manifest JSON valid", manifestValid ? "PASS" : "FAIL", manifestValid ? "Manifest v2 valid." : "Manifest JSON invalid atau bukan schema v2.", 8);
  const pdfDraft = byFile("20_Complete_PDF_Product_Draft.md");
  add("PDF_DRAFT_BUYER_READY", "PDF draft buyer-ready", pdfDraft?.content && pdfDraft.content.length > 2500 && !/Insert content from|Aplikasi belum membuat binary PDF otomatis|Seller Review Required/i.test(pdfDraft.content) ? "PASS" : "FAIL", "PDF draft harus lengkap, bukan placeholder.", 8);
  const score = Math.min(100, Math.round(checks.reduce((sum, check) => sum + (check.status === "PASS" ? check.weight : check.status === "WARNING" ? check.weight * 0.5 : 0), 0)));
  const blockingIds = new Set(["PPA_V2_FILES_COMPLETE", "NO_IGNORED_LEGACY_FILES", "BUYER_CONTENT_CLEAN", QC_CHECK_IDS.NO_API_MODULES, QC_CHECK_IDS.NO_PLACEHOLDER_TEXT, QC_CHECK_IDS.NO_FORBIDDEN_CLAIMS, QC_CHECK_IDS.PROMPT_COUNT_MATCHES, QC_CHECK_IDS.CSV_ROW_COUNT_MATCHES, "CSV_HEADER_VALID", "PDF_DRAFT_BUYER_READY", QC_CHECK_IDS.MANIFEST_JSON_VALID, "all_modules_acked"]);
  const blocking = checks.filter((check) => check.status === "FAIL" && blockingIds.has(check.id));
  return { score, status: scoreStatus(score), blocking_errors: blocking.length, errors: blocking.map((check) => check.message || check.name), warnings: checks.filter((check) => check.status === "WARNING" || (check.status === "FAIL" && !blockingIds.has(check.id))).map((check) => check.message || check.name), checks, approval_enabled: score >= QC_THRESHOLDS.PREMIUM_MIN && blocking.length === 0, generated_at: new Date().toISOString() };
}


export function generateRunRequestId(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RUN-${stamp}-${rand}`;
}

export function safeMarketplaces(mps: string[]): string[] {
  return mps.filter((m) => MARKETPLACES.includes(m as never) && !isForbiddenModuleKey(String(m)));
}
