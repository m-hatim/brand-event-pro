// Client-side wrappers around Supabase. RLS scopes every row to the logged-in user.
import { supabase } from "@/integrations/supabase/client";
import {
  buildManifestPayload,
  correctDescription,
  generateArchitecture,
  generateKeyAnchors,
  generateActualQCScorecardContent,
  generateModuleContent,
  generateSyncedManifestContent,
  generateRunRequestId,
  runQC,
  safeMarketplaces,
  seedAssumptions,
  computeCommercialReadiness,
  findBuyerLeaks,
} from "./engine";
import {
  QC_THRESHOLDS,
  FINAL_BUYER_MODULES,
  SELLER_TOOLKIT_FILE,
  ADMIN_MODULES,
  RunStatus,
  isForbiddenModuleKey,
} from "./types";

type Bundle = Awaited<ReturnType<typeof getRunBundle>>;
type OutputModule = Bundle["modules"][number];

actionGuardNoop();
function actionGuardNoop() {
  // Keeps this module tree-shake safe. No runtime side-effect.
}

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Tidak terautentikasi.");
  return data.user.id;
}

export async function getSettings() {
  const owner = await uid();
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", owner)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  const ins = await supabase.from("user_settings").insert({ user_id: owner }).select("*").single();
  if (ins.error) throw ins.error;
  return ins.data;
}

export async function updateSettings(updates: Record<string, unknown>) {
  const owner = await uid();
  const { data, error } = await supabase
    .from("user_settings")
    .update(updates)
    .eq("user_id", owner)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listRuns() {
  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface NewRunInput {
  adapter: string;
  brand: string;
  language: string;
  target_market: string;
  niche: string;
  audience: string;
  description: string;
  prompt_count: number;
  tone: string;
  key_anchors: string[];
  license: string;
  target_price?: string;
  marketplaces: string[];
  original_description: string;
  corrected_description: string;
  confirmed_product_description: string;
}

export async function createRun(input: NewRunInput) {
  const owner = await uid();
  const marketplaces = safeMarketplaces(input.marketplaces);
  let anchors = input.key_anchors;
  if (!anchors || anchors.length < 3) {
    anchors = generateKeyAnchors({
      niche: input.niche,
      audience: input.audience,
      confirmedDescription: input.confirmed_product_description,
      marketplaces,
      tone: input.tone,
      adapter: input.adapter,
    });
  }
  const { data: run, error } = await supabase
    .from("runs")
    .insert({
      owner_id: owner,
      run_request_id: generateRunRequestId(),
      adapter: input.adapter,
      generation_mode: "MANUAL_UPLOAD_ONLY",
      marketplaces,
      status: "ARCHITECTURE_PENDING" as RunStatus,
    })
    .select("*")
    .single();
  if (error) throw error;

  await supabase.from("seller_inputs").insert({
    owner_id: owner,
    run_id: run.id,
    brand: input.brand,
    language: input.language,
    target_market: input.target_market,
    niche: input.niche,
    audience: input.audience,
    description: input.description,
    prompt_count: input.prompt_count,
    tone: input.tone,
    key_anchors: anchors,
    license: input.license,
    target_price: input.target_price,
    original_description: input.original_description,
    corrected_description: input.corrected_description,
    confirmed_product_description: input.confirmed_product_description,
  });

  if (marketplaces.length) {
    await supabase.from("marketplace_selections").insert(
      marketplaces.map((m) => ({ owner_id: owner, run_id: run.id, marketplace: m }))
    );
  }

  await supabase.from("redacted_logs").insert({
    owner_id: owner,
    run_id: run.id,
    level: "info",
    message: `Run dibuat (adapter=${input.adapter}, marketplaces=${marketplaces.join(",") || "-"}).`,
  });

  return run;
}

export async function stopRun(runId: string) {
  const { error } = await supabase.from("runs").update({ status: "STOPPED" as RunStatus }).eq("id", runId);
  if (error) throw error;
}

export async function getRunBundle(runId: string) {
  const [run, seller, mp, arch, assumptions, manifest, modules, chunks, mpBundle, qc, exp, logs] = await Promise.all([
    supabase.from("runs").select("*").eq("id", runId).maybeSingle(),
    supabase.from("seller_inputs").select("*").eq("run_id", runId).maybeSingle(),
    supabase.from("marketplace_selections").select("*").eq("run_id", runId),
    supabase.from("architecture_outputs").select("*").eq("run_id", runId).maybeSingle(),
    supabase.from("assumptions").select("*").eq("run_id", runId).order("created_at"),
    supabase.from("manifests").select("*").eq("run_id", runId).maybeSingle(),
    supabase.from("output_modules").select("*").eq("run_id", runId).order("created_at"),
    supabase.from("batch_chunks").select("*").eq("run_id", runId).order("chunk_index"),
    supabase.from("marketplace_bundle_results").select("*").eq("run_id", runId),
    supabase.from("qc_results").select("*").eq("run_id", runId).maybeSingle(),
    supabase.from("exports").select("*").eq("run_id", runId).maybeSingle(),
    supabase.from("redacted_logs").select("*").eq("run_id", runId).order("created_at", { ascending: false }).limit(50),
  ]);
  return {
    run: run.data,
    seller: seller.data,
    marketplaces: mp.data ?? [],
    architecture: arch.data,
    assumptions: assumptions.data ?? [],
    manifest: manifest.data,
    modules: modules.data ?? [],
    chunks: chunks.data ?? [],
    marketplaceBundle: mpBundle.data ?? [],
    qc: qc.data,
    export: exp.data,
    logs: logs.data ?? [],
  };
}

export async function generateDescriptionCorrection(runIdOrNull: string | null, description: string) {
  const owner = await uid();
  const corrected = correctDescription(description);
  await supabase.from("description_corrections").insert({
    owner_id: owner,
    run_id: runIdOrNull,
    original: description,
    corrected,
  });
  return corrected;
}

export async function generateArchitectureForRun(runId: string) {
  const owner = await uid();
  const bundle = await getRunBundle(runId);
  if (!bundle.seller) throw new Error("Seller input belum lengkap.");
  const payload = generateArchitecture({
    brand: bundle.seller.brand ?? undefined,
    niche: bundle.seller.niche ?? undefined,
    audience: bundle.seller.audience ?? undefined,
    confirmedDescription: bundle.seller.confirmed_product_description ?? undefined,
    marketplaces: bundle.run?.marketplaces ?? [],
    adapter: bundle.run?.adapter ?? "CUSTOM",
    promptCount: bundle.seller.prompt_count ?? 10,
    tone: bundle.seller.tone ?? "Friendly",
  });
  if (bundle.architecture) {
    await supabase.from("architecture_outputs").update({ payload: payload as any, approved: false }).eq("id", bundle.architecture.id);
  } else {
    await supabase.from("architecture_outputs").insert({ owner_id: owner, run_id: runId, payload: payload as any });
  }
  if (bundle.assumptions.length === 0) {
    const seeds = seedAssumptions(bundle.run?.adapter ?? "CUSTOM");
    await supabase.from("assumptions").insert(seeds.map((a) => ({ ...a, owner_id: owner, run_id: runId })));
  }
  await supabase.from("runs").update({ status: "ARCHITECTURE_READY" as RunStatus }).eq("id", runId);
}

export async function approveArchitecture(runId: string) {
  const bundle = await getRunBundle(runId);
  if (!bundle.architecture) throw new Error("Arsitektur belum digenerate.");
  const blocking = bundle.assumptions.filter((a) => a.type === "critical" && a.status === "pending");
  if (blocking.length) {
    await supabase.from("runs").update({ status: "BLOCKED_CRITICAL_ASSUMPTION" as RunStatus }).eq("id", runId);
    throw new Error("Asumsi kritis masih pending. Konfirmasi/koreksi dulu di tab Asumsi.");
  }
  await supabase.from("architecture_outputs").update({ approved: true }).eq("id", bundle.architecture.id);
  await supabase.from("runs").update({ status: "ASSUMPTIONS_PENDING" as RunStatus }).eq("id", runId);
}

export async function confirmAssumption(assumptionId: string) {
  await supabase.from("assumptions").update({ status: "confirmed" }).eq("id", assumptionId);
}
export async function correctAssumption(assumptionId: string, correction: string) {
  await supabase.from("assumptions").update({ status: "corrected", correction }).eq("id", assumptionId);
}
export async function rejectAssumption(assumptionId: string) {
  await supabase.from("assumptions").update({ status: "rejected" }).eq("id", assumptionId);
}

function expectedFiles(payload: any): string[] {
  return (payload?.expected_modules ?? []).map((m: { file: string }) => m.file);
}

function expectedKeys(payload: any): string[] {
  return (payload?.expected_modules ?? []).map((m: { key: string }) => m.key);
}

export async function buildManifest(runId: string) {
  const owner = await uid();
  const bundle = await getRunBundle(runId);
  if (!bundle.seller || !bundle.run) throw new Error("Run belum siap.");
  const blocking = bundle.assumptions.filter((a) => a.type === "critical" && a.status === "pending");
  if (blocking.length) {
    await supabase.from("runs").update({ status: "BLOCKED_CRITICAL_ASSUMPTION" as RunStatus }).eq("id", runId);
    throw new Error("Tidak bisa build manifest: asumsi kritis belum dikonfirmasi.");
  }

  await supabase.from("runs").update({ status: "MANIFEST_PENDING" as RunStatus }).eq("id", runId);

  const payload = buildManifestPayload({
    runId: bundle.run.run_request_id,
    brand: bundle.seller.brand ?? "Prompt Product",
    language: bundle.seller.language ?? "Indonesia",
    targetMarket: bundle.seller.target_market ?? "Indonesia",
    niche: bundle.seller.niche ?? "",
    adapter: bundle.run.adapter,
    marketplaces: bundle.run.marketplaces ?? [],
    promptCount: bundle.seller.prompt_count ?? 10,
    license: bundle.seller.license ?? "Personal & Commercial",
  });

  await supabase.from("batch_chunks").delete().eq("run_id", runId);
  await supabase.from("output_modules").delete().eq("run_id", runId);

  if (bundle.manifest) await supabase.from("manifests").update({ payload: payload as any }).eq("id", bundle.manifest.id);
  else await supabase.from("manifests").insert({ owner_id: owner, run_id: runId, payload: payload as any });

  const moduleRows = payload.expected_modules
    .filter((m) => !isForbiddenModuleKey(m.key) && !isForbiddenModuleKey(m.file))
    .map((m) => ({
      owner_id: owner,
      run_id: runId,
      module_key: m.key,
      file_name: m.file,
      status: "pending",
      validation: "unknown",
    }));
  const inserted = await supabase.from("output_modules").insert(moduleRows).select("*");
  if (inserted.error) throw inserted.error;

  let idx = 0;
  const chunkRows = (inserted.data ?? []).map((m) => ({
    owner_id: owner,
    run_id: runId,
    module_id: m.id,
    chunk_index: idx++,
    status: "pending",
    validation: "unknown",
    acked: false,
  }));
  if (chunkRows.length) await supabase.from("batch_chunks").insert(chunkRows);

  await supabase.from("runs").update({ status: "MANIFEST_READY" as RunStatus }).eq("id", runId);
}

function makeGenerationSeller(bundle: Bundle) {
  const seller = bundle.seller;
  if (!seller) throw new Error("Seller input belum lengkap.");
  return {
    brand: seller.brand ?? undefined,
    niche: seller.niche ?? undefined,
    audience: seller.audience ?? undefined,
    promptCount: seller.prompt_count ?? 10,
    prompt_count: seller.prompt_count ?? 10,
    tone: seller.tone ?? "Friendly",
    confirmedDescription: seller.confirmed_product_description ?? undefined,
    confirmed_product_description: seller.confirmed_product_description ?? undefined,
    license: seller.license ?? undefined,
    language: seller.language ?? undefined,
    target_market: seller.target_market ?? undefined,
    target_price: seller.target_price ?? undefined,
  };
}

async function persistQC(runId: string, ownerId: string, qc: ReturnType<typeof runQC>, existingQcId?: string) {
  if (existingQcId) {
    await supabase.from("qc_results").update({ payload: qc as any, blocking_errors: qc.blocking_errors }).eq("id", existingQcId);
  } else {
    await supabase.from("qc_results").insert({ owner_id: ownerId, run_id: runId, payload: qc as any, blocking_errors: qc.blocking_errors });
  }
}

function deriveReady(qc: ReturnType<typeof runQC>, bundle: Bundle): boolean {
  const payload = bundle.manifest?.payload as any;
  const requiredFiles = expectedFiles(payload);
  const moduleFiles = new Set(bundle.modules.map((m) => m.file_name));
  const allExpectedPresent = requiredFiles.every((file) => moduleFiles.has(file));
  const allAcked = bundle.modules.length > 0 && bundle.modules.every((m) => m.status === "acked" && m.validation === "PASS" && m.content);
  const noApi = bundle.modules.every((m) => !isForbiddenModuleKey(m.module_key) && !isForbiddenModuleKey(m.file_name));
  return Boolean(allExpectedPresent && allAcked && noApi && qc.score >= QC_THRESHOLDS.MIN_SELL_READY && qc.blocking_errors === 0);
}

async function runAndPersistQC(runId: string, bundleBefore: Bundle) {
  const latest = await getRunBundle(runId);
  if (!latest.seller || !latest.run) throw new Error("Run belum siap untuk QC.");
  const qc = runQC({
    promptCount: latest.seller.prompt_count ?? 10,
    modules: latest.modules,
    anchors: latest.seller.key_anchors ?? [],
    confirmedDescription: latest.seller.confirmed_product_description ?? "",
    marketplaces: latest.run.marketplaces ?? [],
  });

  const seller = makeGenerationSeller(latest);
  const syncedManifest = generateSyncedManifestContent({ seller, adapter: latest.run.adapter, marketplaces: latest.run.marketplaces ?? [], qc });
  const actualScorecard = generateActualQCScorecardContent({ seller, qc });

  const manifestModule = latest.modules.find((m) => m.file_name === "12_Product_Manifest.json");
  if (manifestModule) {
    await supabase
      .from("output_modules")
      .update({ content: syncedManifest, validation: "PASS", status: "acked" })
      .eq("id", manifestModule.id);
    await supabase
      .from("batch_chunks")
      .update({ status: "acked", validation: "PASS", acked: true })
      .eq("module_id", manifestModule.id);
  }

  const scorecardModule = latest.modules.find((m) => m.file_name === "QC_Scorecard.md");
  if (scorecardModule) {
    await supabase
      .from("output_modules")
      .update({ content: actualScorecard, validation: "PASS", status: "acked" })
      .eq("id", scorecardModule.id);
    await supabase
      .from("batch_chunks")
      .update({ status: "acked", validation: "PASS", acked: true })
      .eq("module_id", scorecardModule.id);
  }

  await persistQC(runId, latest.run.owner_id, qc, latest.qc?.id);
  const refreshed = await getRunBundle(runId);
  const status: RunStatus = deriveReady(qc, refreshed) ? "READY_FOR_SELLER_REVIEW" : qc.score >= QC_THRESHOLDS.MIN_SELL_READY ? "FILES_PARTIAL" : "CHUNK_VALIDATION_FAILED";
  await supabase.from("runs").update({ status }).eq("id", runId);
  return { qc, status, latest: refreshed, previous: bundleBefore };
}

export async function ensureQcArtifactsSynced(runId: string) {
  const before = await getRunBundle(runId);
  if (!before.manifest || !before.seller || !before.run) throw new Error("Manifest/seller/run belum siap untuk sync QC.");
  await runAndPersistQC(runId, before);
  return getRunBundle(runId);
}

export async function generateAllRemainingFiles(runId: string) {
  return generateAllRemainingFilesWithProgress(runId);
}

export async function generateAllRemainingFilesWithProgress(
  runId: string,
  onProgress?: (i: number, total: number, file: string) => void,
  options: { force?: boolean } = {}
) {
  const bundle = await getRunBundle(runId);
  if (!bundle.manifest || !bundle.seller || !bundle.run) throw new Error("Manifest belum dibuat.");

  const payload = bundle.manifest.payload as any;
  const mustHave = [...FINAL_BUYER_MODULES, SELLER_TOOLKIT_FILE, ...ADMIN_MODULES];
  const missingCore = mustHave.filter((file) => !expectedFiles(payload).includes(file));
  if (missingCore.length) throw new Error(`Manifest belum PPA v2. Klik Build Manifest ulang. Missing: ${missingCore.join(", ")}`);

  await supabase.from("runs").update({ status: "CHUNK_RUNNING" as RunStatus }).eq("id", runId);

  const targets = options.force ? bundle.modules : bundle.modules.filter((m) => m.status !== "acked" || m.validation !== "PASS");
  const total = targets.length;
  const startedAt = Date.now();
  const seller = makeGenerationSeller(bundle);
  let i = 0;

  for (const module of targets) {
    i += 1;
    onProgress?.(i, total, module.file_name);
    if (Date.now() - startedAt > 60000) throw new Error("Generate terlalu lama. Klik Retry atau lanjutkan dari file terakhir.");
    if (isForbiddenModuleKey(module.module_key) || isForbiddenModuleKey(module.file_name)) {
      await supabase.from("output_modules").update({ status: "failed", validation: "FAIL", content: null }).eq("id", module.id);
      await supabase.from("batch_chunks").update({ status: "failed", validation: "FAIL", acked: false }).eq("module_id", module.id);
      continue;
    }
    const output = generateModuleContent({
      moduleKey: module.module_key,
      fileName: module.file_name,
      seller,
      marketplaces: bundle.run.marketplaces ?? [],
      adapter: bundle.run.adapter,
    });
    const newStatus = output.validation === "PASS" ? "acked" : "failed";
    await supabase.from("output_modules").update({ content: output.content, validation: output.validation, status: newStatus }).eq("id", module.id);
    await supabase.from("batch_chunks").update({ status: newStatus, validation: output.validation, acked: newStatus === "acked" }).eq("module_id", module.id);
  }

  await supabase.from("marketplace_bundle_results").delete().eq("run_id", runId);
  if ((bundle.run.marketplaces ?? []).length) {
    await supabase.from("marketplace_bundle_results").insert(
      (bundle.run.marketplaces ?? []).map((m) => ({
        owner_id: bundle.run!.owner_id,
        run_id: runId,
        marketplace: m,
        payload: { mode: "MANUAL_UPLOAD_ONLY", note: `Draft listing untuk ${m} siap. Upload manual dan seller review wajib.` },
        validation: "PASS",
      }))
    );
  }

  await runAndPersistQC(runId, bundle);
}

export async function retryModule(moduleId: string) {
  await supabase.from("output_modules").update({ status: "pending", validation: "unknown", content: null }).eq("id", moduleId);
  await supabase.from("batch_chunks").update({ status: "pending", acked: false, validation: "unknown" }).eq("module_id", moduleId);
}

function approvalDiagnostics(bundle: Bundle): string[] {
  const messages: string[] = [];
  const qcPayload = bundle.qc?.payload as any;
  const payload = bundle.manifest?.payload as any;
  if (!bundle.manifest) messages.push("Manifest belum dibuat.");
  if (!bundle.qc) messages.push("QC belum dijalankan.");
  if (qcPayload) {
    if ((qcPayload.score ?? 0) < QC_THRESHOLDS.MIN_SELL_READY) messages.push(`QC score ${qcPayload.score ?? 0} masih di bawah ${QC_THRESHOLDS.MIN_SELL_READY}.`);
    if ((qcPayload.blocking_errors ?? 0) > 0) messages.push(`QC masih punya ${qcPayload.blocking_errors} blocking error.`);
  }
  if (payload) {
    const files = expectedFiles(payload);
    const outputByFile = new Map(bundle.modules.map((m) => [m.file_name, m]));
    const missing = files.filter((file) => !outputByFile.has(file));
    if (missing.length) messages.push(`Output module belum lengkap: ${missing.join(", ")}`);
    const notAcked = files.map((file) => outputByFile.get(file)).filter((m): m is OutputModule => Boolean(m)).filter((m) => m.status !== "acked" || m.validation !== "PASS" || !m.content);
    if (notAcked.length) messages.push(`Masih ada file belum PASS/ACKED: ${notAcked.map((m) => m.file_name).join(", ")}`);
    const api = bundle.modules.filter((m) => isForbiddenModuleKey(m.module_key) || isForbiddenModuleKey(m.file_name));
    if (api.length) messages.push(`Ditemukan API_* module: ${api.map((m) => m.file_name).join(", ")}`);
  }
  return messages;
}

export async function approvePackage(runId: string) {
  const bundle = await getRunBundle(runId);
  if (!bundle.run) throw new Error("Run tidak ditemukan.");
  const latest = await runAndPersistQC(runId, bundle);
  const refreshed = await getRunBundle(runId);
  const messages = approvalDiagnostics(refreshed);

  if (latest.qc.score < QC_THRESHOLDS.PREMIUM_MIN) {
    messages.push(`Technical QC ${latest.qc.score} < ${QC_THRESHOLDS.PREMIUM_MIN}.`);
  }
  if (latest.qc.blocking_errors > 0) {
    messages.push(`Masih ada ${latest.qc.blocking_errors} blocking error.`);
  }

  const leakingFiles = (refreshed.modules as any[])
    .filter((m) => (FINAL_BUYER_MODULES as readonly string[]).includes(m.file_name))
    .filter((m) => findBuyerLeaks(m.content || "").length > 0)
    .map((m) => m.file_name);
  if (leakingFiles.length) messages.push(`Buyer leakage di: ${leakingFiles.join(", ")}.`);

  const legacy = (refreshed.modules as any[]).filter((m) =>
    ["06_QualityChecklist.md","07_License_Disclaimer.md","08_ManualUploadGuide.md","10_Pricing_Recommendation.md","11_Thumbnail_Brief.md","13_Ready_to_Upload_Checklist.md","14_Cover_Generation_Brief.md","15_Marketing_Video_CTA_Prompt.md","21_Marketplace_Upload_Asset_Kit.md","99_Assumption_Register.md"].includes(m.file_name)
  );
  if (legacy.length) messages.push(`Legacy files terdeteksi: ${legacy.map((m: any) => m.file_name).join(", ")}.`);

  const pdfDraft = (refreshed.modules as any[]).find((m) => m.file_name === "20_Complete_PDF_Product_Draft.md");
  const pdfOk = pdfDraft?.content && String(pdfDraft.content).length > 4000 && findBuyerLeaks(pdfDraft.content).length === 0;
  if (!pdfOk) messages.push("Premium PDF validation gagal: terlalu tipis atau mengandung internal wording.");

  const readiness = computeCommercialReadiness({
    promptCount: refreshed.seller?.prompt_count ?? 10,
    modules: refreshed.modules as any[],
  });
  if (!readiness.passed) {
    const failed = readiness.checks.filter((check) => !check.ok).map((check) => check.id).join(", ");
    messages.push(`Commercial readiness ${readiness.score} < 85. Gagal: ${failed}.`);
  }

  if (messages.length) {
    throw new Error(`Paket belum bisa PASS_FINAL. ${messages.join(" ")}`);
  }

  await supabase.from("runs").update({ status: "PASS_FINAL" as RunStatus, approved_at: new Date().toISOString() }).eq("id", runId);
  await supabase.from("exports").insert({
    owner_id: bundle.run.owner_id,
    run_id: runId,
    payload: {
      mode: "MANUAL_UPLOAD_ONLY",
      qc_score: latest.qc.score,
      qc_status: latest.qc.status,
      commercial_readiness: readiness.score,
      files: refreshed.modules.map((m) => ({ file: m.file_name, key: m.module_key })),
      approved_at: new Date().toISOString(),
    },
  });
}

export interface RegenerateSummary {
  modulesRegenerated: number;
  filesUpdated: string[];
  qcRerun: boolean;
  blockingBefore: number;
  blockingAfter: number;
  runStatus: string;
  scoreBefore?: number;
  scoreAfter?: number;
}

async function regenerateInternal(
  runId: string,
  targets: OutputModule[],
  onProgress?: (i: number, total: number, file: string) => void
): Promise<RegenerateSummary> {
  const before = await getRunBundle(runId);
  if (!before.seller || !before.run || !before.manifest) throw new Error("Run belum siap untuk regenerate.");
  const beforePayload = before.qc?.payload as any;
  const blockingBefore = before.qc?.blocking_errors ?? 0;
  const scoreBefore = beforePayload?.score ?? 0;
  const seller = makeGenerationSeller(before);
  const targetIds = targets.map((m) => m.id);
  if (targetIds.length) {
    await supabase.from("output_modules").update({ status: "pending", validation: "unknown", content: null }).in("id", targetIds);
    await supabase.from("batch_chunks").update({ status: "pending", acked: false, validation: "unknown" }).in("module_id", targetIds);
  }
  const filesUpdated: string[] = [];
  let i = 0;
  for (const module of targets) {
    i += 1;
    onProgress?.(i, targets.length, module.file_name);
    const output = generateModuleContent({
      moduleKey: module.module_key,
      fileName: module.file_name,
      seller,
      marketplaces: before.run.marketplaces ?? [],
      adapter: before.run.adapter,
    });
    const newStatus = output.validation === "PASS" ? "acked" : "failed";
    const update = await supabase.from("output_modules").update({ content: output.content, validation: output.validation, status: newStatus }).eq("id", module.id).select("file_name");
    if (!update.error && update.data?.length) filesUpdated.push(module.file_name);
    await supabase.from("batch_chunks").update({ status: newStatus, validation: output.validation, acked: newStatus === "acked" }).eq("module_id", module.id);
  }
  const { qc, status } = await runAndPersistQC(runId, before);
  return {
    modulesRegenerated: targets.length,
    filesUpdated,
    qcRerun: true,
    blockingBefore,
    blockingAfter: qc.blocking_errors,
    runStatus: status,
    scoreBefore,
    scoreAfter: qc.score,
  };
}

export async function regeneratePackageContent(
  runId: string,
  onProgress?: (i: number, total: number, file: string) => void
): Promise<RegenerateSummary> {
  const bundle = await getRunBundle(runId);
  return regenerateInternal(runId, bundle.modules, onProgress);
}

export async function hardRegenerateFailedModules(
  runId: string,
  onProgress?: (i: number, total: number, file: string) => void
): Promise<RegenerateSummary> {
  const bundle = await getRunBundle(runId);
  const qcPayload = (bundle.qc?.payload as any) ?? {};
  const errorText = [...(qcPayload.errors ?? []), ...(qcPayload.warnings ?? [])].join("\n");
  const targets = bundle.modules.filter((m) => m.status === "failed" || m.validation === "FAIL" || errorText.includes(m.file_name));
  if (!targets.length) {
    return {
      modulesRegenerated: 0,
      filesUpdated: [],
      qcRerun: false,
      blockingBefore: bundle.qc?.blocking_errors ?? 0,
      blockingAfter: bundle.qc?.blocking_errors ?? 0,
      runStatus: bundle.run?.status ?? "UNKNOWN",
      scoreBefore: qcPayload.score ?? 0,
      scoreAfter: qcPayload.score ?? 0,
    };
  }
  return regenerateInternal(runId, targets, onProgress);
}

export async function upgradePackageToSellReady(
  runId: string,
  onProgress?: (i: number, total: number, file: string) => void
): Promise<RegenerateSummary> {
  const first = await getRunBundle(runId);
  const payload = first.manifest?.payload as any;
  const expected = expectedKeys(payload);
  const needsManifest = !first.manifest || [...FINAL_BUYER_MODULES, SELLER_TOOLKIT_FILE, ...ADMIN_MODULES].some((file) => !expected.includes(file.replace(/\.[^.]+$/, "")));
  if (needsManifest) await buildManifest(runId);
  await supabase.from("runs").update({ status: "UPGRADE_IN_PROGRESS" as RunStatus }).eq("id", runId);
  const bundle = await getRunBundle(runId);
  const qcPayload = (bundle.qc?.payload as any) ?? {};
  const problemText = [...(qcPayload.errors ?? []), ...(qcPayload.warnings ?? [])].join("\n");
  const targets = bundle.modules.filter((m) => {
    const missing = !m.content || m.status !== "acked" || m.validation !== "PASS";
    const weak = problemText.includes(m.file_name);
    return missing || weak;
  });
  return regenerateInternal(runId, targets.length ? targets : bundle.modules, onProgress);
}

export async function reopenForRegeneration(runId: string) {
  await supabase.from("runs").update({ status: "READY_FOR_SELLER_REVIEW" as RunStatus, approved_at: null }).eq("id", runId);
}
