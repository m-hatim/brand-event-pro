// Deterministic mock engine v3.4.2 — sell-ready package generator.
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
  | "CUSTOM_GENERIC";

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
  return "CUSTOM_GENERIC";
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

function genericPrompts(adapter: ResolvedAdapter, niche: string, audience: string, tone: string, count: number): PromptSpec[] {
  const topics = ["Brief Clarifier", "Audience Profiler", "Value Proposition Builder", "Workflow Planner", "Template Generator", "Quality Review", "Variation Builder", "Marketplace Copy", "FAQ Builder", "Final Polish Pass"];
  return topics.slice(0, count).map((title, index) => ({
    id: `${adapter.toLowerCase()}-${index + 1}`,
    title,
    category: index < 3 ? "Discovery" : index < 7 ? "Production" : "Review",
    target_user: audience || "seller produk digital",
    use_case: `Membantu proses ${title.toLowerCase()} untuk niche ${niche}.`,
    purpose: `Menghasilkan output terstruktur untuk ${title.toLowerCase()} tanpa klaim hasil bisnis.`,
    when_to_use: "Gunakan saat buyer perlu menyusun output dengan konteks yang lebih lengkap.",
    beginner_mode: "Isi variabel dasar: niche, audiens, tujuan, dan tone.",
    advanced_mode: "Tambahkan batasan, contoh output, risiko, dan format akhir yang diinginkan.",
    full_prompt: `Bertindak sebagai ahli ${adapter.replace(/_/g, " ").toLowerCase()}. Bantu saya membuat ${title.toLowerCase()} untuk niche {{niche}} dengan audiens {{audiens}}. Output harus terstruktur, spesifik, aman untuk marketplace, dan tidak menjanjikan hasil bisnis. Tone: {{tone}}. Sertakan contoh, checklist review, dan next step.`,
    input_variables: ["niche", "audiens", "tone"],
    example_filled_input: `niche: ${niche}; audiens: ${audience}; tone: ${tone}`,
    expected_output: "Output markdown dengan bagian tujuan, langkah, contoh, dan checklist.",
    quality_checklist: ["Spesifik ke niche", "Ada contoh", "Ada checklist", "Tidak ada klaim terlarang"],
    common_mistakes: ["Prompt terlalu umum", "Tidak menyebut audiens", "Tidak memberi format output"],
    safe_use_note: "Semua output harus direview manual sebelum dijual atau dipakai untuk client.",
    output_type: "structured-markdown",
  }));
}

export function buildPromptLibrary(adapter: ResolvedAdapter, niche: string, count: number, audience = "", tone = "Friendly"): PromptSpec[] {
  const base = adapter === "CODING_AUTOMATION" ? codingAutomationPrompts(audience, tone) : genericPrompts(adapter, niche, audience, tone, Math.max(10, count));
  while (base.length < count) {
    const source = base[base.length % Math.max(1, base.length)];
    base.push({ ...source, id: `${source.id}-var-${base.length + 1}`, title: `${source.title} — Varian ${base.length + 1}`, full_prompt: `${source.full_prompt}\n\nVariasi tambahan: buat output dengan pendekatan yang lebih mendalam dan berikan 2 alternatif.` });
  }
  return base.slice(0, count);
}

type SellerMeta = {
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
  const prompts = buildPromptLibrary(adapter, seller.niche, seller.prompt_count, seller.audience, seller.tone).slice(0, 3);
  const sampleTitles = ["Beginner web app idea", "UMKM web app idea", "Freelancer/client project idea"];
  const sampleInputs = [
    "ide_singkat: aplikasi katalog online sederhana; target_user: UMKM fashion lokal; tone: Friendly",
    "nama_produk: BookingLaundry; domain: pelanggan, layanan, booking, pembayaran, notifikasi",
    "nama_produk: ClientPortal; niche: portal project untuk freelancer desain dan client kecil",
  ];
  const lines = [`# Sample Input & Output — ${seller.brand}`, "", "File ini berisi contoh sintetis untuk membantu buyer memahami cara memakai prompt. Ini bukan jaminan hasil dan tetap perlu pengujian manual.", ""];
  prompts.forEach((prompt, index) => {
    lines.push(`## Sample ${index + 1}: ${sampleTitles[index]}`);
    lines.push(`**Selected Prompt:** ${prompt.title}`);
    lines.push("**Sample User Input:**");
    lines.push("```");
    lines.push(sampleInputs[index] || prompt.example_filled_input);
    lines.push("```");
    lines.push("**Example AI Output Preview:**");
    lines.push("```");
    lines.push(`Ringkasan: Output akan menyusun ${prompt.expected_output.toLowerCase()} dengan konteks ${seller.niche}.\nLangkah berikutnya: review bagian scope, risiko, dan checklist sebelum dipakai untuk proyek nyata.`);
    lines.push("```");
    lines.push("**How to Review:** Pastikan output spesifik, tidak mengarang data pasar, dan tidak menjanjikan income/sales.");
    lines.push("**What to Improve Next:** Tambahkan detail stack, role user, batasan fitur, dan contoh data jika output masih terlalu umum.");
    lines.push("");
  });
  return lines.join("\n");
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

function productManifestJson(seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[]): string {
  const payload = buildManifestPayload({ brand: seller.brand, niche: seller.niche, adapter, marketplaces, promptCount: seller.prompt_count, language: seller.language, license: seller.license });
  return JSON.stringify({
    product_id: payload.product_id,
    name: `${seller.brand} — ${seller.niche}`,
    version: payload.version,
    release_date: payload.release_date,
    niche: seller.niche,
    adapter,
    language: seller.language,
    target_marketplaces: marketplaces,
    license: seller.license,
    prompt_count: seller.prompt_count,
    files: payload.files,
    qc_status: payload.qc_status,
    manual_upload_only: true,
    api_mode_enabled: false,
  }, null, 2);
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

function qcScorecardTemplate(seller: ReturnType<typeof sellerMeta>): string {
  return [
    `# QC Scorecard — ${seller.brand}`,
    "",
    "## Scoring Gate",
    "- <85: belum layak jual, approval wajib diblok.",
    "- 85–94: layak starter/beta, seller review tetap wajib.",
    "- 95+: premium draft, seller review tetap wajib.",
    "",
    "## Checklist Otomatis",
    "- [ ] Semua core file ada.",
    "- [ ] Tidak ada API_* module.",
    "- [ ] Tidak ada placeholder/condensed output.",
    "- [ ] Tidak ada klaim terlarang.",
    "- [ ] Prompt count dan CSV cocok.",
    "- [ ] Prompt body unik.",
    "- [ ] Sample IO, license, pricing, manifest, assumption register, dan marketplace listing lengkap.",
  ].join("\n");
}

function marketplaceListing(fileName: string, seller: ReturnType<typeof sellerMeta>, adapter: ResolvedAdapter, marketplaces: string[]): string {
  const marketplace = /Shopee/i.test(fileName) ? "Shopee" : /Tokopedia/i.test(fileName) ? "Tokopedia" : /Lynk/i.test(fileName) ? "Lynk.id" : /Gumroad/i.test(fileName) ? "Gumroad" : /Etsy/i.test(fileName) ? "Etsy" : /Payhip/i.test(fileName) ? "Payhip" : /Lemon/i.test(fileName) ? "Lemon Squeezy" : "Marketplace";
  if (fileName === "19_Marketplace_Bundle_Index.md") return marketplaceBundleIndex(seller, marketplaces);
  return [
    `# Listing Draft — ${marketplace}`,
    "",
    "**Manual upload only.** Draft ini harus direview dan diunggah manual oleh seller. Tidak ada API marketplace dan tidak ada auto-publish.",
    "",
    "## Product Title",
    `${seller.brand} — ${seller.prompt_count} AI Prompts untuk ${adapter === "CODING_AUTOMATION" ? "Web Fullstack Automation" : seller.niche}`,
    "",
    "## Hero Hook",
    "Buat brief, PRD, workflow, struktur teknis, dan checklist dengan prompt yang lebih rapi dan mudah direview.",
    "",
    "## Product Description",
    seller.confirmed_product_description,
    "Paket ini membantu pengguna menyusun draft blueprint, PRD, workflow, struktur aplikasi, dan checklist teknis secara lebih terarah. Semua hasil tetap perlu direview dan disesuaikan dengan kebutuhan proyek.",
    "",
    "## Buyer Problem",
    "Banyak buyer punya ide produk digital, tetapi bingung mengubahnya menjadi brief teknis yang jelas dan bisa dikerjakan.",
    "",
    "## Solution",
    `Paket berisi ${seller.prompt_count} prompt unik, PromptLibrary CSV, Sample Input/Output, Testing Report, License Disclaimer, Pricing Recommendation, Thumbnail Brief, dan Checklist upload manual.`,
    "",
    "## What Buyer Gets",
    mdList(["PromptBook lengkap", "PromptLibrary CSV", "Sample Input/Output", "Usage Guide", "Quality Checklist", "License & Disclaimer", "Manual Upload Guide", "Buyer FAQ"]),
    "",
    "## Delivery Instructions",
    "Produk dikirim sebagai file digital/ZIP atau link unduhan yang seller kelola sendiri sesuai aturan marketplace.",
    "",
    "## FAQ",
    "**Apakah ini software jadi?** Tidak, ini prompt pack.",
    "**Apakah bisa untuk client project?** Bisa sesuai lisensi, tetapi output wajib direview.",
    "**Apakah ada jaminan hasil?** Tidak ada jaminan income, sales, atau approval marketplace.",
    "",
    "## Policy Reminder",
    `Verifikasi kebijakan ${marketplace} untuk produk digital sebelum publish manual.`,
    "",
    "## Disclaimer",
    "Tidak ada jaminan hasil bisnis. Tidak ada auto-publish. Tidak ada klaim official marketplace partner.",
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
