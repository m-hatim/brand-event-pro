// Deterministic mock engine v3.4.1 — adapter-aware content generators.
// Pure functions only. Browser-safe. No real AI, no marketplace API, no secrets.
import {
  ArchitecturePayload,
  FORBIDDEN_CLAIMS,
  Marketplace,
  isForbiddenModuleKey,
} from "./types";

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
];

export function normalizeText(input: string): string {
  let t = (input ?? "").toString();
  for (const [re, rep] of TYPO_MAP) t = t.replace(re, rep);
  return t.replace(/\s+/g, " ").trim();
}

export function correctDescription(input: string): string {
  let t = normalizeText(input);
  if (!t) return "";
  for (const f of FORBIDDEN_CLAIMS) {
    t = t.replace(new RegExp(f, "ig"), "berpotensi membantu");
  }
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase());
  t = t.replace(/([.!?]){2,}/g, "$1");
  if (!/[.!?]$/.test(t)) t += ".";
  if (t.length < 280) {
    t +=
      " Cocok untuk seller yang ingin paket prompt yang rapi, jelas, dan siap dipakai untuk marketplace atau media sosial. Semua upload dilakukan manual oleh seller.";
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
  const niche = normalizeText(args.niche ?? "").toLowerCase();
  const audience = normalizeText(args.audience ?? "").toLowerCase();
  if (niche) anchors.add(niche.split(/[,.;]/)[0].slice(0, 80));
  if (audience) {
    const first = audience.split(/[,.;]/)[0].trim();
    if (first) anchors.add(`untuk ${first}`);
  }
  const adapter = (args.adapter ?? "CUSTOM").toUpperCase();
  const themed = adapterThemeAnchors(adapter, niche);
  themed.forEach((a) => anchors.add(a));
  if (args.marketplaces?.length) {
    anchors.add(`siap upload manual ke ${args.marketplaces.slice(0, 3).join("/")}`);
  } else {
    anchors.add("siap upload manual ke marketplace");
  }
  if (args.tone) anchors.add(`gaya bahasa ${args.tone.toLowerCase()}`);
  return Array.from(anchors).slice(0, 8);
}

function adapterThemeAnchors(adapter: string, niche: string): string[] {
  switch (resolveAdapter(adapter, niche)) {
    case "CODING_AUTOMATION":
      return [
        "fullstack web automation",
        "PRD dan arsitektur sistem",
        "database & auth planning",
        "workflow automation",
        "testing & deployment checklist",
      ];
    case "TEXT_TO_IMAGE":
      return ["prompt visual detail", "komposisi & pencahayaan", "style reference", "negative prompt", "siap untuk Midjourney/SDXL"];
    case "IMAGE_EDITING":
      return ["instruksi edit presisi", "masking & area kerja", "before/after brief", "style preservation"];
    case "TEXT_TO_VIDEO":
      return ["scene & shot list", "kamera & motion", "durasi & rasio", "siap untuk Runway/Veo/Sora"];
    case "ACADEMIC_WRITING":
      return ["struktur akademik", "sitasi & referensi", "tone formal", "argumen berbasis bukti"];
    case "RESEARCH":
      return ["research question framing", "literature mapping", "sintesis temuan", "analisis kritis"];
    case "CONTENT_CREATION":
      return ["hook & storytelling", "ide konten harian", "caption marketplace", "varian tone"];
    case "BUSINESS_MARKETING":
      return ["positioning & USP", "funnel awareness-konversi", "copy hard & soft sell", "objection handling"];
    default:
      return ["paket prompt rapi", "panduan pemakaian jelas", "siap untuk UMKM dan seller online"];
  }
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
  const a = (adapter ?? "").toUpperCase();
  if (a && a !== "CUSTOM") {
    if (
      [
        "CODING_AUTOMATION",
        "TEXT_TO_IMAGE",
        "IMAGE_EDITING",
        "TEXT_TO_VIDEO",
        "ACADEMIC_WRITING",
        "RESEARCH",
        "CONTENT_CREATION",
        "BUSINESS_MARKETING",
      ].includes(a)
    ) {
      return a as ResolvedAdapter;
    }
  }
  const n = normalizeText(niche).toLowerCase();
  if (/(web|fullstack|backend|frontend|automation|automasi|coding|api|saas|app)/.test(n)) return "CODING_AUTOMATION";
  if (/(image|gambar|ilustrasi|midjourney|sdxl|flux)/.test(n)) return "TEXT_TO_IMAGE";
  if (/(edit foto|retouch|photoshop|edit gambar)/.test(n)) return "IMAGE_EDITING";
  if (/(video|reel|tiktok|runway|sora|veo)/.test(n)) return "TEXT_TO_VIDEO";
  if (/(akademik|skripsi|tesis|jurnal|paper)/.test(n)) return "ACADEMIC_WRITING";
  if (/(riset|research|literatur)/.test(n)) return "RESEARCH";
  if (/(konten|caption|copywriting|sosial media|content)/.test(n)) return "CONTENT_CREATION";
  if (/(bisnis|marketing|sales|funnel|brand)/.test(n)) return "BUSINESS_MARKETING";
  return "CUSTOM_GENERIC";
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
  const niche = normalizeText(input.niche || "produk prompt");
  const audience = normalizeText(input.audience || "UMKM dan seller online");
  const mps = (input.marketplaces?.length ? input.marketplaces : ["Shopee", "Tokopedia"]).join(", ");
  const resolved = resolveAdapter(input.adapter || "CUSTOM", niche);
  return {
    product_positioning: `${brand} memposisikan paket prompt untuk niche "${niche}" (adapter terdeteksi: ${resolved}) dengan tone ${input.tone || "Friendly"}. Fokus pada manfaat praktis yang siap dipakai seller.`,
    target_audience_fit: `Audiens utama: ${audience}. Materi disusun agar mudah dipahami non-teknis dan langsung bisa diterapkan pada listing marketplace.`,
    weakness_detection: `Deskripsi awal perlu penegasan diferensiasi dari kompetitor dan contoh penggunaan konkret. Klaim sales/penghasilan tidak digunakan (kebijakan internal).`,
    prompt_architecture_overview: `Struktur paket: pengantar, panduan penggunaan, ${input.promptCount ?? 10} prompt utama yang disesuaikan dengan adapter ${resolved}, CSV index, dan panduan publish manual.`,
    marketplace_preview: `Marketplace target (manual upload): ${mps}. Setiap marketplace mendapat draft listing terpisah dengan judul, deskripsi, dan tag yang seller-safe.`,
    qc_readiness: `Kesiapan QC: cek jumlah prompt, cek CSV row count, cek anchor reflection, scan klaim terlarang, deteksi placeholder/duplikasi, scan modul forbidden (API_*).`,
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
  { key: "01_README", file: "01_README.md", chunks: 1 },
  { key: "02_PromptBook", file: "02_PromptBook.md", chunks: 1 },
  { key: "03_PromptIndex", file: "03_PromptIndex.csv", chunks: 1 },
  { key: "04_UsageGuide", file: "04_UsageGuide.md", chunks: 1 },
  { key: "05_QualityChecklist", file: "05_QualityChecklist.md", chunks: 1 },
  { key: "06_ManualUploadGuide", file: "06_ManualUploadGuide.md", chunks: 1 },
];

export function marketplaceModulesFor(marketplaces: string[]) {
  return marketplaces
    .map((m) => ({
      key: `MARKETPLACE_${m.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_LISTING`,
      file: `10_Listing_${m.replace(/[^A-Za-z0-9]+/g, "")}.md`,
      chunks: 1,
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
  const bundleIndex = { key: "11_BundleIndex", file: "11_BundleIndex.md", chunks: 1 };
  const modules = [...core, ...mp, bundleIndex].filter((m) => !isForbiddenModuleKey(m.key));
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

// ---------- Adapter-specific prompt libraries ----------
interface PromptSpec {
  title: string;
  use_case: string;
  best_for: string;
  full_prompt: string;
  input_variables: string[];
  expected_output: string;
  quality_checklist: string[];
  notes: string;
  category: string;
  output_type: string;
}

function codingAutomationPrompts(): PromptSpec[] {
  return [
    {
      title: "Fullstack Web Product Idea Clarifier",
      use_case: "Memperjelas ide produk web fullstack sebelum dibangun.",
      best_for: "Founder/seller yang punya ide kasar tapi belum terstruktur.",
      full_prompt:
        "Saya punya ide produk web: {{ide_singkat}}. Target user: {{target_user}}. Bantu saya menyusun: 1) one-liner produk, 2) masalah utama yang dipecahkan, 3) 3 alternatif pendekatan teknis (no-code, low-code, custom fullstack), 4) trade-off masing-masing, 5) rekomendasi terbaik untuk pemula vs advanced.",
      input_variables: ["ide_singkat", "target_user"],
      expected_output: "Ringkasan terstruktur dengan tabel trade-off dan rekomendasi.",
      quality_checklist: ["One-liner < 20 kata", "Minimal 3 alternatif", "Ada rekomendasi eksplisit"],
      notes: "Jangan klaim hasil bisnis. Output hanya kerangka, bukan jaminan.",
      category: "Discovery",
      output_type: "structured-text",
    },
    {
      title: "User Requirement Interview Prompt",
      use_case: "Menggali requirement dari calon user secara terstruktur.",
      best_for: "Tahap discovery sebelum PRD.",
      full_prompt:
        "Bertindak sebagai product researcher. Susun 10 pertanyaan wawancara untuk user {{persona}} terkait kebutuhan mereka pada produk {{produk}}. Bagi menjadi: konteks, pain points, current workaround, willingness to pay, dan deal-breakers.",
      input_variables: ["persona", "produk"],
      expected_output: "Daftar 10 pertanyaan dikelompokkan per kategori.",
      quality_checklist: ["Tidak leading", "Mencakup 5 kategori", "Open-ended"],
      notes: "Wawancara nyata wajib persetujuan partisipan.",
      category: "Discovery",
      output_type: "question-list",
    },
    {
      title: "PRD Generator for Web App",
      use_case: "Membuat Product Requirement Document siap pakai.",
      best_for: "Seller yang akan menyerahkan brief ke developer.",
      full_prompt:
        "Susun PRD untuk web app {{nama_produk}}. Sertakan: ringkasan, goal & non-goal, persona, user story (format As a / I want / so that), fitur MVP vs v2, success metric, asumsi, dan risiko. Niche: {{niche}}.",
      input_variables: ["nama_produk", "niche"],
      expected_output: "Dokumen PRD lengkap dengan section headers.",
      quality_checklist: ["Ada goal & non-goal", "≥5 user story", "Success metric terukur"],
      notes: "PRD draft — harus direview seller/PM sebelum eksekusi.",
      category: "Spec",
      output_type: "document",
    },
    {
      title: "User Flow and Feature Mapping Prompt",
      use_case: "Memetakan flow user dari awal sampai konversi.",
      best_for: "Designer/PM merencanakan UX.",
      full_prompt:
        "Untuk produk {{nama_produk}}, buat user flow utama dalam bentuk langkah bernomor: entry → onboarding → core action → retention. Tandai titik gesekan dan fitur pendukung di tiap langkah.",
      input_variables: ["nama_produk"],
      expected_output: "Flow bernomor + tabel friction & fitur.",
      quality_checklist: ["Mencakup 4 fase", "Friction eksplisit", "Fitur teridentifikasi"],
      notes: "Validasi flow dengan user nyata sebelum build.",
      category: "UX",
      output_type: "flow",
    },
    {
      title: "Database Schema Planning Prompt",
      use_case: "Merancang skema database awal untuk web app.",
      best_for: "Developer/seller teknis tahap arsitektur.",
      full_prompt:
        "Rancang skema database untuk {{nama_produk}} (Postgres). Output: daftar tabel, kolom, tipe data, primary/foreign key, dan index yang direkomendasikan. Sertakan tabel auth, profil, dan domain utama: {{domain}}.",
      input_variables: ["nama_produk", "domain"],
      expected_output: "Tabel skema + alasan singkat tiap relasi.",
      quality_checklist: ["Ada PK/FK", "Ada index pada kolom query panas", "Normalisasi wajar (3NF)"],
      notes: "Tambahkan RLS jika pakai Supabase. Review oleh DBA.",
      category: "Architecture",
      output_type: "schema",
    },
    {
      title: "Auth and User Role Planning Prompt",
      use_case: "Merencanakan model auth dan role.",
      best_for: "Produk dengan multi-role (admin, user, dst).",
      full_prompt:
        "Rancang model auth & role untuk {{nama_produk}}. Sertakan: metode login (email, OAuth), daftar role, matrix permission per resource, kebijakan password, dan strategi session/refresh token.",
      input_variables: ["nama_produk"],
      expected_output: "Tabel permission matrix + flow login.",
      quality_checklist: ["Role minimal 2", "Matrix lengkap CRUD", "Ada strategi token"],
      notes: "Simpan role di tabel terpisah; jangan di profile.",
      category: "Architecture",
      output_type: "matrix",
    },
    {
      title: "Frontend Page Structure Generator",
      use_case: "Menyusun struktur halaman frontend.",
      best_for: "Designer/FE engineer tahap awal.",
      full_prompt:
        "Untuk {{nama_produk}}, susun daftar halaman frontend: route, tujuan, komponen utama, dan state yang dibutuhkan. Bedakan halaman publik vs auth.",
      input_variables: ["nama_produk"],
      expected_output: "Tabel route × tujuan × komponen × state.",
      quality_checklist: ["Ada route publik & auth", "Komponen reusable disorot", "State minimal"],
      notes: "Gunakan React Router atau framework yang sudah dipilih.",
      category: "Frontend",
      output_type: "table",
    },
    {
      title: "Backend/API Logic Planner",
      use_case: "Memetakan endpoint dan logic backend.",
      best_for: "BE engineer dan integrator.",
      full_prompt:
        "Susun daftar endpoint REST/RPC untuk {{nama_produk}}: method, path, input, output, auth required, dan side-effect. Kelompokkan per domain: {{domain}}.",
      input_variables: ["nama_produk", "domain"],
      expected_output: "Tabel endpoint lengkap dengan contoh payload.",
      quality_checklist: ["Method tepat", "Auth eksplisit", "Side-effect ditandai"],
      notes: "Gunakan idempotent method bila memungkinkan.",
      category: "Backend",
      output_type: "api-spec",
    },
    {
      title: "Automation Workflow Planner",
      use_case: "Merancang workflow automation (cron, webhook, queue).",
      best_for: "Produk yang perlu background job.",
      full_prompt:
        "Rancang workflow automation untuk {{nama_produk}}: trigger, langkah, retry policy, dead-letter, dan observability. Sertakan minimal 3 workflow penting.",
      input_variables: ["nama_produk"],
      expected_output: "Diagram langkah + tabel retry/observability.",
      quality_checklist: ["Trigger jelas", "Retry policy ada", "Logging/alerting tercantum"],
      notes: "Gunakan tool yang sudah dipakai tim (n8n, Temporal, dll).",
      category: "Automation",
      output_type: "workflow",
    },
    {
      title: "Testing, Deployment, and Maintenance Checklist Prompt",
      use_case: "Checklist sebelum launch dan setelah live.",
      best_for: "Tim kecil yang launch mandiri.",
      full_prompt:
        "Susun checklist untuk {{nama_produk}} mencakup: unit/integration test, E2E happy path, staging deploy, production deploy, rollback plan, monitoring, backup, dan maintenance window.",
      input_variables: ["nama_produk"],
      expected_output: "Checklist terbagi pre-launch, launch, post-launch.",
      quality_checklist: ["Ada rollback plan", "Backup terjadwal", "Monitoring eksplisit"],
      notes: "Checklist draft — sesuaikan dengan stack aktual.",
      category: "Ops",
      output_type: "checklist",
    },
  ];
}

function textToImagePrompts(): PromptSpec[] {
  const base = [
    ["Hero Product Shot", "Foto produk hero untuk listing", "Seller marketplace"],
    ["Lifestyle Scene", "Adegan lifestyle penggunaan produk", "Konten sosial media"],
    ["Minimalist Studio", "Studio minimalis background polos", "Katalog produk"],
    ["Festive Seasonal", "Tema musiman (lebaran, natal, dll)", "Campaign musiman"],
    ["Top-Down Flatlay", "Flatlay top-down untuk feed IG", "Visual brand"],
    ["Macro Detail", "Close-up tekstur dan detail", "Highlight kualitas"],
    ["Editorial Magazine", "Gaya editorial majalah", "Brand premium"],
    ["Outdoor Natural Light", "Outdoor cahaya alami", "Brand outdoor/lifestyle"],
    ["Color-Pop Background", "Background warna kontras", "Brand muda/playful"],
    ["Bundle Group Shot", "Foto grup produk bundle", "Listing bundle"],
  ];
  return base.map(([t, uc, bf]) => ({
    title: t,
    use_case: uc,
    best_for: bf,
    full_prompt: `Generate image of {{produk}} as ${t.toLowerCase()}: subject centered, ${uc.toLowerCase()}, professional composition, soft natural lighting, shallow depth of field, 4k, photorealistic, brand mood: {{mood}}. Negative: blurry, distorted text, watermark.`,
    input_variables: ["produk", "mood"],
    expected_output: "Gambar 1:1 atau 4:5 berkualitas tinggi.",
    quality_checklist: ["Subjek jelas", "Tidak ada teks rusak", "Sesuai mood brand"],
    notes: "Selalu review hak cipta style reference.",
    category: "Visual",
    output_type: "image-prompt",
  }));
}

function genericPrompts(adapter: ResolvedAdapter, niche: string): PromptSpec[] {
  const themes: Record<ResolvedAdapter, string[]> = {
    CODING_AUTOMATION: [],
    TEXT_TO_IMAGE: [],
    IMAGE_EDITING: ["Background Removal Brief", "Color Grading Instruction", "Object Cleanup", "Skin Retouch Natural", "Product Reshoot Match", "Composite Two Images", "Style Transfer", "Resize & Crop for Marketplace", "Add Branded Frame", "Restoration Old Photo"],
    TEXT_TO_VIDEO: ["Hook 3-Second Reel", "Product Demo 15s", "Storyboard 30s Ad", "Tutorial Voiceover Script", "UGC Style Testimonial", "B-Roll Shot List", "Cinematic Brand Teaser", "Before/After Transition", "Listicle Top 5", "Seasonal Campaign Spot"],
    ACADEMIC_WRITING: ["Abstract Generator", "Literature Review Synthesizer", "Methodology Drafting", "Result Discussion Builder", "Citation Formatter Brief", "Counter-Argument Mapper", "Hypothesis Refiner", "Thesis Outline Generator", "Peer-Review Response", "Plagiarism Self-Check Guide"],
    RESEARCH: ["Research Question Refiner", "Source Triangulation", "Interview Guide Builder", "Survey Question Designer", "Data Coding Schema", "Thematic Analysis Helper", "Competitor Landscape Scan", "Trend Synthesis", "Insight-to-Action Mapper", "Executive Summary Drafter"],
    CONTENT_CREATION: ["Hook Generator", "Caption with CTA", "Carousel 5-Slide Outline", "Story Script 15s", "Newsletter Section", "Blog Outline SEO", "Comment Reply Templates", "Bio Optimizer", "Hashtag Cluster Builder", "Repurposing Plan 1-to-5"],
    BUSINESS_MARKETING: ["Positioning Statement", "USP Refiner", "Lead Magnet Idea", "Email Sequence 5-Day", "Sales Page Outline", "Objection Handler", "Pricing Anchor Frame", "Upsell/Cross-sell Brief", "Funnel Diagnostic", "Retention Playbook"],
    CUSTOM_GENERIC: ["Brief Clarifier", "Audience Profiler", "Value Proposition Builder", "Outline Generator", "Variation Tone Switcher", "Quality Self-Check", "Localization Brief", "Risk & Claim Scanner", "Improvement Loop", "Final Polish Pass"],
  };
  const list = themes[adapter] ?? themes.CUSTOM_GENERIC;
  return list.map((t, i) => ({
    title: t,
    use_case: `Membantu seller pada tahap ${t.toLowerCase()} untuk niche ${niche}.`,
    best_for: `Seller adapter ${adapter} tahap ${i < 3 ? "discovery" : i < 7 ? "produksi" : "review"}.`,
    full_prompt: `Bertindak sebagai ahli ${adapter.toLowerCase().replace(/_/g, " ")}. Bantu saya pada tugas: ${t}. Niche: {{niche}}. Audiens: {{audiens}}. Output: panduan terstruktur dengan langkah-langkah konkret dan contoh, hindari klaim hasil bisnis. Tone: {{tone}}.`,
    input_variables: ["niche", "audiens", "tone"],
    expected_output: `Output terstruktur khusus untuk ${t}.`,
    quality_checklist: ["Spesifik ke niche", "Ada contoh", "Tidak ada klaim terlarang"],
    notes: "Draft mock — wajib direview seller sebelum dipakai.",
    category: t.split(" ")[0],
    output_type: "structured-text",
  }));
}

export function buildPromptLibrary(adapter: ResolvedAdapter, niche: string, count: number): PromptSpec[] {
  let lib: PromptSpec[];
  if (adapter === "CODING_AUTOMATION") lib = codingAutomationPrompts();
  else if (adapter === "TEXT_TO_IMAGE") lib = textToImagePrompts();
  else lib = genericPrompts(adapter, niche);
  // Pad if count > 10
  while (lib.length < count) {
    const idx = lib.length;
    const base = lib[idx % 10];
    lib.push({
      ...base,
      title: `${base.title} — Varian ${Math.floor(idx / 10) + 1}`,
      full_prompt: base.full_prompt + ` Variasi: berikan pendekatan alternatif yang lebih ${idx % 2 === 0 ? "ringkas" : "mendalam"}.`,
    });
  }
  return lib.slice(0, count);
}

// ---------- File content generators ----------
function readme(seller: any, adapter: ResolvedAdapter, marketplaces: string[]): string {
  const brand = seller.brand || "Brand Anda";
  const niche = normalizeText(seller.niche || "");
  const audience = normalizeText(seller.audience || "");
  return [
    `# ${brand} — Paket Prompt: ${niche}`,
    ``,
    `## Produk`,
    `Paket prompt siap pakai dengan ${seller.prompt_count ?? 10} prompt unik untuk niche **${niche}** (adapter: ${adapter}).`,
    ``,
    `## Untuk Siapa`,
    `- ${audience || "UMKM dan seller online"}`,
    `- Seller marketplace yang ingin output prompt yang konsisten dan rapi`,
    ``,
    `## Masalah yang Dipecahkan`,
    `- Bingung mulai dari mana saat menulis prompt`,
    `- Output AI sering generic karena prompt terlalu pendek`,
    `- Butuh template yang langsung bisa dipakai tanpa harus belajar prompt engineering dari nol`,
    ``,
    `## Isi Paket`,
    `- 01_README.md — Pengantar paket`,
    `- 02_PromptBook.md — Kumpulan prompt utama`,
    `- 03_PromptIndex.csv — Index siap import spreadsheet`,
    `- 04_UsageGuide.md — Cara pakai langkah demi langkah`,
    `- 05_QualityChecklist.md — Checklist kualitas`,
    `- 06_ManualUploadGuide.md — Panduan upload manual`,
    `- 10_Listing_*.md — Draft listing per marketplace (${marketplaces.join(", ") || "—"})`,
    `- 11_BundleIndex.md — Daftar lengkap & urutan upload`,
    ``,
    `## Cara Pakai Singkat`,
    `1. Baca 04_UsageGuide.md`,
    `2. Pilih prompt di 02_PromptBook.md`,
    `3. Isi variabel dalam tanda \`{{...}}\``,
    `4. Jalankan di tool AI favorit Anda`,
    `5. Review hasil dengan 05_QualityChecklist.md`,
    ``,
    `## Disclaimer Upload Manual`,
    `Semua listing harus di-upload **manual** oleh seller ke marketplace masing-masing. Paket ini tidak melakukan publish otomatis dan tidak terhubung ke API marketplace apapun.`,
    ``,
    `## Seller Review Required`,
    `Seller wajib mereview seluruh isi paket sebelum diserahkan ke pembeli. Sesuaikan klaim, harga, dan kebijakan dengan kebijakan marketplace tujuan.`,
  ].join("\n");
}

function promptBook(seller: any, adapter: ResolvedAdapter): string {
  const niche = normalizeText(seller.niche || "");
  const lib = buildPromptLibrary(adapter, niche, seller.prompt_count ?? 10);
  const lines: string[] = [`# PromptBook — ${seller.brand || "Brand Anda"}`, ``, `Adapter: ${adapter} • Niche: ${niche} • Tone: ${seller.tone || "Friendly"}`, ``];
  lib.forEach((p, i) => {
    lines.push(`## ${i + 1}. ${p.title}`);
    lines.push(`**Use Case:** ${p.use_case}`);
    lines.push(`**Best For:** ${p.best_for}`);
    lines.push(``);
    lines.push(`**Full Prompt:**`);
    lines.push("```");
    lines.push(p.full_prompt);
    lines.push("```");
    lines.push(`**Input Variables:** ${p.input_variables.map((v) => `\`{{${v}}}\``).join(", ")}`);
    lines.push(`**Expected Output:** ${p.expected_output}`);
    lines.push(`**Quality Checklist:**`);
    p.quality_checklist.forEach((c) => lines.push(`- [ ] ${c}`));
    lines.push(`**Notes / Safe Use:** ${p.notes}`);
    lines.push(``);
  });
  return lines.join("\n");
}

function promptIndexCsv(seller: any, adapter: ResolvedAdapter): string {
  const niche = normalizeText(seller.niche || "");
  const lib = buildPromptLibrary(adapter, niche, seller.prompt_count ?? 10);
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = ["no,title,category,target_user,use_case,tone,output_type"];
  lib.forEach((p, i) => {
    rows.push(
      [i + 1, esc(p.title), esc(p.category), esc(seller.audience || "seller"), esc(p.use_case), esc(seller.tone || "Friendly"), esc(p.output_type)].join(",")
    );
  });
  return rows.join("\n");
}

function usageGuide(seller: any, adapter: ResolvedAdapter): string {
  if (adapter === "CODING_AUTOMATION") {
    return [
      `# Usage Guide — Coding & Automation`,
      ``,
      `Panduan pemakaian paket prompt fullstack/web automation untuk niche **${normalizeText(seller.niche || "")}**.`,
      ``,
      `## Cara memakai prompt pack`,
      `Buka 02_PromptBook.md, pilih prompt sesuai tahap kerja (discovery, spec, arsitektur, frontend, backend, automation, ops). Isi variabel \`{{...}}\` dengan konteks Anda.`,
      ``,
      `## Cara menyiapkan ide project web`,
      `Mulai dari pain point user. Tulis satu kalimat masalah, satu kalimat target user, dan satu kalimat hasil yang diharapkan. Pakai prompt "Fullstack Web Product Idea Clarifier".`,
      ``,
      `## Cara membuat PRD`,
      `Pakai prompt "PRD Generator for Web App". Pastikan goal, non-goal, persona, user story, success metric, dan risiko ada di output.`,
      ``,
      `## Cara membuat daftar fitur`,
      `Bedakan fitur MVP vs v2. Pakai bagian "User Flow and Feature Mapping Prompt" untuk memetakan flow dari entry sampai retention.`,
      ``,
      `## Cara merancang database`,
      `Pakai prompt "Database Schema Planning". Output minimal: daftar tabel, kolom, tipe data, PK/FK, dan index. Tambahkan RLS jika menggunakan Postgres terkelola.`,
      ``,
      `## Cara merancang auth dan role user`,
      `Pakai prompt "Auth and User Role Planning". Simpan role pada tabel terpisah (jangan di profil) dan susun permission matrix per resource.`,
      ``,
      `## Cara merancang frontend pages`,
      `Pakai "Frontend Page Structure Generator". Tandai route publik vs auth, komponen reusable, dan state minimum tiap halaman.`,
      ``,
      `## Cara merancang backend/API logic`,
      `Pakai "Backend/API Logic Planner". Catat method, path, input, output, auth, dan side-effect tiap endpoint.`,
      ``,
      `## Cara merancang automation workflow`,
      `Pakai "Automation Workflow Planner". Definisikan trigger, langkah, retry policy, dead-letter, dan observability tiap workflow.`,
      ``,
      `## Cara testing dan deployment`,
      `Pakai "Testing, Deployment, and Maintenance Checklist". Susun checklist pre-launch (unit/integration/E2E), launch (staging, prod, rollback), dan post-launch (monitoring, backup).`,
      ``,
      `## Cara memakai hasil untuk pemula dan advanced user`,
      `Pemula: ikuti urutan prompt dari atas ke bawah dan terima output apa adanya, lalu sesuaikan satu variabel sekali jalan. Advanced: gabungkan beberapa prompt, lakukan iterasi, dan tambahkan konteks domain spesifik tim Anda.`,
      ``,
      `## Manual Upload Reminder`,
      `Semua listing diupload manual oleh seller. Tidak ada publish otomatis.`,
    ].join("\n");
  }
  return [
    `# Usage Guide`,
    ``,
    `Panduan ini menjelaskan cara menggunakan paket prompt untuk niche **${normalizeText(seller.niche || "")}** (adapter ${adapter}).`,
    ``,
    `## Langkah 1 — Pilih Prompt`,
    `Buka 02_PromptBook.md dan pilih prompt sesuai tahap kerja Anda (discovery, produksi, atau review).`,
    ``,
    `## Langkah 2 — Isi Variabel`,
    `Setiap prompt berisi placeholder \`{{nama_variabel}}\`. Ganti dengan konteks Anda. Contoh: \`{{produk}}\` → "Sepatu Lari X".`,
    ``,
    `## Langkah 3 — Jalankan di Tool AI`,
    `Tempel prompt di tool AI generatif (ChatGPT, Claude, Gemini, Midjourney, dll) sesuai jenis output yang diharapkan.`,
    ``,
    `## Langkah 4 — Uji Tiap Prompt`,
    `Coba minimal 2 kali per prompt dengan input berbeda. Cek apakah output konsisten dan relevan.`,
    ``,
    `## Langkah 5 — Perbaiki Hasil`,
    `Jika output kurang tajam: persempit \`{{niche}}\`, tambah konteks audiens, atau minta variasi dengan kata "berikan 3 alternatif".`,
    ``,
    `## Tips Meningkatkan Kualitas`,
    `- Spesifik > umum. Tambah angka, kategori, dan contoh.`,
    `- Pisahkan task besar menjadi prompt-prompt kecil.`,
    `- Gunakan 05_QualityChecklist.md untuk review akhir.`,
    ``,
    `## Manual Upload Reminder`,
    `Semua listing diupload manual oleh seller. Tidak ada publish otomatis.`,
  ].join("\n");
}

function qualityChecklist(seller: any, adapter: ResolvedAdapter = "CUSTOM_GENERIC"): string {
  if (adapter === "CODING_AUTOMATION") {
    return [
      `# Quality Checklist — Coding & Automation`,
      ``,
      `## Checklist PRD`,
      `- [ ] Goal dan non-goal jelas`,
      `- [ ] Minimal 5 user story format As a / I want / so that`,
      `- [ ] Success metric terukur`,
      `- [ ] Asumsi dan risiko tercantum`,
      ``,
      `## Checklist fitur`,
      `- [ ] Fitur MVP vs v2 terpisah`,
      `- [ ] Tiap fitur punya acceptance criteria`,
      `- [ ] Prioritas (must/should/could) ditandai`,
      ``,
      `## Checklist database schema`,
      `- [ ] Semua tabel punya primary key`,
      `- [ ] Foreign key dan relasi konsisten`,
      `- [ ] Index pada kolom query panas`,
      `- [ ] Normalisasi wajar (3NF) atau alasan denormalisasi`,
      ``,
      `## Checklist auth dan role`,
      `- [ ] Metode login eksplisit`,
      `- [ ] Role disimpan di tabel terpisah`,
      `- [ ] Permission matrix lengkap (CRUD per resource)`,
      `- [ ] Strategi token/session ditentukan`,
      ``,
      `## Checklist frontend UI`,
      `- [ ] Route publik dan auth dibedakan`,
      `- [ ] Komponen reusable diidentifikasi`,
      `- [ ] State minimum dan loading/empty state ada`,
      ``,
      `## Checklist backend/API`,
      `- [ ] Method dan path konsisten`,
      `- [ ] Validasi input setiap endpoint`,
      `- [ ] Auth required per endpoint dicatat`,
      `- [ ] Error response terstandar`,
      ``,
      `## Checklist automation workflow`,
      `- [ ] Trigger jelas (cron, event, webhook)`,
      `- [ ] Retry policy dan dead-letter ada`,
      `- [ ] Observability (log, metric, alert) ada`,
      ``,
      `## Checklist security`,
      `- [ ] Tidak ada secret di repo`,
      `- [ ] RLS atau ACL aktif untuk data sensitif`,
      `- [ ] Input divalidasi server-side`,
      `- [ ] Rate limiting pada endpoint kritis`,
      ``,
      `## Checklist testing`,
      `- [ ] Unit test untuk logic inti`,
      `- [ ] Integration test untuk API utama`,
      `- [ ] E2E happy path teruji`,
      ``,
      `## Checklist deployment`,
      `- [ ] Pipeline CI/CD berjalan`,
      `- [ ] Staging mirror produksi`,
      `- [ ] Rollback plan tertulis`,
      `- [ ] Monitoring dan backup terjadwal`,
      ``,
      `## Checklist klaim aman`,
      `- [ ] Tidak menjanjikan income`,
      `- [ ] Tidak menjamin produk laku`,
      `- [ ] Tidak menjamin angka sales`,
      `- [ ] Tidak mengklaim status approval marketplace`,
      ``,
      `## Branding & Lisensi`,
      `- [ ] Branding (${seller.brand || "Brand Anda"}) konsisten`,
      `- [ ] Lisensi (${seller.license || "Personal & Commercial"}) tercantum`,
      `- [ ] Disclaimer manual upload ada di setiap listing`,
    ].join("\n");
  }
  return [
    `# Quality Checklist`,
    ``,
    `## Buyer-side`,
    `- [ ] Paket berisi semua file sesuai 11_BundleIndex.md`,
    `- [ ] Setiap prompt punya variabel jelas`,
    `- [ ] Contoh penggunaan tersedia`,
    `- [ ] Output bisa direproduksi`,
    ``,
    `## Seller-side`,
    `- [ ] Sudah membaca kebijakan marketplace tujuan`,
    `- [ ] Harga & lisensi sesuai (${seller.license || "Personal & Commercial"})`,
    `- [ ] Branding (${seller.brand || "Brand Anda"}) konsisten di semua file`,
    `- [ ] Tidak menjanjikan income atau menjamin produk laku`,
    ``,
    `## Output Review`,
    `- [ ] Tidak ada teks template kosong di seluruh modul`,
    `- [ ] Tidak ada prompt body identik berulang`,
    `- [ ] CSV index valid dan jumlah baris cocok`,
    `- [ ] Anchor utama tercermin di README/PromptBook`,
    ``,
    `## Safety / Claim`,
    `- [ ] Tidak menjanjikan hasil bisnis`,
    `- [ ] Tidak mengaku partner resmi marketplace`,
    `- [ ] Tidak mengaku publish otomatis`,
    `- [ ] Disclaimer manual upload tertulis di tiap listing`,
  ].join("\n");
}

function manualUploadGuide(marketplaces: string[]): string {
  return [
    `# Manual Upload Guide`,
    ``,
    `## Packing File`,
    `1. Kumpulkan seluruh file dari 11_BundleIndex.md.`,
    `2. Kompres menjadi ZIP dengan nama \`paket-prompt-{brand}-{tanggal}.zip\`.`,
    `3. Sertakan thumbnail/cover terpisah jika diminta marketplace.`,
    ``,
    `## Upload Manual ke Marketplace`,
    ...marketplaces.map((m) => `- **${m}**: Login → buat produk baru → upload ZIP → tempel listing dari 10_Listing_${m.replace(/[^A-Za-z0-9]+/g, "")}.md`),
    ``,
    `## Kebijakan Marketplace`,
    `- Verifikasi kebijakan Shopee/Tokopedia/Lynk.id terkait produk digital sebelum publish.`,
    `- Sesuaikan kategori dan tag dengan aturan tiap platform.`,
    `- Jangan klaim publish otomatis atau partnership.`,
    ``,
    `## Tidak Ada Publish Otomatis`,
    `Sistem ini **tidak** terhubung ke API marketplace. Semua upload dilakukan manual oleh seller.`,
  ].join("\n");
}

function listingShopee(seller: any, adapter: ResolvedAdapter): string {
  const brand = seller.brand || "Brand Anda";
  const niche = normalizeText(seller.niche || "");
  const desc = seller.confirmed_product_description || `Paket prompt ${niche} siap pakai.`;
  return [
    `# Listing Draft — Shopee`,
    ``,
    `## Product Title`,
    `${brand} — Paket Prompt ${niche} (${seller.prompt_count ?? 10} Prompt, ${adapter})`,
    ``,
    `## Short Description`,
    `Paket ${seller.prompt_count ?? 10} prompt unik untuk ${niche}, siap pakai untuk tool AI populer. Upload manual oleh seller.`,
    ``,
    `## Long Description`,
    desc,
    ``,
    `## Benefit Bullets`,
    `- ${seller.prompt_count ?? 10} prompt siap pakai`,
    `- Variabel jelas, mudah dikustomisasi`,
    `- Disertai panduan penggunaan & checklist kualitas`,
    `- Index CSV untuk pengelolaan rapi`,
    `- Cocok untuk pemula dan advanced`,
    ``,
    `## Bundle Contents`,
    `01_README, 02_PromptBook, 03_PromptIndex.csv, 04_UsageGuide, 05_QualityChecklist, 06_ManualUploadGuide, 11_BundleIndex`,
    ``,
    `## Delivery Instructions`,
    `File dikirim sebagai ZIP melalui fitur lampiran Shopee Chat / link unduhan yang Anda kelola sendiri.`,
    ``,
    `## FAQ`,
    `**Q: Apakah bisa edit prompt?** A: Ya, semua prompt bisa Anda modifikasi.`,
    `**Q: Tool apa saja yang didukung?** A: ChatGPT, Claude, Gemini, dan tool AI generatif populer lainnya.`,
    `**Q: Apakah ada garansi laku?** A: Tidak. Paket ini adalah materi prompt, bukan jaminan hasil bisnis.`,
    ``,
    `## Seller Policy Reminder`,
    `Verifikasi kebijakan produk digital Shopee terbaru sebelum publish. Sesuaikan kategori dan tag.`,
    ``,
    `## Disclaimer`,
    `**Manual upload only.** Tidak ada publish otomatis. Tidak terhubung ke API Shopee.`,
  ].join("\n");
}

function listingLynkid(seller: any, adapter: ResolvedAdapter): string {
  const brand = seller.brand || "Brand Anda";
  const niche = normalizeText(seller.niche || "");
  return [
    `# Listing Draft — Lynk.id`,
    ``,
    `## Sales Page Title`,
    `Paket Prompt ${niche} — ${brand}`,
    ``,
    `## Hook`,
    `Bingung mulai menulis prompt? Pakai paket siap-pakai yang dirancang khusus untuk ${niche}.`,
    ``,
    `## Problem`,
    `Banyak seller membuang waktu mencoba prompt yang outputnya generic. Hasilnya tidak konsisten dan susah dipakai untuk listing.`,
    ``,
    `## Solution`,
    `Paket ini berisi ${seller.prompt_count ?? 10} prompt unik adapter ${adapter}, lengkap dengan variabel, contoh, dan panduan.`,
    ``,
    `## What Buyer Gets`,
    `- 02_PromptBook lengkap`,
    `- 03_PromptIndex.csv siap import`,
    `- 04_UsageGuide langkah demi langkah`,
    `- 05_QualityChecklist`,
    `- 06_ManualUploadGuide`,
    `- 11_BundleIndex`,
    ``,
    `## CTA Copy`,
    `Beli sekarang dan langsung pakai prompt Anda hari ini.`,
    ``,
    `## FAQ`,
    `- Format file? Markdown & CSV.`,
    `- Bisa untuk komersial? Sesuai lisensi (${seller.license || "Personal & Commercial"}).`,
    `- Apakah ada update? Update kecil disediakan jika ada perbaikan editorial.`,
    ``,
    `## Disclaimer`,
    `**Manual upload only.** Tidak ada publish otomatis ke marketplace manapun.`,
  ].join("\n");
}

function listingGeneric(mp: string, seller: any, adapter: ResolvedAdapter): string {
  const brand = seller.brand || "Brand Anda";
  const niche = normalizeText(seller.niche || "");
  return [
    `# Listing Draft — ${mp}`,
    ``,
    `**Manual upload only.** Upload ke ${mp} secara manual setelah review seller.`,
    ``,
    `## Title`,
    `${brand} — Paket Prompt ${niche} (${seller.prompt_count ?? 10} prompt, ${adapter})`,
    ``,
    `## Description`,
    seller.confirmed_product_description || `Paket prompt siap pakai untuk ${niche}.`,
    ``,
    `## Highlights`,
    `- ${seller.prompt_count ?? 10} prompt unik`,
    `- Index CSV + panduan pakai`,
    `- Cocok untuk ${seller.audience || "UMKM dan seller online"}`,
    ``,
    `## Tags`,
    `#prompt #${niche.replace(/\s+/g, "")} #${adapter.toLowerCase()}`,
    ``,
    `## Disclaimer`,
    `Tidak ada publish otomatis. Verifikasi kebijakan ${mp} sebelum publish.`,
  ].join("\n");
}

function bundleIndex(modules: { key: string; file: string }[], marketplaces: string[]): string {
  return [
    `# Bundle Index`,
    ``,
    `## Daftar File & Tujuan`,
    ...modules.map((m) => `- **${m.file}** — ${describeFile(m.key)}`),
    ``,
    `## Recommended Upload Order`,
    `1. README & UsageGuide (untuk pembeli baca dulu)`,
    `2. PromptBook + PromptIndex.csv`,
    `3. QualityChecklist + ManualUploadGuide`,
    `4. Listing per marketplace (${marketplaces.join(", ") || "—"})`,
    ``,
    `## Final Seller Review Checklist`,
    `- [ ] Semua file terbaca tanpa error`,
    `- [ ] Tidak ada placeholder "Konten otomatis..."`,
    `- [ ] Tidak ada prompt body duplikat`,
    `- [ ] Lisensi & harga sudah benar`,
    `- [ ] Disclaimer manual upload ada di tiap listing`,
  ].join("\n");
}

function describeFile(key: string): string {
  const map: Record<string, string> = {
    "01_README": "Pengantar paket dan ringkasan isi",
    "02_PromptBook": "Koleksi prompt utama dengan variabel & checklist",
    "03_PromptIndex": "Index CSV untuk import spreadsheet/Notion",
    "04_UsageGuide": "Panduan pemakaian langkah demi langkah",
    "05_QualityChecklist": "Checklist review kualitas",
    "06_ManualUploadGuide": "Panduan upload manual & kebijakan",
    "11_BundleIndex": "Daftar lengkap & urutan upload",
  };
  if (map[key]) return map[key];
  if (key.startsWith("MARKETPLACE_")) return "Draft listing marketplace";
  return key;
}

// ---------- Module dispatcher ----------
export function generateModuleContent(args: {
  moduleKey: string;
  fileName: string;
  seller: {
    brand?: string;
    niche?: string;
    audience?: string;
    promptCount?: number;
    tone?: string;
    confirmedDescription?: string;
    confirmed_product_description?: string;
    license?: string;
  };
  marketplaces: string[];
  adapter?: string;
}): { content: string; validation: "PASS" | "FAIL" } {
  if (isForbiddenModuleKey(args.moduleKey)) return { content: "", validation: "FAIL" };

  const seller = {
    brand: args.seller.brand,
    niche: normalizeText(args.seller.niche || ""),
    audience: normalizeText(args.seller.audience || ""),
    prompt_count: args.seller.promptCount ?? 10,
    tone: args.seller.tone ?? "Friendly",
    confirmed_product_description: args.seller.confirmed_product_description ?? args.seller.confirmedDescription ?? "",
    license: args.seller.license,
  };
  const adapter = resolveAdapter(args.adapter ?? "CUSTOM", seller.niche);

  let content = "";
  switch (args.moduleKey) {
    case "01_README":
      content = readme(seller, adapter, args.marketplaces);
      break;
    case "02_PromptBook":
      content = promptBook(seller, adapter);
      break;
    case "03_PromptIndex":
      content = promptIndexCsv(seller, adapter);
      break;
    case "04_UsageGuide":
      content = usageGuide(seller, adapter);
      break;
    case "05_QualityChecklist":
      content = qualityChecklist(seller);
      break;
    case "06_ManualUploadGuide":
      content = manualUploadGuide(args.marketplaces);
      break;
    case "11_BundleIndex": {
      const mods = [
        ...CORE_MODULES,
        ...marketplaceModulesFor(args.marketplaces),
        { key: "11_BundleIndex", file: "11_BundleIndex.md" },
      ];
      content = bundleIndex(mods, args.marketplaces);
      break;
    }
    default:
      if (args.moduleKey.startsWith("MARKETPLACE_")) {
        const mp = args.marketplaces.find(
          (m) => `MARKETPLACE_${m.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_LISTING` === args.moduleKey
        ) ?? args.moduleKey.replace(/^MARKETPLACE_/, "").replace(/_LISTING$/, "");
        if (/shopee/i.test(mp)) content = listingShopee(seller, adapter);
        else if (/lynk/i.test(mp)) content = listingLynkid(seller, adapter);
        else content = listingGeneric(mp, seller, adapter);
      } else {
        // Should never happen
        return { content: "", validation: "FAIL" };
      }
  }
  return { content, validation: "PASS" };
}

// ---------- QC ----------
const PLACEHOLDER_PATTERNS = [
  /Konten otomatis untuk modul/i,
  /Lorem ipsum/i,
  /TODO:/i,
  /placeholder/i,
];

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

  // Forbidden modules
  const forbidden = args.modules.filter((m) => isForbiddenModuleKey(m.module_key));
  if (forbidden.length) errors.push(`Ditemukan modul API_* (${forbidden.length}). Tidak diizinkan di mode MANUAL_UPLOAD_ONLY.`);

  // Placeholder detection
  for (const m of args.modules) {
    if (!m.content) continue;
    for (const re of PLACEHOLDER_PATTERNS) {
      if (re.test(m.content)) {
        errors.push(`Output masih placeholder/repetitif (${m.file_name}). Regenerate dengan content generator yang lebih spesifik.`);
        break;
      }
    }
    if (m.content.trim().length < 200 && m.module_key !== "03_PromptIndex") {
      errors.push(`Modul ${m.file_name} terlalu pendek (<200 char).`);
    }
  }

  // PromptBook structural checks
  const promptBook = args.modules.find((m) => m.module_key === "02_PromptBook");
  if (promptBook?.content) {
    const hits = (promptBook.content.match(/^##\s+\d+\./gm) || []).length;
    if (hits !== args.promptCount) {
      errors.push(`Jumlah prompt di PromptBook (${hits}) tidak cocok dengan input (${args.promptCount}).`);
    }
    // Duplicate prompt body detection
    const bodies = promptBook.content.split(/\n##\s+\d+\./).slice(1);
    const fingerprints = bodies.map((b) => {
      const m = b.match(/```\s*\n([\s\S]*?)```/);
      return (m?.[1] ?? "").trim().toLowerCase();
    });
    const dup = new Set<string>();
    const seen = new Set<string>();
    for (const f of fingerprints) {
      if (!f) continue;
      if (seen.has(f)) dup.add(f);
      seen.add(f);
    }
    if (dup.size) errors.push(`Terdeteksi ${dup.size} prompt body duplikat di PromptBook.`);
  }

  // CSV row count
  const csv = args.modules.find((m) => m.module_key === "03_PromptIndex");
  if (csv?.content) {
    const rows = csv.content.trim().split(/\n/).length - 1;
    if (rows !== args.promptCount) {
      errors.push(`Jumlah baris CSV (${rows}) tidak cocok dengan jumlah prompt (${args.promptCount}).`);
    }
  }

  // Forbidden claims
  for (const m of args.modules) {
    if (!m.content) continue;
    for (const f of FORBIDDEN_CLAIMS) {
      if (new RegExp(f, "i").test(m.content)) {
        warnings.push(`Klaim terlarang "${f}" terdeteksi di ${m.file_name}.`);
      }
    }
  }

  // Anchor reflection score
  const allText = args.modules.map((m) => m.content || "").join(" ").toLowerCase();
  const reflected = args.anchors.filter((a) => allText.includes(a.toLowerCase().split(" ")[0])).length;
  if (args.anchors.length && reflected < Math.min(3, args.anchors.length)) {
    warnings.push(`Hanya ${reflected} dari ${args.anchors.length} anchor terdeteksi di konten.`);
  }

  // Typo check (after normalization there should be none left)
  for (const m of args.modules) {
    if (!m.content) continue;
    for (const [re] of TYPO_MAP) {
      if (re.test(m.content)) {
        warnings.push(`Typo belum dinormalisasi di ${m.file_name}.`);
        break;
      }
    }
  }

  return {
    blocking_errors: errors.length,
    errors,
    warnings,
    checks: {
      completeness: incomplete.length === 0,
      no_forbidden_modules: forbidden.length === 0,
      no_placeholder: !errors.some((e) => /placeholder/i.test(e)),
      no_duplicate_prompt: !errors.some((e) => /duplikat/i.test(e)),
      prompt_count_match: !!promptBook,
      csv_row_count_match: !!csv,
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

export function safeMarketplaces(mps: Marketplace[] | string[]): string[] {
  return mps.filter((m) => !isForbiddenModuleKey(String(m)));
}