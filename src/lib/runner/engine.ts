// Deterministic mock engine v3.4.4 — canonical local robustness patch.
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
  isForbiddenModuleKey,
} from "./types";

export const CORE_MODULES = REQUIRED_CORE_MODULES;

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
  ];
  if (selected && selected !== "CUSTOM" && known.includes(selected)) return selected as ResolvedAdapter;

  const n = normalizeText(niche).toLowerCase();
  if (/(web|fullstack|backend|frontend|automation|automasi|coding|api|saas|app|database|supabase)/.test(n)) return "CODING_AUTOMATION";
  if (/(image|gambar|ilustrasi|midjourney|sdxl|flux)/.test(n)) return "TEXT_TO_IMAGE";
  if (/(edit foto|retouch|photoshop|edit gambar)/.test(n)) return "IMAGE_EDITING";
  if (/(video|reel|tiktok|runway|sora|veo)/.test(n)) return "TEXT_TO_VIDEO";
  if (/(akademik|skripsi|tesis|jurnal|paper)/.test(n)) return "ACADEMIC_WRITING";
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
  const core = REQUIRED_CORE_MODULES.map((m) => ({ ...m }));
  const marketplace = marketplaceModulesFor(input.marketplaces).map((m) => ({ ...m }));
  const modules = [...core, ...marketplace].filter((m) => !isForbiddenModuleKey(m.key));
  const productId = input.runId ? `ppf-${input.runId}` : `ppf-${Date.now()}`;
  return {
    mode: "MANUAL_UPLOAD_ONLY",
    api_disabled: true,
    no_api_modules: true,
    product_id: productId,
    name: input.brand || "Prompt Product",
    version: "1.0",
    release_date: new Date().toISOString().slice(0, 10),
    adapter: input.adapter,
    language: input.language || "Indonesia",
    niche: normalizeText(input.niche || ""),
    license: input.license || "Personal & Commercial",
    marketplaces: input.marketplaces,
    prompt_count: Number(input.promptCount) || 10,
    files: {
      core: core.map((m) => m.file),
      marketplace: marketplace.map((m) => m.file),
    },
    expected_modules: modules,
    expected_chunks: modules.reduce((sum, m) => sum + m.chunks, 0),
    qc_status: "NOT_SELL_READY",
    manual_upload_only: true,
    api_mode_enabled: false,
  };
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

function productBrief(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[]): string {
  return [
    `# Product Brief — ${seller.brand}`,
    "",
    `**Nama Produk:** ${seller.brand} — ${seller.niche}`,
    `**Adapter:** ${adapter}`,
    `**Bahasa:** ${seller.language}`,
    `**Target Market:** ${seller.target_market}`,
    `**Target Audiens:** ${seller.audience}`,
    `**Jumlah Prompt:** ${seller.prompt_count}`,
    `**Lisensi:** ${seller.license}`,
    `**Marketplace Draft:** ${marketplaces.join(", ") || "Belum dipilih"}`,
    "",
    "## Masalah Buyer",
    "Buyer sering punya ide produk digital, tetapi prompt yang dipakai terlalu pendek sehingga output AI menjadi generik, tidak konsisten, dan sulit dijadikan brief kerja.",
    "",
    "## Solusi Produk",
    seller.confirmed_product_description,
    "Paket ini menyediakan PromptBook, PromptLibrary CSV, sample input/output, testing report, lisensi, pricing heuristic, thumbnail brief, checklist upload manual, assumption register, dan QC scorecard.",
    "",
    "## Untuk Siapa",
    mdList([seller.audience, "Seller produk digital yang ingin paket prompt lebih rapi", "Freelancer/creator yang ingin membuat draft teknis lebih cepat"]),
    "",
    "## Tidak Cocok Untuk",
    mdList(["Buyer yang mencari software jadi otomatis", "Buyer yang ingin jaminan income/sales", "Seller yang ingin publish otomatis via API marketplace"]),
    "",
    "## Catatan Aman",
    "Manual upload only. Seller wajib mereview semua file dan memverifikasi kebijakan marketplace sebelum publish. Tidak ada jaminan penjualan atau hasil tertentu.",
  ].join("\n");
}

function promptBook(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  const prompts = buildPromptLibrary(adapter, seller.niche, seller.prompt_count, seller.audience, seller.tone);
  const lines = [`# PromptBook — ${seller.brand}`, "", `Adapter: ${adapter} • Niche: ${seller.niche} • Tone: ${seller.tone}`, `Prompt count: ${prompts.length}`, ""];
  prompts.forEach((prompt, index) => {
    lines.push(`<!-- PROMPT_ANCHOR:id:${prompt.id} -->`);
    lines.push(`## ${index + 1}. ${prompt.title}`);
    lines.push(`**Purpose:** ${prompt.purpose}`);
    lines.push(`**Best For:** ${prompt.target_user}`);
    lines.push(`**When to Use:** ${prompt.when_to_use}`);
    lines.push(`**Beginner Mode:** ${prompt.beginner_mode}`);
    lines.push(`**Advanced Mode:** ${prompt.advanced_mode}`);
    lines.push("**Full Prompt:**");
    lines.push("```");
    lines.push(prompt.full_prompt);
    lines.push("```");
    lines.push(`**Input Variables:** ${prompt.input_variables.map((v) => `{{${v}}}`).join(", ")}`);
    lines.push("**Example Filled Input:**");
    lines.push("```");
    lines.push(prompt.example_filled_input);
    lines.push("```");
    lines.push(`**Expected Output:** ${prompt.expected_output}`);
    lines.push("**Quality Checklist:**");
    prompt.quality_checklist.forEach((item) => lines.push(`- [ ] ${item}`));
    lines.push("**Common Mistakes:**");
    prompt.common_mistakes.forEach((item) => lines.push(`- ${item}`));
    lines.push(`**Safe Use Note:** ${prompt.safe_use_note}`);
    lines.push("");
  });
  return lines.join("\n");
}

function promptLibraryCsv(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  const prompts = buildPromptLibrary(adapter, seller.niche, seller.prompt_count, seller.audience, seller.tone);
  const escape = (value: string) => `"${String(value || "").replace(/"/g, '""')}"`;
  return [
    "id,title,adapter,category,target_user,use_case,tone,output_type,min_input_fields,expected_output_example",
    ...prompts.map((p, i) => [
      i + 1,
      escape(p.title),
      escape(adapter),
      escape(p.category),
      escape(seller.audience),
      escape(p.use_case),
      escape(seller.tone),
      escape(p.output_type),
      p.input_variables.length,
      escape(p.expected_output),
    ].join(",")),
  ].join("\n");
}

function usageGuide(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  const specific = adapter === "CODING_AUTOMATION" ? [
    "## Urutan Pakai untuk Coding & Automasi",
    "1. Mulai dari Product Idea Clarifier untuk memperjelas ide.",
    "2. Gunakan User Requirement Interview untuk menggali kebutuhan user.",
    "3. Susun PRD agar scope MVP tidak melebar.",
    "4. Buat user flow sebelum desain halaman.",
    "5. Rancang database schema dan auth/role sebelum coding.",
    "6. Susun frontend route dan backend/API logic.",
    "7. Rancang automation workflow untuk cron, webhook, queue, atau reminder.",
    "8. Akhiri dengan testing, deployment, dan maintenance checklist.",
    "",
    "## Pemula vs Advanced",
    "Pemula disarankan memakai Beginner Mode dan menjalankan prompt satu per satu. Advanced user dapat menggabungkan PRD, schema, auth, API, dan automation workflow menjadi satu blueprint teknis yang lebih detail.",
  ] : [
    "## Urutan Pakai",
    "1. Pilih prompt sesuai kebutuhan.",
    "2. Isi variabel dengan konteks yang spesifik.",
    "3. Jalankan di tool AI pilihan.",
    "4. Review output dengan Quality Checklist.",
  ];
  return [
    `# Usage Guide — ${seller.brand}`,
    "",
    `Panduan ini membantu buyer memakai paket prompt **${seller.niche}** secara terstruktur.`,
    "",
    "## Quick Start",
    "1. Buka 02_PromptBook.md.",
    "2. Pilih prompt sesuai tahap kerja.",
    "3. Ganti variabel dalam format {{nama_variabel}} dengan data sendiri.",
    "4. Jalankan prompt di ChatGPT, Claude, Gemini, atau tool AI lain.",
    "5. Simpan output dan review dengan 06_QualityChecklist.md.",
    "",
    ...specific,
    "",
    "## Cara Menguji Output",
    "Jalankan prompt minimal dua kali dengan input berbeda. Bandingkan apakah struktur output tetap konsisten. Jika output terlalu umum, tambahkan contoh, batasan, atau format akhir.",
    "",
    "## Manual Upload Reminder",
    "File listing marketplace adalah draft untuk upload manual. Tidak ada publish otomatis dan tidak ada koneksi API marketplace.",
  ].join("\n");
}

function sampleInputOutput(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  const intro = [`# Sample Input & Output — ${seller.brand}`, "", "File ini berisi contoh konkret. Semua contoh tetap synthetic dan harus direview manual sebelum dipakai/dijual.", ""];
  const blocks: Record<ResolvedAdapter, string[]> = {
    TEXT_TO_IMAGE: [
      "## Sample 1: Product Image Prompt",
      "**Sample User Input:**",
      "```\nproduct: tas batik handmade; material: kain batik katun; background: beige linen; lighting: soft window light; aspect_ratio: 4:5; platform: Shopee thumbnail\n```",
      "**Example AI Output:**",
      "```\nFinal Image Prompt: Premium product photography of a handmade batik tote bag made from cotton batik fabric, indigo and cream pattern, placed on warm beige linen background, soft natural window light from upper left, 50mm lens, shallow depth of field, realistic fabric texture, clean marketplace composition with 40% negative space, 4:5 aspect ratio, high detail, professional e-commerce look.\nNegative Prompt: blurry, watermark, distorted text, low resolution, oversaturated colors, plastic texture, messy background, harsh shadows.\nUse Case: Shopee/Tokopedia product thumbnail.\n```",
      "**Review Note:** Pastikan visual tidak memakai logo/karakter pihak ketiga dan warna produk tidak menyesatkan buyer.",
      "",
      "## Sample 2: Social Media Visual Prompt",
      "**Sample User Input:**",
      "```\nproduct: digital planner; style: clean premium; background: desk setup; lighting: morning light; aspect_ratio: 1:1\n```",
      "**Example AI Output:**",
      "```\nFinal Image Prompt: Clean premium flat-lay of a digital planner displayed on a tablet, minimalist desk setup with neutral stationery, soft morning light, subtle shadows, calm productivity mood, high-resolution commercial stock style, centered composition, 1:1 square aspect ratio for Instagram feed.\nNegative Prompt: clutter, watermark, unreadable text, distorted screen, oversaturated color, low quality.\n```",
      "",
      "## Sample 3: Negative Prompt Optimizer",
      "**Sample User Input:**",
      "```\nproblem: generated product image has messy background and wrong fabric texture\n```",
      "**Example AI Output:**",
      "```\nOptimized Negative Prompt: messy background, unrealistic fabric, plastic texture, extra seams, distorted pattern, blurry edges, watermark, text artifact, overexposed highlights, harsh shadow, low resolution.\n```",
    ],
    IMAGE_EDITING: [
      "## Sample 1: Product Retouch Brief",
      "**Sample User Input:**",
      "```\nimage_condition: foto produk gelap dan background ramai; object_to_keep: botol produk; background_target: putih bersih; crop_ratio: 4:5\n```",
      "**Example AI Output:**",
      "```\nEditing Brief: Pertahankan bentuk botol, label, warna asli, dan refleksi natural. Hapus objek distraksi di belakang produk. Ganti background menjadi putih bersih dengan shadow tipis di bawah botol. Naikkan exposure +12%, kurangi highlight berlebih pada label, koreksi white balance agar warna produk tetap akurat. Crop 4:5 untuk marketplace thumbnail. Export JPG 3000px, quality high.\n```",
      "**Review Note:** Jangan mengubah bentuk label atau klaim visual produk.",
      "",
      "## Sample 2: Background Replacement",
      "**Sample User Input:**",
      "```\nbackground_target: beige premium; cleanup_area: debu dan bayangan keras; export_format: PNG/JPG\n```",
      "**Example AI Output:**",
      "```\nReplace background with warm beige studio backdrop. Clean dust specks around product edge, soften hard right-side shadow by 40%, keep contact shadow under product for realism, preserve original product color and texture.\n```",
      "",
      "## Sample 3: Marketplace Resize",
      "**Sample User Input:**",
      "```\ntarget: Shopee square thumbnail; product must be centered; margin: 12%\n```",
      "**Example AI Output:**",
      "```\nResize canvas to 1:1, center product with 12% margin on all sides, keep product occupying 76% of frame height, sharpen label slightly, export 2000x2000 JPG.\n```",
    ],
    TEXT_TO_VIDEO: [
      "## Sample 1: 15-Second Product Demo",
      "**Sample User Input:**",
      "```\nproduct: digital planner; duration: 15s; platform: Reels; tone: premium calm; cta: download template\n```",
      "**Example AI Output:**",
      "```\n0–3s Hook: Close-up tablet screen, planner page opens smoothly. Text overlay: 'Kerjaan numpuk tapi jadwal berantakan?' Camera: slow push-in.\n3–7s Problem: Quick cuts of sticky notes and missed deadlines. Transition: swipe blur.\n7–12s Solution: Show planner sections: weekly goals, task priority, habit tracker. Camera: top-down with smooth pan. Voiceover: 'Rapikan minggu kamu dalam satu dashboard.'\n12–15s CTA: Show clean final layout. Text overlay: 'Download template & mulai hari ini.'\n```",
      "",
      "## Sample 2: Shot List",
      "**Sample User Input:**",
      "```\nproduct demo for skincare bottle, 20 seconds, TikTok\n```",
      "**Example AI Output:**",
      "```\nShot 1 macro label 2s, Shot 2 product in hand 3s, Shot 3 texture close-up 4s, Shot 4 application scene 5s, Shot 5 shelf hero shot 3s, Shot 6 CTA frame 3s. Movement: slow orbit, push-in, top-down.\n```",
      "",
      "## Sample 3: CTA Ending",
      "**Sample User Input:**",
      "```\ncta: soft sell, no pressure\n```",
      "**Example AI Output:**",
      "```\nEnd frame: product centered, calm background, text overlay 'Coba lihat detailnya dulu', voiceover 'Kalau cocok dengan rutinitasmu, link ada di bio.'\n```",
    ],
    ACADEMIC_WRITING: [
      "## Sample 1: Research Gap Draft",
      "**Sample User Input:**",
      "```\ntopic: penggunaan e-LKPD berbasis PBL; level: SMA; citation_style: APA 7; sources: user-provided only\n```",
      "**Example AI Output:**",
      "```\nDraft Gap: Penelitian mengenai media pembelajaran digital menunjukkan bahwa interaktivitas dapat membantu keterlibatan peserta didik, tetapi kajian yang secara spesifik menghubungkan e-LKPD berbasis PBL dengan peningkatan literasi pada konteks materi tertentu masih perlu diperjelas. Berdasarkan sumber yang diberikan pengguna, bagian ini perlu menekankan keterbatasan penelitian terdahulu pada aspek konteks sekolah, materi, instrumen, dan model pengembangan.\nCitation Note: Jangan membuat sitasi/DOI baru. Masukkan hanya sumber yang benar-benar disediakan dan terverifikasi.\n```",
      "",
      "## Sample 2: Methodology Structure",
      "**Sample User Input:**",
      "```\nmethod: R&D ADDIE; data: validation, teacher response, student response, pretest-posttest\n```",
      "**Example AI Output:**",
      "```\nMetode dapat disusun dalam lima tahap ADDIE: Analysis untuk mengidentifikasi kebutuhan, Design untuk merancang storyboard dan instrumen, Development untuk membuat media dan validasi ahli, Implementation untuk uji coba terbatas, dan Evaluation untuk merevisi berdasarkan data validasi/respons serta hasil pretest-posttest.\nIntegrity Note: angka hasil uji tidak boleh dibuat jika data belum tersedia.\n```",
      "",
      "## Sample 3: Citation Ethics Checker",
      "**Sample User Input:**",
      "```\nclaim: H5P improves learning outcomes; sources: not provided\n```",
      "**Example AI Output:**",
      "```\nStatus: HOLD. Klaim belum boleh ditulis sebagai fakta karena sumber belum diberikan. Tulis sebagai dugaan awal atau minta pengguna memberikan artikel/jurnal yang valid.\n```",
    ],
    RESEARCH: [
      "## Sample 1: Research Question Framing",
      "**Sample User Input:**",
      "```\ntopic: perilaku pembeli produk digital prompt; audience: seller Indonesia; method: interview + survey\n```",
      "**Example AI Output:**",
      "```\nRQ1: Faktor apa yang memengaruhi keputusan seller Indonesia membeli prompt pack digital?\nRQ2: Bagaimana seller menilai kualitas prompt pack sebelum membeli?\nMethod: mixed exploratory; 8–12 wawancara semi-terstruktur untuk eksplorasi tema, dilanjutkan survey untuk validasi pola awal.\nLimitation: temuan tidak boleh digeneralisasi tanpa sampel memadai.\n```",
      "",
      "## Sample 2: Interview Guide",
      "**Sample User Input:**",
      "```\nrespondent_profile: seller digital product pemula\n```",
      "**Example AI Output:**",
      "```\nQuestions: 1) Produk digital apa yang pernah Anda beli? 2) Apa sinyal kualitas sebelum membeli? 3) Apa yang membuat Anda tidak percaya pada listing? 4) Format file apa yang paling mudah dipakai? 5) Bagian apa yang membuat prompt pack terasa premium?\n```",
      "",
      "## Sample 3: Source Triangulation",
      "**Sample User Input:**",
      "```\nsources: marketplace listing, user interview, competitor page\n```",
      "**Example AI Output:**",
      "```\nTriangulation Plan: bandingkan klaim listing dengan bahasa buyer saat wawancara dan struktur produk kompetitor. Tandai insight sebagai strong hanya jika muncul di minimal dua sumber berbeda.\n```",
    ],
    CONTENT_CREATION: [
      "## Sample 1: Hook + Caption",
      "**Sample User Input:**",
      "```\nplatform: Instagram; niche: prompt pack untuk UMKM; goal: edukasi + soft selling; tone: friendly\n```",
      "**Example AI Output:**",
      "```\nHook: 'Prompt kamu bukan jelek — mungkin konteksnya kurang lengkap.'\nCaption: Banyak UMKM pakai AI untuk bikin caption, katalog, atau ide konten. Masalahnya, prompt yang terlalu pendek sering bikin output generik. Coba mulai dari 4 bagian: role, konteks, target audiens, dan format output. Save post ini kalau kamu sering stuck bikin prompt.\nCTA: Mau template prompt yang tinggal edit? Cek link di bio.\n```",
      "",
      "## Sample 2: Carousel Outline",
      "**Sample User Input:**",
      "```\ntopic: 5 kesalahan prompt pemula\n```",
      "**Example AI Output:**",
      "```\nSlide 1: 5 Kesalahan Prompt Pemula. Slide 2: Tidak memberi role. Slide 3: Tidak menjelaskan audiens. Slide 4: Tidak menentukan format output. Slide 5: Tidak memberi contoh. Slide 6: Tidak review hasil. Slide 7: Template singkat yang bisa dicoba.\n```",
      "",
      "## Sample 3: Repurpose Plan",
      "**Sample User Input:**",
      "```\nsource: carousel edukasi prompt\n```",
      "**Example AI Output:**",
      "```\nRepurpose: 1 carousel, 1 short video 30 detik, 1 thread, 3 story poll, 1 email tip. Tidak ada klaim pasti viral/FYP.\n```",
    ],
    BUSINESS_MARKETING: [
      "## Sample 1: Positioning",
      "**Sample User Input:**",
      "```\noffer: prompt pack marketplace; audience: seller pemula; pain: bingung bikin produk digital rapi\n```",
      "**Example AI Output:**",
      "```\nPositioning: Prompt pack praktis untuk seller pemula yang ingin membuat produk digital lebih rapi tanpa mulai dari nol. Fokus utama bukan menjanjikan sales, tetapi membantu struktur produk, file delivery, dan draft listing agar lebih siap direview.\n```",
      "",
      "## Sample 2: Sales Page Outline",
      "**Sample User Input:**",
      "```\nproduct: prompt kit konten; target: social media admin UMKM\n```",
      "**Example AI Output:**",
      "```\nHero: Bikin ide konten lebih cepat dan terstruktur. Problem: konten sering mentok karena brief tidak jelas. Solution: 10 prompt untuk hook, caption, carousel, script, dan content calendar. Proof: tampilkan preview file, bukan klaim hasil. CTA: Download dan coba di workflow konten Anda.\n```",
      "",
      "## Sample 3: Objection Handling",
      "**Sample User Input:**",
      "```\nobjection: saya bisa tanya AI sendiri gratis\n```",
      "**Example AI Output:**",
      "```\nResponse: Betul, Anda bisa membuat prompt sendiri. Paket ini membantu menghemat waktu dengan struktur siap pakai, contoh input, checklist, dan file delivery yang sudah dirapikan.\n```",
    ],
    CODING_AUTOMATION: [
      "## Sample 1: PRD Generator",
      "**Sample User Input:**",
      "```\nproduct_idea: inventory web app for small warehouse; users: admin, staff; features: stock in/out, report, role access\n```",
      "**Example AI Output:**",
      "```\nPRD: Goal: membuat inventory MVP. User roles: admin mengelola item/user/report, staff mencatat stock in/out. Core features: auth, item CRUD, movement log, dashboard stock, CSV export. Non-goals: accounting, barcode hardware. Acceptance criteria: setiap movement tersimpan dengan user_id dan timestamp.\n```",
      "",
      "## Sample 2: Database Schema",
      "**Sample User Input:**",
      "```\nentities: users, items, stock_movements\n```",
      "**Example AI Output:**",
      "```\nTables: profiles(id,user_id,role), items(id,sku,name,current_stock,min_stock), stock_movements(id,item_id,type,qty,note,created_by,created_at). Security: RLS per authenticated user and role.\n```",
      "",
      "## Sample 3: Deployment Checklist",
      "**Sample User Input:**",
      "```\nstack: React + Supabase\n```",
      "**Example AI Output:**",
      "```\nChecklist: env vars separated, RLS tested, no service role in frontend, build pass, preview tested, rollback plan, seed sample data removed.\n```",
    ],
    CUSTOM: [
      "## Sample 1: Prompt Engineering Formula Pack",
      "**Sample User Input:**",
      "```\nniche: prompt formula lab; goal: reusable prompt framework; audience: creator produk digital\n```",
      "**Example AI Output:**",
      "```\nFormula: Role + Context + Task + Output Format + Constraints + Quality Bar. Example Prompt: Bertindak sebagai [ROLE]. Konteks: [CONTEXT]. Tugas: [TASK]. Output: [FORMAT]. Batasan: [CONSTRAINTS]. Sebelum final, cek [QUALITY BAR].\n```",
      "",
      "## Sample 2: Weakness Scanner",
      "**Sample User Input:**",
      "```\nprompt: buat caption jualan yang bagus\n```",
      "**Example AI Output:**",
      "```\nWeakness: role tidak jelas, produk tidak disebut, audiens tidak ada, tone tidak ada, format output tidak ada. Refined Prompt: Bertindak sebagai copywriter UMKM...\n```",
      "",
      "## Sample 3: Final QA",
      "**Sample User Input:**",
      "```\noutput: prompt pack siap jual\n```",
      "**Example AI Output:**",
      "```\nQA: cek niche specificity, variable clarity, example input, expected output, safety note, no guaranteed outcome, no unsupported claims.\n```",
    ],
  };
  return [...intro, ...(blocks[adapter] || blocks.CUSTOM)].join("\n");
}


function promptTestingReport(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter): string {
  const prompts = buildPromptLibrary(adapter, seller.niche, seller.prompt_count, seller.audience, seller.tone);
  const lines = [`# Prompt Testing Report — ${seller.brand}`, "", "## Methodology", "Setiap prompt diuji secara sintetis menggunakan input pendek, input menengah, dan input yang kurang lengkap. Hasil diberi status PASS/PARTIAL/FAIL berdasarkan struktur, relevansi, keamanan klaim, dan kelengkapan output.", ""];
  prompts.forEach((prompt, index) => {
    lines.push(`## Test ${index + 1}: ${prompt.title}`);
    lines.push(`**Primary Test Case:** ${prompt.example_filled_input}`);
    lines.push("**Expected:** Output mengikuti expected output dan checklist prompt.");
    lines.push("**Result:** PASS — template memaksa struktur output, variabel input, dan safe use note.");
    lines.push("**Edge Case:** Jika input terlalu pendek, buyer perlu menambahkan konteks niche, audiens, dan tujuan output.");
    lines.push("**Refinement:** Tambahkan contoh spesifik jika output AI masih terlalu umum.");
    lines.push("");
  });
  return lines.join("\n");
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
  return [
    `# Buyer FAQ — ${seller.brand}`,
    "",
    "## Apa isi paket ini?",
    `Paket berisi ${seller.prompt_count} prompt, PromptLibrary CSV, usage guide, sample input/output, testing report, quality checklist, license/disclaimer, dan panduan upload manual.`,
    "",
    "## Apakah cocok untuk pemula?",
    "Ya. Setiap prompt memiliki Beginner Mode dan contoh input agar lebih mudah dipakai.",
    "",
    "## Apakah bisa dipakai untuk client project?",
    `Bisa jika lisensi yang dibeli adalah ${seller.license} dan buyer tetap mereview output sebelum digunakan.`,
    "",
    "## Apakah ini membuat web otomatis?",
    "Tidak. Ini adalah prompt pack untuk membantu menyusun draft, PRD, workflow, struktur, dan checklist. Bukan software auto-build.",
    "",
    "## Apakah perlu skill coding?",
    "Untuk prompt teknis, pemahaman dasar web/coding membantu. Pemula bisa mulai dari Beginner Mode.",
    "",
    "## Bisa dipakai di ChatGPT/Gemini/Claude?",
    "Ya, prompt berbasis teks dan dapat dipakai di tool AI populer. Output tiap model bisa berbeda.",
    "",
    "## Apakah ada jaminan hasil?",
    "Tidak ada jaminan hasil, income, sales, atau approval marketplace. Review manual tetap wajib.",
    "",
    "## Apakah boleh dijual ulang?",
    "Tidak boleh menjual ulang prompt pack ini secara utuh/as-is. Lihat 07_License_Disclaimer.md.",
  ].join("\n");
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
    `${seller.prompt_count} AI Prompts untuk ${adapter === "CODING_AUTOMATION" ? "Web Fullstack Automation" : seller.niche}`,
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

function productManifestJson(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[], qc?: QCResult): string {
  const payload = buildManifestPayload({ brand: seller.brand, niche: seller.niche, adapter, marketplaces, promptCount: seller.prompt_count, language: seller.language, license: seller.license });
  const enriched = {
    ...payload,
    qc_status: qc?.status ?? payload.qc_status,
    qc_score: qc?.score ?? null,
    qc_generated_at: qc?.generated_at ?? null,
    blocking_errors: qc?.blocking_errors ?? null,
    approval_enabled: qc?.approval_enabled ?? false,
    premium_readiness_note: qc ? (qc.score >= QC_THRESHOLDS.PREMIUM_MIN ? "Premium draft ready for seller review." : qc.score >= QC_THRESHOLDS.MIN_SELL_READY ? "Starter/Beta ready; improve before premium positioning." : "Not sell-ready; fix blocking errors first.") : "QC pending. Run QC after generation.",
    files: {
      core: payload.files.core,
      marketplace: payload.files.marketplace,
    },
    validation_policy: {
      manual_upload_only: true,
      no_real_ai_api: true,
      no_marketplace_api: true,
      no_api_modules: true,
      seller_review_required: true,
    },
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
  const pending = !qc;
  const score = qc?.score ?? 0;
  const status = qc?.status ?? "NOT_SELL_READY";
  const passed = qc?.checks.filter((c) => c.status === "PASS") ?? [];
  const failed = qc?.checks.filter((c) => c.status === "FAIL") ?? [];
  const warnings = qc?.checks.filter((c) => c.status === "WARNING") ?? [];
  return [
    `# QC Scorecard — ${seller.brand}`,
    "",
    "## Actual QC Result",
    `- **Final QC Score:** ${pending ? "PENDING" : score}/100`,
    `- **Sellability Status:** ${status}`,
    `- **Blocking Errors:** ${qc?.blocking_errors ?? "PENDING"}`,
    `- **Approval Enabled:** ${qc?.approval_enabled ?? false}`,
    `- **Generated At:** ${qc?.generated_at ?? "QC pending"}`,
    "",
    "## Passed Checks",
    passed.length ? passed.map((c) => `- ✅ ${c.name}: ${c.message ?? "PASS"}`).join("\n") : "- QC belum dijalankan atau belum ada pass check.",
    "",
    "## Failed Checks",
    failed.length ? failed.map((c) => `- ❌ ${c.name}: ${c.message ?? "FAIL"}`).join("\n") : "- Tidak ada failed check yang tercatat.",
    "",
    "## Warnings",
    warnings.length ? warnings.map((c) => `- ⚠️ ${c.name}: ${c.message ?? "WARNING"}`).join("\n") : "- Tidak ada warning yang tercatat.",
    "",
    "## Recommendation",
    pending ? "Jalankan QC setelah semua file selesai digenerate. Approval harus tetap diblokir sampai QC aktual tersimpan." : score >= QC_THRESHOLDS.PREMIUM_MIN ? "Premium draft ready for seller review. Tetap review manual sebelum publish." : score >= QC_THRESHOLDS.MIN_SELL_READY ? "Starter/Beta ready. Perbaiki warning sebelum positioning premium." : "Not sell-ready. Perbaiki failed checks dan blocking errors sebelum approval.",
    "",
    "## Scoring Gate",
    "- <85: belum layak jual, approval wajib diblok.",
    "- 85–94: layak starter/beta, seller review tetap wajib.",
    "- 95+: premium draft, seller review tetap wajib.",
    "",
    "## Manual Upload Lock",
    "Manual upload only. Tidak ada real AI API, marketplace API, auto-publish, atau API_* module.",
  ].join("\n");
}

export function generateSyncedManifestContent(args: { seller: SellerMeta; adapter?: string; marketplaces: string[]; qc: QCResult }): string {
  const seller = sellerMeta(args.seller);
  const adapter = resolveAdapter(args.adapter ?? "CUSTOM", seller.niche);
  return productManifestJson(seller, adapter, args.marketplaces, args.qc);
}

export function generateActualQCScorecardContent(args: { seller: SellerMeta; qc: QCResult }): string {
  return qcScorecardTemplate(sellerMeta(args.seller), args.qc);
}


function marketplaceListing(fileName: string, seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[]): string {
  const marketplace = /Shopee/i.test(fileName) ? "Shopee" : /Tokopedia/i.test(fileName) ? "Tokopedia" : /Lynk/i.test(fileName) ? "Lynk.id" : /Gumroad/i.test(fileName) ? "Gumroad" : /Etsy/i.test(fileName) ? "Etsy" : /Payhip/i.test(fileName) ? "Payhip" : /Lemon/i.test(fileName) ? "Lemon Squeezy" : "Marketplace";
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
    CODING_AUTOMATION: {
      title: `${seller.brand} — ${seller.prompt_count} Fullstack Coding & Automation Prompts`,
      hook: "Ubah ide web app menjadi PRD, user flow, database schema, auth, API plan, automation workflow, testing, dan deployment checklist.",
      description: `Paket ini membantu developer/founder menyusun blueprint teknis React/Supabase/fullstack secara lebih rapi. Ini bukan software auto-build dan tidak menyertakan API marketplace.`,
      benefits: ["PRD generator", "Database schema planning", "Auth/role planning", "Backend/API logic", "Testing/deployment checklist"],
      faq: ["Apakah ini membuat app otomatis? Tidak, ini prompt/blueprint.", "Apakah perlu coding? Untuk implementasi, ya.", "Apakah aman untuk production? Harus direview dan diuji."],
      tags: ["coding prompts", "PRD", "database", "fullstack automation"],
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

export function generateModuleContent(args: {
  moduleKey: string;
  fileName: string;
  seller: SellerMeta;
  marketplaces: string[];
  adapter?: string;
}): { content: string; validation: "PASS" | "FAIL" } {
  if (isForbiddenModuleKey(args.moduleKey) || isForbiddenModuleKey(args.fileName)) return { content: "", validation: "FAIL" };
  const seller = sellerMeta(args.seller);
  const adapter = resolveAdapter(args.adapter ?? "CUSTOM", seller.niche);
  let content = "";
  switch (args.fileName) {
    case "01_Product_Brief.md": content = productBrief(seller, adapter, args.marketplaces); break;
    case "02_PromptBook.md": content = promptBook(seller, adapter); break;
    case "03_PromptLibrary.csv": content = promptLibraryCsv(seller, adapter); break;
    case "04_UsageGuide.md": content = usageGuide(seller, adapter); break;
    case "05_Sample_Input_Output.md": content = sampleInputOutput(seller, adapter); break;
    case "06_QualityChecklist.md": content = qualityChecklist(seller, adapter); break;
    case "07_License_Disclaimer.md": content = licenseDisclaimer(seller); break;
    case "08_ManualUploadGuide.md": content = manualUploadGuide(args.marketplaces); break;
    case "09_Buyer_FAQ.md": content = buyerFAQ(seller); break;
    case "10_Pricing_Recommendation.md": content = pricingRecommendation(seller); break;
    case "11_Thumbnail_Brief.md": content = thumbnailBrief(seller, adapter); break;
    case "12_Product_Manifest.json": content = productManifestJson(seller, adapter, args.marketplaces); break;
    case "13_Ready_to_Upload_Checklist.md": content = readyToUploadChecklist(seller); break;
    case "99_Assumption_Register.md": content = assumptionRegister(seller, adapter, args.marketplaces); break;
    case "QC_Scorecard.md": content = qcScorecardTemplate(seller); break;
    default:
      if (Object.values(MARKETPLACE_MODULES).some((m) => m.file === args.fileName) || args.fileName === MARKETPLACE_BUNDLE_MODULE.file) {
        content = marketplaceListing(args.fileName, seller, adapter, args.marketplaces);
      } else {
        return { content: "", validation: "FAIL" };
      }
  }
  return { content: sanitizeOutput(content), validation: validateGeneratedContent(content) ? "PASS" : "FAIL" };
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
  const add = (id: string, name: string, status: "PASS" | "FAIL" | "WARNING", message: string, details?: Record<string, unknown>) => {
    checks.push({ id, name, status, weight: QC_WEIGHTS[id] ?? 0, message, details });
  };
  const fileSet = new Set(modules.map((m) => m.file_name));
  const moduleKeySet = new Set(modules.map((m) => m.module_key));
  const byFile = (file: string) => modules.find((m) => m.file_name === file);

  const missingCore = REQUIRED_CORE_MODULES.map((m) => m.file).filter((file) => !fileSet.has(file));
  add(QC_CHECK_IDS.ALL_CORE_FILES_EXIST, "Semua core file ada", missingCore.length ? "FAIL" : "PASS", missingCore.length ? `Missing: ${missingCore.join(", ")}` : "Semua core file lengkap.");

  const apiModules = modules.filter((m) => isForbiddenModuleKey(m.module_key) || isForbiddenModuleKey(m.file_name));
  add(QC_CHECK_IDS.NO_API_MODULES, "Tidak ada API_* module", apiModules.length ? "FAIL" : "PASS", apiModules.length ? `API module: ${apiModules.map((m) => m.file_name).join(", ")}` : "Manual upload only aman.");

  const selectedMarketplaces = args.marketplaces ?? [];
  const expectedMarket = marketplaceModulesFor(selectedMarketplaces).map((m) => m.file);
  const missingMarket = expectedMarket.filter((file) => !fileSet.has(file));
  add(QC_CHECK_IDS.SELECTED_MARKETPLACE_FILES_EXIST, "File marketplace terpilih ada", missingMarket.length ? "FAIL" : "PASS", missingMarket.length ? `Missing marketplace file: ${missingMarket.join(", ")}` : "File marketplace terpilih lengkap.");

  const allMarketFiles = Object.values(MARKETPLACE_MODULES).map((m) => m.file).concat(MARKETPLACE_BUNDLE_MODULE.file);
  const unselected = modules.filter((m) => allMarketFiles.includes(m.file_name) && !expectedMarket.includes(m.file_name));
  add(QC_CHECK_IDS.NO_UNSELECTED_MARKETPLACE_FILES, "Tidak ada marketplace tidak dipilih", unselected.length ? "FAIL" : "PASS", unselected.length ? `Unselected: ${unselected.map((m) => m.file_name).join(", ")}` : "Tidak ada marketplace ekstra.");

  const unfinished = modules.filter((m) => m.status !== "acked" || m.validation !== "PASS" || !m.content);
  if (unfinished.length) add("all_modules_acked", "Semua modul selesai", "FAIL", `${unfinished.length} modul belum acked/PASS.`);
  else add("all_modules_acked", "Semua modul selesai", "PASS", "Semua modul acked dan PASS.");

  const placeholderFiles = modules.filter((m) => (m.content || "") && PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(m.content || "")));
  add(QC_CHECK_IDS.NO_PLACEHOLDER_TEXT, "Tidak ada placeholder", placeholderFiles.length ? "FAIL" : "PASS", placeholderFiles.length ? `Placeholder di: ${placeholderFiles.map((m) => m.file_name).join(", ")}` : "Tidak ada placeholder/condensed output.");

  const forbiddenFiles: string[] = [];
  for (const m of modules) {
    const lines = (m.content || "").split(/\r?\n/);
    for (const claim of FORBIDDEN_CLAIMS) {
      const rx = new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      if (lines.some((line) => rx.test(line) && !hasNegation(line))) forbiddenFiles.push(`${m.file_name}: ${claim}`);
    }
  }
  add(QC_CHECK_IDS.NO_FORBIDDEN_CLAIMS, "Tidak ada klaim terlarang", forbiddenFiles.length ? "FAIL" : "PASS", forbiddenFiles.length ? forbiddenFiles.slice(0, 5).join("; ") : "Tidak ada klaim terlarang positif.");

  const pb = byFile("02_PromptBook.md");
  const bodies = extractPromptBodies(pb?.content || "");
  add(QC_CHECK_IDS.PROMPT_COUNT_MATCHES, "Jumlah prompt sesuai", bodies.length === args.promptCount ? "PASS" : "FAIL", `PromptBook: ${bodies.length}, expected: ${args.promptCount}`);
  const uniqueBodies = new Set(bodies).size;
  add(QC_CHECK_IDS.UNIQUE_PROMPT_BODIES, "Prompt body unik", bodies.length > 0 && uniqueBodies === bodies.length ? "PASS" : "FAIL", bodies.length ? `Unique ${uniqueBodies}/${bodies.length}` : "Prompt bodies tidak ditemukan.");

  const csv = byFile("03_PromptLibrary.csv");
  const csvRows = csv?.content ? csvDataRows(csv.content) : 0;
  add(QC_CHECK_IDS.CSV_ROW_COUNT_MATCHES, "CSV row count sesuai", csvRows === args.promptCount ? "PASS" : "FAIL", `CSV rows: ${csvRows}, expected: ${args.promptCount}`);

  const sample = byFile("05_Sample_Input_Output.md");
  const sampleCount = (sample?.content?.match(/^##\s+Sample\s+\d+/gim) || []).length;
  add(QC_CHECK_IDS.SAMPLE_IO_EXISTS, "Sample Input/Output ada", sampleCount >= 3 ? "PASS" : "FAIL", `Sample sections: ${sampleCount}`);

  const license = byFile("07_License_Disclaimer.md");
  add(QC_CHECK_IDS.LICENSE_EXISTS, "License Disclaimer ada", license?.content && /resell this package as-is|menjual ulang prompt pack/i.test(license.content) ? "PASS" : "FAIL", license?.content ? "License ada dan melarang resell as-is." : "License missing.");

  const pricing = byFile("10_Pricing_Recommendation.md");
  add(QC_CHECK_IDS.PRICING_MARKED_HEURISTIC, "Pricing heuristic", pricing?.content && /heuristic only|bersifat heuristic|bukan validasi pasar/i.test(pricing.content) ? "PASS" : "FAIL", "Pricing harus menyebut heuristic only/bukan validasi pasar.");

  const manifest = byFile("12_Product_Manifest.json");
  let manifestValid = false;
  try {
    const parsed = JSON.parse(manifest?.content || "{}");
    manifestValid = parsed.manual_upload_only === true && parsed.api_mode_enabled === false && Array.isArray(parsed.files?.core);
  } catch (_e) { manifestValid = false; }
  add(QC_CHECK_IDS.MANIFEST_JSON_VALID, "Product Manifest JSON valid", manifestValid ? "PASS" : "FAIL", manifestValid ? "Manifest JSON valid." : "Manifest JSON invalid atau field wajib hilang.");

  add(QC_CHECK_IDS.ASSUMPTION_REGISTER_EXISTS, "Assumption Register ada", moduleKeySet.has("99_Assumption_Register") && !!byFile("99_Assumption_Register.md")?.content ? "PASS" : "FAIL", "Assumption Register wajib ada.");
  add(QC_CHECK_IDS.QC_SCORECARD_EXISTS, "QC Scorecard ada", moduleKeySet.has("QC_Scorecard") && !!byFile("QC_Scorecard.md")?.content ? "PASS" : "FAIL", "QC Scorecard wajib ada.");

  const marketContent = modules.filter((m) => expectedMarket.includes(m.file_name));
  const marketplaceOk = !marketContent.length || marketContent.every((m) => /FAQ/i.test(m.content || "") && /Delivery Instructions|Manual upload|Upload Manual/i.test(m.content || ""));
  add(QC_CHECK_IDS.MARKETPLACE_FAQ_AND_DELIVERY, "Marketplace FAQ dan delivery lengkap", marketplaceOk ? "PASS" : "FAIL", marketplaceOk ? "Listing marketplace lengkap." : "Listing marketplace harus punya FAQ dan delivery instruction.");

  const allText = modules.map((m) => m.content || "").join(" ").toLowerCase();
  const reflected = (args.anchors || []).filter((anchor) => {
    const firstMeaningful = normalizeText(anchor).toLowerCase().split(/\s+/).find((w) => w.length > 4);
    return firstMeaningful ? allText.includes(firstMeaningful) : false;
  }).length;
  add(QC_CHECK_IDS.ANCHOR_REFLECTION, "Anchor tercermin", !args.anchors?.length || reflected >= Math.min(3, args.anchors.length) ? "PASS" : "WARNING", `Anchor reflected: ${reflected}/${args.anchors?.length || 0}`);

  const manualDisclaimerOk = modules.filter((m) => /Listing|ManualUpload|Guide|Disclaimer|FAQ|README|Brief/i.test(m.file_name)).every((m) => /manual upload|upload manual|review manual|seller review/i.test(m.content || ""));
  add(QC_CHECK_IDS.MANUAL_UPLOAD_DISCLAIMER, "Manual upload disclaimer", manualDisclaimerOk ? "PASS" : "WARNING", manualDisclaimerOk ? "Manual upload disclaimer tersebar." : "Sebagian file belum menyebut manual upload/review.");

  const score = Math.round(checks.reduce((sum, check) => sum + (check.status === "PASS" ? check.weight : check.status === "WARNING" ? check.weight * 0.5 : 0), 0));
  const blocking = checks.filter((check) => check.status === "FAIL" && (BLOCKING_IDS.has(check.id) || check.id === "all_modules_acked"));
  const errors = blocking.map((check) => check.message || check.name);
  const warnings = checks.filter((check) => check.status === "WARNING" || (check.status === "FAIL" && !BLOCKING_IDS.has(check.id))).map((check) => check.message || check.name);
  return {
    score,
    status: scoreStatus(score),
    blocking_errors: blocking.length,
    errors,
    warnings,
    checks,
    approval_enabled: score >= QC_THRESHOLDS.MIN_SELL_READY && blocking.length === 0,
    generated_at: new Date().toISOString(),
  };
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
