// Client-side wrappers around Supabase. RLS scopes every row to the logged-in user.
import { supabase } from "@/integrations/supabase/client";
import {
  buildManifestPayload,
  correctDescription,
  generateArchitecture,
  generateKeyAnchors,
  generateModuleContent,
  generateRunRequestId,
  runQC,
  safeMarketplaces,
  seedAssumptions,
} from "./engine";
import { isForbiddenModuleKey, RunStatus } from "./types";

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
  // Insert default if missing (safety net)
  const ins = await supabase
    .from("user_settings")
    .insert({ user_id: owner })
    .select("*")
    .single();
  if (ins.error) throw ins.error;
  return ins.data;
}

export async function updateSettings(updates: Record<string, any>) {
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
  return data;
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
  // Auto-fill anchors if too few
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
  const { error } = await supabase
    .from("runs")
    .update({ status: "STOPPED" as RunStatus })
    .eq("id", runId);
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
  const payload: any = generateArchitecture({
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
    await supabase.from("architecture_outputs").update({ payload, approved: false }).eq("id", bundle.architecture.id);
  } else {
    await supabase.from("architecture_outputs").insert([{ owner_id: owner, run_id: runId, payload }]);
  }
  // Seed assumptions if none
  if (bundle.assumptions.length === 0) {
    const seeds = seedAssumptions(bundle.run?.adapter ?? "CUSTOM");
    await supabase.from("assumptions").insert(seeds.map((a) => ({ ...a, owner_id: owner, run_id: runId })));
  }
  await supabase.from("runs").update({ status: "ARCHITECTURE_READY" as RunStatus }).eq("id", runId);
}

export async function approveArchitecture(runId: string) {
  const bundle = await getRunBundle(runId);
  if (!bundle.architecture) throw new Error("Arsitektur belum digenerate.");
  // Block if critical assumption unresolved
  const blocking = bundle.assumptions.filter((a: any) => a.type === "critical" && a.status === "pending");
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

export async function buildManifest(runId: string) {
  const owner = await uid();
  const bundle = await getRunBundle(runId);
  if (!bundle.seller || !bundle.run) throw new Error("Run belum siap.");
  const blocking = bundle.assumptions.filter((a: any) => a.type === "critical" && a.status === "pending");
  if (blocking.length) {
    await supabase.from("runs").update({ status: "BLOCKED_CRITICAL_ASSUMPTION" as RunStatus }).eq("id", runId);
    throw new Error("Tidak bisa build manifest: asumsi kritis belum dikonfirmasi.");
  }
  await supabase.from("runs").update({ status: "MANIFEST_PENDING" as RunStatus }).eq("id", runId);

  const payload = buildManifestPayload({
    adapter: bundle.run.adapter,
    marketplaces: bundle.run.marketplaces ?? [],
    promptCount: bundle.seller.prompt_count ?? 10,
  });

  // Wipe existing modules/chunks (idempotent rebuild)
  await supabase.from("batch_chunks").delete().eq("run_id", runId);
  await supabase.from("output_modules").delete().eq("run_id", runId);

  if (bundle.manifest) {
    await supabase.from("manifests").update({ payload }).eq("id", bundle.manifest.id);
  } else {
    await supabase.from("manifests").insert({ owner_id: owner, run_id: runId, payload });
  }

  const moduleRows = payload.expected_modules
    .filter((m: any) => !isForbiddenModuleKey(m.key))
    .map((m: any) => ({
      owner_id: owner,
      run_id: runId,
      module_key: m.key,
      file_name: m.file,
      status: "pending",
      validation: "unknown",
    }));
  const inserted = await supabase.from("output_modules").insert(moduleRows).select("*");
  if (inserted.error) throw inserted.error;

  // Insert chunks per module
  let idx = 0;
  const chunks: any[] = [];
  for (const m of inserted.data ?? []) {
    const meta = payload.expected_modules.find((x: any) => x.key === m.module_key);
    const n = meta?.chunks ?? 1;
    for (let i = 0; i < n; i++) {
      chunks.push({
        owner_id: owner,
        run_id: runId,
        module_id: m.id,
        chunk_index: idx++,
        status: "pending",
      });
    }
  }
  if (chunks.length) await supabase.from("batch_chunks").insert(chunks);

  await supabase.from("runs").update({ status: "MANIFEST_READY" as RunStatus }).eq("id", runId);
}

export async function generateAllRemainingFiles(runId: string) {
  const bundle = await getRunBundle(runId);
  if (!bundle.manifest || !bundle.seller) throw new Error("Manifest belum dibuat.");
  await supabase.from("runs").update({ status: "CHUNK_RUNNING" as RunStatus }).eq("id", runId);

  const seller = bundle.seller;
  const marketplaces = bundle.run?.marketplaces ?? [];

  const pending = bundle.modules.filter((m: any) => m.status !== "acked");
  for (const m of pending) {
    if (isForbiddenModuleKey(m.module_key)) {
      await supabase.from("output_modules").update({ status: "failed", validation: "FAIL" }).eq("id", m.id);
      continue;
    }
    const out = generateModuleContent({
      moduleKey: m.module_key,
      fileName: m.file_name,
      seller: {
        brand: seller.brand ?? undefined,
        niche: seller.niche ?? undefined,
        audience: seller.audience ?? undefined,
        promptCount: seller.prompt_count ?? 10,
        tone: seller.tone ?? "Friendly",
        confirmedDescription: seller.confirmed_product_description ?? undefined,
      },
      marketplaces,
    });
    const newStatus = out.validation === "PASS" ? "acked" : "failed";
    await supabase
      .from("output_modules")
      .update({ content: out.content, validation: out.validation, status: newStatus })
      .eq("id", m.id);
    // ACK all chunks for this module
    await supabase
      .from("batch_chunks")
      .update({ status: newStatus === "acked" ? "acked" : "failed", validation: out.validation, acked: newStatus === "acked" })
      .eq("module_id", m.id);
    if (out.validation === "FAIL") {
      await supabase.from("runs").update({ status: "CHUNK_VALIDATION_FAILED" as RunStatus }).eq("id", runId);
      return;
    }
  }

  // Marketplace bundle results — clean rebuild
  await supabase.from("marketplace_bundle_results").delete().eq("run_id", runId);
  if (marketplaces.length) {
    const ownerId = bundle.run?.owner_id!;
    await supabase.from("marketplace_bundle_results").insert(
      marketplaces.map((m: string) => ({
        owner_id: ownerId,
        run_id: runId,
        marketplace: m,
        payload: { mode: "MANUAL_UPLOAD_ONLY", note: `Draft listing untuk ${m} siap. Upload manual.` },
        validation: "PASS",
      }))
    );
  }

  // Run QC
  const after = await getRunBundle(runId);
  const qc = runQC({
    promptCount: seller.prompt_count ?? 10,
    modules: after.modules as any,
    anchors: seller.key_anchors ?? [],
    confirmedDescription: seller.confirmed_product_description ?? "",
  });
  const ownerId = bundle.run!.owner_id;
  if (after.qc) {
    await supabase.from("qc_results").update({ payload: qc, blocking_errors: qc.blocking_errors }).eq("id", after.qc.id);
  } else {
    await supabase.from("qc_results").insert({ owner_id: ownerId, run_id: runId, payload: qc, blocking_errors: qc.blocking_errors });
  }

  // Readiness
  const ready = qc.blocking_errors === 0;
  await supabase
    .from("runs")
    .update({ status: (ready ? "READY_FOR_SELLER_REVIEW" : "CHUNK_VALIDATION_FAILED") as RunStatus })
    .eq("id", runId);
}

export async function retryModule(moduleId: string) {
  await supabase.from("output_modules").update({ status: "pending", validation: "unknown" }).eq("id", moduleId);
  await supabase.from("batch_chunks").update({ status: "pending", acked: false, validation: "unknown" }).eq("module_id", moduleId);
}

export async function approvePackage(runId: string) {
  const bundle = await getRunBundle(runId);
  if (bundle.run?.status !== "READY_FOR_SELLER_REVIEW") {
    throw new Error("Paket belum siap untuk disetujui.");
  }
  await supabase
    .from("runs")
    .update({ status: "PASS_FINAL" as RunStatus, approved_at: new Date().toISOString() })
    .eq("id", runId);
  const owner = bundle.run!.owner_id;
  await supabase.from("exports").insert({
    owner_id: owner,
    run_id: runId,
    payload: {
      mode: "MANUAL_UPLOAD_ONLY",
      files: bundle.modules.map((m: any) => ({ file: m.file_name, key: m.module_key })),
      approved_at: new Date().toISOString(),
    },
  });
}