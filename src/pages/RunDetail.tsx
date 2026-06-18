import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/runner/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ChevronDown, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import {
  approveArchitecture,
  approvePackage,
  buildManifest,
  confirmAssumption,
  correctAssumption,
  generateAllRemainingFiles,
  generateAllRemainingFilesWithProgress,
  generateArchitectureForRun,
  ensureQcArtifactsSynced,
  getRunBundle,
  hardRegenerateFailedModules,
  regeneratePackageContent,
  reopenForRegeneration,
  rejectAssumption,
  retryModule,
  stopRun,
  upgradePackageToSellReady,
} from "@/lib/runner/api";
import type { RegenerateSummary } from "@/lib/runner/api";
import {
  CHUNK_STATUS_LABEL,
  MARKETPLACE_BUNDLE_MODULE,
  MARKETPLACE_MODULES,
  REQUIRED_CORE_FILES,
  FINAL_BUYER_FILES,
  FINAL_BUYER_MODULES,
  SELLER_TOOLKIT_FILE,
  ADMIN_MODULES,
  isForbiddenModuleKey,
  statusLabel,
} from "@/lib/runner/types";
import { buildBuyerZip, buildSellerZip, buildFullSystemZip, downloadBlob as v2DownloadBlob, buyerPackageIsClean } from "@/lib/runner/zipExport";
import { generateProductHandbookPdf } from "@/lib/runner/pdf";
import { calculateCommercialReadiness, detectProductIntent, generateProductStrategy } from "@/lib/runner/engine";

const BUYER_PACKAGE_FILES = new Set<string>(FINAL_BUYER_FILES as readonly string[]);
const BUYER_TEXT_MODULE_FILES = new Set<string>(FINAL_BUYER_MODULES as readonly string[]);
const ADMIN_REVIEW_FILES = new Set<string>(ADMIN_MODULES as readonly string[]);
const SELLER_TOOLKIT_FILES = new Set<string>([SELLER_TOOLKIT_FILE]);

function sanitizeZipName(value: string) {
  return (value || "ppf-package")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "ppf-package";
}

function getMarketplaceDefinition(marketplace: string) {
  return Object.values(MARKETPLACE_MODULES).find((m) => m.marketplace === marketplace);
}

function moduleCategory(module: any) {
  if (BUYER_PACKAGE_FILES.has(module.file_name)) return "Buyer File";
  if (SELLER_TOOLKIT_FILES.has(module.file_name)) return "Seller Toolkit";
  if (module.category === "marketplace" || Object.values(MARKETPLACE_MODULES).some((m) => m.file === module.file_name)) return "Marketplace Listing";
  if (ADMIN_REVIEW_FILES.has(module.file_name)) return "QC/Admin";
  if (module.file_name === MARKETPLACE_BUNDLE_MODULE.file) return "QC/Admin";
  return "Seller/Admin";
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function push16(out: number[], value: number) { out.push(value & 255, (value >>> 8) & 255); }
function push32(out: number[], value: number) { out.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255); }
function pushBytes(out: number[], bytes: Uint8Array) { for (const b of bytes) out.push(b); }

function createZip(entries: Array<{ path: string; content: string }>) {
  const enc = new TextEncoder();
  const out: number[] = [];
  const central: number[] = [];
  for (const entry of entries) {
    const name = enc.encode(entry.path.replace(/^\/+/, ""));
    const data = enc.encode(entry.content ?? "");
    const crc = crc32(data);
    const offset = out.length;

    push32(out, 0x04034b50);
    push16(out, 20);
    push16(out, 0x0800);
    push16(out, 0);
    push16(out, 0);
    push16(out, 0);
    push32(out, crc);
    push32(out, data.length);
    push32(out, data.length);
    push16(out, name.length);
    push16(out, 0);
    pushBytes(out, name);
    pushBytes(out, data);

    push32(central, 0x02014b50);
    push16(central, 20);
    push16(central, 20);
    push16(central, 0x0800);
    push16(central, 0);
    push16(central, 0);
    push16(central, 0);
    push32(central, crc);
    push32(central, data.length);
    push32(central, data.length);
    push16(central, name.length);
    push16(central, 0);
    push16(central, 0);
    push16(central, 0);
    push16(central, 0);
    push32(central, 0);
    push32(central, offset);
    pushBytes(central, name);
  }
  const centralOffset = out.length;
  out.push(...central);
  push32(out, 0x06054b50);
  push16(out, 0);
  push16(out, 0);
  push16(out, entries.length);
  push16(out, entries.length);
  push32(out, central.length);
  push32(out, centralOffset);
  push16(out, 0);
  return new Blob([new Uint8Array(out)], { type: "application/zip" });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function helperUploadInstructions(marketplaces: string[]) {
  return `# Upload Instructions\n\n1. Upload file buyer-package ZIP sebagai produk digital utama.\n2. Gunakan seller-marketplace-pack untuk copy listing, harga, thumbnail brief, dan checklist.\n3. Siapkan cover berdasarkan 11_Thumbnail_Brief.md.\n4. Marketplace terpilih: ${marketplaces.join(", ") || "-"}.\n5. Semua upload dilakukan manual. Tidak ada API dan tidak ada auto-publish.\n6. Seller wajib cek kebijakan marketplace sebelum publish.\n7. Jangan memakai klaim jaminan income, sales, konversi, atau marketplace approval.\n`;
}

function helperFileMap(modules: any[]) {
  const rows = modules
    .filter((m) => m.content && !isForbiddenModuleKey(m.module_key))
    .map((m) => `| ${m.file_name} | ${moduleCategory(m)} | ${BUYER_PACKAGE_FILES.has(m.file_name) ? "Buyer package" : "Seller/admin reference"} |`)
    .join("\n");
  return `# File Map\n\n| File | Category | Visibility |\n|---|---|---|\n${rows}\n`;
}

function helperSellerChecklist() {
  return `# Final Seller Checklist\n\n- [ ] Buyer ZIP bisa dibuka.\n- [ ] PromptBook sudah dicek.\n- [ ] CSV bisa dibuka di spreadsheet.\n- [ ] License dan disclaimer ikut disertakan.\n- [ ] Sample Input/Output ada.\n- [ ] Listing marketplace direview manual.\n- [ ] Harga dan thumbnail sudah siap.\n- [ ] Tidak ada klaim income/sales/approval marketplace.\n- [ ] Kebijakan marketplace sudah dicek.\n- [ ] Produk diupload manual.\n`;
}

export default function RunDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [bundle, setBundle] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ i: number; total: number; file: string } | null>(null);
  const [lastRegen, setLastRegen] = useState<RegenerateSummary | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    const b = await getRunBundle(id);
    setBundle(b);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const run = (action: () => Promise<any>, ok?: string) => async () => {
    setBusy(true);
    try { await action(); if (ok) toast.success(ok); await reload(); }
    catch (e: any) { toast.error(e.message ?? String(e)); }
    finally { setBusy(false); }
  };

  const runInitialGenerate = async () => {
    setBusy(true);
    setProgress({ i: 0, total: 0, file: "" });
    try {
      await generateAllRemainingFilesWithProgress(r!.id, (i, total, file) => setProgress({ i, total, file }));
      toast.success("Generate selesai.");
      await reload();
    } catch (e: any) { toast.error(e.message ?? String(e)); }
    finally { setBusy(false); setProgress(null); }
  };

  const runRegenerate = async (mode: "full" | "hard") => {
    setBusy(true);
    setProgress({ i: 0, total: 0, file: "" });
    setLastRegen(null);
    try {
      const fn = mode === "hard" ? hardRegenerateFailedModules : regeneratePackageContent;
      const summary = await fn(r!.id, (i, total, file) => setProgress({ i, total, file }));
      setLastRegen(summary);
      if (summary.filesUpdated.length === 0) {
        toast.error("Regenerate gagal: tidak ada file yang berhasil diperbarui.");
      } else if (summary.blockingAfter > 0) {
        toast.warning("Regenerate selesai, tetapi QC masih menemukan error. Cek detail error.");
      } else {
        toast.success("Regenerate selesai.");
      }
      await reload();
    } catch (e: any) { toast.error(e.message ?? String(e)); }
    finally { setBusy(false); setProgress(null); }
  };

  if (!bundle) return <AppShell><p>Memuat…</p></AppShell>;
  if (!bundle.run) return <AppShell><p>Run tidak ditemukan.</p></AppShell>;

  const r = bundle.run;
  const qcPayload = (bundle.qc?.payload ?? {}) as any;
  const ready = r.status === "READY_FOR_SELLER_REVIEW" && (qcPayload.score ?? 0) >= 85 && (bundle.qc?.blocking_errors ?? 1) === 0;
  const modules = bundle.modules as any[];
  const chunks = bundle.chunks as any[];
  const completed = modules.filter((m) => m.status === "acked").length;
  const failed = modules.filter((m) => m.status === "failed").length;
  const pending = modules.length - completed - failed;
  const pct = modules.length ? Math.round((completed / modules.length) * 100) : 0;
  const zipBaseName = sanitizeZipName(bundle.seller?.brand || bundle.seller?.niche || "ppf-package");
  const downloadableModules = modules.filter((m) => m.content && !isForbiddenModuleKey(m.module_key));
  const marketplaceFiles = downloadableModules.filter((m) => moduleCategory(m) === "Marketplace Listing");

  const downloadModuleZip = async (kind: "all" | "buyer" | "seller" | "complete") => {
    const date = todayStamp();
    let activeBundle = bundle;

    setBusy(true);
    setProgress({ i: 0, total: 0, file: "Final QC/manifest sync before ZIP export" });
    try {
      activeBundle = await ensureQcArtifactsSynced(r.id);
      setBundle(activeBundle);
      const modulesForCheck = (activeBundle?.modules ?? []) as any[];
      const qcPayloadAfter = (activeBundle?.qc?.payload ?? {}) as any;
      const pendingScorecard = modulesForCheck.some((m) => m.file_name === "QC_Scorecard.md" && String(m.content ?? "").includes("PENDING/100"));
      const staleManifest = modulesForCheck.some((m) => m.file_name === "12_Product_Manifest.json" && String(m.content ?? "").includes('"qc_score": null'));
      if (typeof qcPayloadAfter.score !== "number" || pendingScorecard || staleManifest) {
        toast.error("QC/manifest masih belum sinkron. Generate ulang semua file sebelum export.");
        return;
      }
      toast.success("QC dan manifest final sudah sinkron sebelum export ZIP.");
    } catch (e: any) {
      toast.error(e.message ?? String(e));
      return;
    } finally {
      setBusy(false);
      setProgress(null);
    }

    const activeRun = activeBundle.run ?? r;
    const activeModules = (activeBundle.modules as any[]).filter((m) => m.content && !isForbiddenModuleKey(m.module_key));
    const activeZipBaseName = sanitizeZipName(activeBundle.seller?.brand || activeBundle.seller?.niche || "ppf-package");
    let entries: Array<{ path: string; content: string }> = [];
    let fileName = `${activeZipBaseName}-${date}.zip`;

    if (kind === "buyer") {
      entries = activeModules
        .filter((m) => BUYER_PACKAGE_FILES.has(m.file_name))
        .map((m) => ({ path: `buyer-package/${m.file_name}`, content: m.content }));
      fileName = `buyer-package-${activeZipBaseName}-${date}.zip`;
    } else if (kind === "seller") {
      entries = activeModules
        .filter((m) => !BUYER_PACKAGE_FILES.has(m.file_name))
        .map((m) => ({ path: `seller-marketplace-pack/${m.file_name}`, content: m.content }));
      entries.push({ path: "seller-marketplace-pack/UPLOAD_INSTRUCTIONS.md", content: helperUploadInstructions(activeRun.marketplaces ?? []) });
      entries.push({ path: "seller-marketplace-pack/FILE_MAP.md", content: helperFileMap(activeModules) });
      fileName = `seller-marketplace-pack-${activeZipBaseName}-${date}.zip`;
    } else if (kind === "complete") {
      entries = [
        ...activeModules
          .filter((m) => BUYER_PACKAGE_FILES.has(m.file_name))
          .map((m) => ({ path: `buyer-package/${m.file_name}`, content: m.content })),
        ...activeModules
          .filter((m) => !BUYER_PACKAGE_FILES.has(m.file_name))
          .map((m) => ({ path: `seller-marketplace-pack/${m.file_name}`, content: m.content })),
        { path: "admin-review/UPLOAD_INSTRUCTIONS.md", content: helperUploadInstructions(activeRun.marketplaces ?? []) },
        { path: "admin-review/FILE_MAP.md", content: helperFileMap(activeModules) },
        { path: "admin-review/FINAL_SELLER_CHECKLIST.md", content: helperSellerChecklist() },
      ];
      fileName = `complete-marketplace-package-${activeZipBaseName}-${date}.zip`;
    } else {
      entries = activeModules.map((m) => ({ path: m.file_name, content: m.content }));
      fileName = `download-all-${activeZipBaseName}-${date}.zip`;
    }

    if (!entries.length) {
      toast.error("Belum ada file yang bisa diunduh.");
      return;
    }
    downloadBlob(createZip(entries), fileName);
  };

  return (
    <AppShell>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Dashboard</Link></Button>
      </div>
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="font-mono text-xs">{r.run_request_id}</div>
            <div className="text-sm">Adapter: <b>{r.adapter}</b></div>
            <div className="text-xs text-muted-foreground">Mode: {r.generation_mode} • Marketplace: {(r.marketplaces ?? []).join(", ") || "—"}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{statusLabel(r.status)}</Badge>
            <Button size="sm" variant="destructive" onClick={run(() => stopRun(r.id), "Run dihentikan.")} disabled={busy || r.status === "STOPPED"}>Stop Run</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="arsitektur">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="arsitektur">Arsitektur</TabsTrigger>
          <TabsTrigger value="asumsi">Asumsi</TabsTrigger>
          <TabsTrigger value="manifest">Manifest</TabsTrigger>
          <TabsTrigger value="pembuat">Pembuat File</TabsTrigger>
          <TabsTrigger value="paket">Paket Marketplace</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="pdf">PDF Handbook</TabsTrigger>
          <TabsTrigger value="export">Premium Export v2</TabsTrigger>
          <TabsTrigger value="qc">Pemeriksaan Kualitas</TabsTrigger>
          <TabsTrigger value="commercial">Commercial Readiness</TabsTrigger>
          <TabsTrigger value="approval">Persetujuan Final</TabsTrigger>
        </TabsList>

        {/* TAB 1 — ARSITEKTUR */}
        <TabsContent value="arsitektur" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Button onClick={run(() => generateArchitectureForRun(r.id), "Arsitektur dibuat.")} disabled={busy}>Generate Architecture</Button>
            <Button variant="outline" onClick={run(() => approveArchitecture(r.id), "Arsitektur disetujui.")} disabled={busy || !bundle.architecture}>Approve Architecture</Button>
          </div>
          {bundle.architecture ? (
            <>
              <div className="grid md:grid-cols-2 gap-3">
                {Object.entries(bundle.architecture.payload as Record<string, string>).map(([k, v]) => (
                  <Card key={k}><CardHeader><CardTitle className="text-sm capitalize">{k.replace(/_/g, " ")}</CardTitle></CardHeader>
                    <CardContent className="text-sm whitespace-pre-wrap">{v}</CardContent></Card>
                ))}
              </div>
              <Collapsible><CollapsibleTrigger className="text-xs underline">View Raw JSON</CollapsibleTrigger>
                <CollapsibleContent><pre className="text-xs bg-muted p-3 rounded-md overflow-auto">{JSON.stringify(bundle.architecture.payload, null, 2)}</pre></CollapsibleContent>
              </Collapsible>
            </>
          ) : <p className="text-sm text-muted-foreground">Belum ada arsitektur. Klik Generate Architecture.</p>}
        </TabsContent>

        {/* TAB 2 — ASUMSI */}
        <TabsContent value="asumsi" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">Asumsi adalah hal yang dipakai sistem untuk melanjutkan generate. Jika critical/blocking, harus dikonfirmasi atau diperbaiki dulu.</p>
          {bundle.assumptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada asumsi. Generate arsitektur dulu.</p>
          ) : bundle.assumptions.map((a: any) => (
            <AssumptionCard key={a.id} a={a} onChange={reload} busy={busy} setBusy={setBusy} />
          ))}
        </TabsContent>

        {/* TAB 3 — MANIFEST */}
        <TabsContent value="manifest" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Upload Manual Saja</Badge>
            <Badge variant="outline">API Disabled</Badge>
            <Badge variant="outline">No API Modules</Badge>
          </div>
          <Button onClick={run(() => buildManifest(r.id), "Manifest dibuat.")} disabled={busy}>Build Manifest</Button>
          {bundle.manifest ? (
            <>
              <Card><CardHeader><CardTitle className="text-sm">Ringkasan</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div>Total modul: <b>{bundle.manifest.payload.expected_modules?.length ?? 0}</b></div>
                  <div>Total chunk: <b>{bundle.manifest.payload.expected_chunks}</b></div>
                  <div>Marketplace: {(bundle.manifest.payload.marketplaces ?? []).join(", ") || "—"}</div>
                  <ul className="list-disc pl-5 mt-2">
                    {(bundle.manifest.payload.expected_modules ?? []).map((m: any) => (
                      <li key={m.key}>{m.file} <span className="text-xs text-muted-foreground">({m.chunks} chunk)</span></li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Collapsible><CollapsibleTrigger className="text-xs underline">View Raw JSON</CollapsibleTrigger>
                <CollapsibleContent><pre className="text-xs bg-muted p-3 rounded-md overflow-auto">{JSON.stringify(bundle.manifest.payload, null, 2)}</pre></CollapsibleContent>
              </Collapsible>
            </>
          ) : <p className="text-sm text-muted-foreground">Manifest belum dibuat.</p>}
        </TabsContent>

        {/* TAB 4 — PEMBUAT FILE */}
        <TabsContent value="pembuat" className="mt-4 space-y-3">
          <Card><CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={runInitialGenerate} disabled={busy || modules.length === 0}>
                Generate Semua File
              </Button>
              <Button size="lg" variant="outline" onClick={() => runRegenerate("full")} disabled={busy || modules.length === 0}>
                Regenerate Package Content
              </Button>
              <Button size="lg" variant="secondary" onClick={() => runRegenerate("hard")} disabled={busy || modules.length === 0}>
                Hard Regenerate Failed Modules
              </Button>
              <Button size="lg" variant="default" onClick={async () => {
                setBusy(true);
                setProgress({ i: 0, total: 0, file: "" });
                setLastRegen(null);
                try {
                  const summary = await upgradePackageToSellReady(r!.id, (i, total, file) => setProgress({ i, total, file }));
                  setLastRegen(summary);
                  toast.success(`Upgrade selesai. QC score: ${summary.scoreAfter ?? "-"}`);
                  await reload();
                } catch (e: any) { toast.error(e.message ?? String(e)); }
                finally { setBusy(false); setProgress(null); }
              }} disabled={busy}>
                Upgrade Package to Sell-Ready Draft
              </Button>
            </div>
            {progress && progress.total > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                Generating file {progress.i} of {progress.total}: <span className="font-mono">{progress.file}</span>
              </div>
            )}
            {lastRegen && (
              <Card className="mt-3 border-dashed">
                <CardHeader><CardTitle className="text-sm">Regenerate Summary</CardTitle></CardHeader>
                <CardContent className="text-xs space-y-1">
                  <div>Modules regenerated: <b>{lastRegen.modulesRegenerated}</b></div>
                  <div>Files updated: {lastRegen.filesUpdated.length ? <span className="font-mono">{lastRegen.filesUpdated.join(", ")}</span> : <i>tidak ada</i>}</div>
                  <div>QC rerun: <b>{lastRegen.qcRerun ? "yes" : "no"}</b></div>
                  <div>Blocking errors before: <b>{lastRegen.blockingBefore}</b></div>
                  <div>Blocking errors after: <b>{lastRegen.blockingAfter}</b></div>
                  <div>Run status after: <b>{statusLabel(lastRegen.runStatus as any)}</b></div>
                </CardContent>
              </Card>
            )}
            <div className="mt-3 text-sm grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Stat label="Total" value={modules.length} />
              <Stat label="Selesai" value={completed} />
              <Stat label="Belum" value={pending} />
              <Stat label="Gagal" value={failed} />
              <Stat label="Progress" value={`${pct}%`} />
            </div>
          </CardContent></Card>

          <div className="space-y-2">
            {modules.map((m: any) => {
              const mChunks = chunks.filter((c: any) => c.module_id === m.id);
              return (
                <Collapsible key={m.id}>
                  <Card>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{m.file_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Progress {mChunks.filter((c: any) => c.acked).length}/{mChunks.length} • Status {CHUNK_STATUS_LABEL[m.status] ?? m.status} • Validation {m.validation}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.status === "failed" && (
                          <Button size="sm" variant="outline" onClick={run(() => retryModule(m.id), "Modul direset.")} disabled={busy}>Retry</Button>
                        )}
                        <CollapsibleTrigger asChild><Button size="sm" variant="ghost"><ChevronDown className="w-4 h-4" /></Button></CollapsibleTrigger>
                      </div>
                    </CardContent>
                    <CollapsibleContent>
                      <div className="p-3 border-t text-xs space-y-1">
                        {mChunks.map((c: any) => (
                          <div key={c.id}>Chunk {c.chunk_index}: {CHUNK_STATUS_LABEL[c.status] ?? c.status} • {c.validation}</div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>

          <Collapsible>
            <CollapsibleTrigger className="text-xs underline">Advanced Manual Controls</CollapsibleTrigger>
            <CollapsibleContent className="mt-2 text-xs text-muted-foreground">
              Tidak diperlukan untuk alur normal. PASS chunks otomatis di-ACK; modul gagal punya tombol Retry di atas.
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        {/* TAB 5 — PAKET MARKETPLACE */}
        <TabsContent value="paket" className="mt-4 space-y-3">
          <Card>
            <CardContent className="p-4 text-sm space-y-2">
              <p><b>Upload manual saja.</b> Semua listing harus di-upload secara manual ke marketplace masing-masing setelah review seller.</p>
              <p className="text-muted-foreground">Jika listing masih kosong, buka tab <b>Pembuat File</b> lalu klik <b>Generate Semua File</b> atau <b>Upgrade Package to Sell-Ready Draft</b>.</p>
            </CardContent>
          </Card>
          {(r.marketplaces ?? []).map((mp: string) => {
            const def = getMarketplaceDefinition(mp);
            const mod = modules.find((m: any) =>
              (def && (m.module_key === def.key || m.file_name === def.file)) ||
              m.marketplace === mp ||
              (mp === "Lynk.id" && /LynkID|Lynk\.id/i.test(`${m.module_key} ${m.file_name}`)) ||
              (mp === "Shopee" && /Shopee/i.test(`${m.module_key} ${m.file_name}`)) ||
              (mp === "Tokopedia" && /Tokopedia/i.test(`${m.module_key} ${m.file_name}`))
            );
            return (
              <Card key={mp}><CardHeader><CardTitle className="text-sm">{mp}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {mod?.content ? (
                    <>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{mod.file_name}</Badge>
                        <Badge variant="secondary">{mod.status}</Badge>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-md max-h-[520px] overflow-auto">{mod.content}</pre>
                    </>
                  ) : <p className="text-sm text-muted-foreground">Belum di-generate. File yang dicari: {def?.file ?? mp}</p>}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* TAB 6 — FILES */}
        <TabsContent value="files" className="mt-4 space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">File yang Perlu Diunggah ke Marketplace</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
              <p><b>Buyer Package ZIP</b> adalah file utama yang diberikan/diupload sebagai produk digital untuk pembeli.</p>
              <p><b>Seller Marketplace Pack ZIP</b> dipakai seller untuk copy listing, pricing, thumbnail brief, manifest, QC, dan checklist upload.</p>
              <p><b>Complete Package ZIP</b> adalah arsip lengkap untuk review final. Semua upload tetap manual dan seller wajib cek kebijakan marketplace.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadModuleZip("all")} disabled={!downloadableModules.length}><Download className="w-4 h-4 mr-1" /> Download All ZIP</Button>
                <Button size="sm" variant="outline" onClick={() => downloadModuleZip("buyer")} disabled={!downloadableModules.length}><Download className="w-4 h-4 mr-1" /> Buyer Package ZIP</Button>
                <Button size="sm" variant="outline" onClick={() => downloadModuleZip("seller")} disabled={!downloadableModules.length}><Download className="w-4 h-4 mr-1" /> Seller Marketplace Pack ZIP</Button>
                <Button size="sm" onClick={() => downloadModuleZip("complete")} disabled={!downloadableModules.length}><Download className="w-4 h-4 mr-1" /> Complete Package ZIP</Button>
              </div>
              <div className="text-xs text-muted-foreground">Marketplace listing terdeteksi: {marketplaceFiles.length}</div>
            </CardContent>
          </Card>

          {modules.filter((m) => !isForbiddenModuleKey(m.module_key)).map((m: any) => (
            <Card key={m.id}>
              <CardContent className="p-3 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <div className="font-medium">{m.file_name}</div>
                  <div className="text-xs text-muted-foreground">{m.module_key} • {m.status}</div>
                  <Badge className="mt-2" variant={moduleCategory(m) === "Buyer File" ? "default" : "secondary"}>{moduleCategory(m)}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!m.content} onClick={() => { navigator.clipboard.writeText(m.content || ""); toast.success("Disalin."); }}>
                    <Copy className="w-4 h-4 mr-1" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" disabled={!m.content} onClick={() => {
                    const blob = new Blob([m.content || ""], { type: m.file_name.endsWith(".csv") ? "text/csv" : "text/plain" });
                    downloadBlob(blob, m.file_name);
                  }}>
                    <Download className="w-4 h-4 mr-1" /> Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* TAB 7 — QC */}
        <TabsContent value="qc" className="mt-4">
          {bundle.qc ? (
            <Card><CardContent className="p-4 text-sm space-y-2">
              <div className="grid sm:grid-cols-3 gap-2">
                <Stat label="QC Score" value={bundle.qc.payload.score ?? "-"} />
                <Stat label="QC Status" value={bundle.qc.payload.status ?? "-"} />
                <Stat label="Blocking Errors" value={bundle.qc.blocking_errors} />
              </div>
              <div>
                <b>Errors:</b>
                <ul className="list-disc pl-5">{(bundle.qc.payload.errors ?? []).map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
              </div>
              <div>
                <b>Warnings:</b>
                <ul className="list-disc pl-5">{(bundle.qc.payload.warnings ?? []).map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
              </div>
              <Collapsible><CollapsibleTrigger className="text-xs underline">View Checks</CollapsibleTrigger>
                <CollapsibleContent><pre className="text-xs bg-muted p-3 rounded-md">{JSON.stringify(bundle.qc.payload.checks, null, 2)}</pre></CollapsibleContent>
              </Collapsible>
              {bundle.qc.blocking_errors > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="default" onClick={async () => {
                    setBusy(true);
                    setProgress({ i: 0, total: 0, file: "" });
                    try {
                      const summary = await upgradePackageToSellReady(r!.id, (i, total, file) => setProgress({ i, total, file }));
                      setLastRegen(summary);
                      toast.success(`Upgrade selesai. QC score: ${summary.scoreAfter ?? "-"}`);
                      await reload();
                    } catch (e: any) { toast.error(e.message ?? String(e)); }
                    finally { setBusy(false); setProgress(null); }
                  }} disabled={busy}>
                    Upgrade Package to Sell-Ready Draft
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runRegenerate("full")} disabled={busy}>
                    Regenerate Package Content
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => runRegenerate("hard")} disabled={busy}>
                    Hard Regenerate Failed Modules
                  </Button>
                </div>
              )}
            </CardContent></Card>
          ) : <p className="text-sm text-muted-foreground">QC belum tersedia. Jalankan Generate Semua File dulu.</p>}
        </TabsContent>

        {/* TAB — PDF Handbook (v2) */}
        <TabsContent value="pdf" className="mt-4 space-y-3">
          <PdfHandbookCard bundle={bundle} />
        </TabsContent>

        {/* TAB — Premium Export v2 */}
        <TabsContent value="export" className="mt-4 space-y-3">
          <PremiumExportCard bundle={bundle} />
        </TabsContent>


        {/* TAB — COMMERCIAL READINESS */}
        <TabsContent value="commercial" className="mt-4 space-y-3">
          <CommercialReadinessCard bundle={bundle} />
        </TabsContent>

        {/* TAB 8 — APPROVAL */}
        <TabsContent value="approval" className="mt-4">
          <ApprovalCard ready={ready} runId={r.id} busy={busy} reload={reload} setBusy={setBusy} status={r.status} approvedAt={r.approved_at} onReopen={() => runRegenerate("full")} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}


function CommercialReadinessCard({ bundle }: { bundle: any }) {
  const seller = bundle?.seller;
  const run = bundle?.run;
  if (!seller || !run) return <p className="text-sm text-muted-foreground">Seller/run belum siap.</p>;
  const intent = detectProductIntent({
    productName: seller.brand || "",
    niche: seller.niche || "",
    targetAudience: seller.audience || "",
    description: seller.confirmed_product_description || "",
    selectedAdapter: run.adapter || "CUSTOM",
    promptCount: seller.prompt_count || 10,
  });
  const strategy = generateProductStrategy({
    productName: seller.brand || "",
    niche: seller.niche || "",
    audience: seller.audience || "",
    description: seller.confirmed_product_description || "",
    promptCount: seller.prompt_count || 10,
    license: seller.license || "Personal & Commercial",
    targetMarket: seller.target_market || "Indonesia",
  }, intent);
  const commercial = calculateCommercialReadiness({ intent, strategy, modules: bundle.modules || [], marketplaces: run.marketplaces || [] });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Commercial Readiness</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid sm:grid-cols-3 md:grid-cols-6 gap-2">
          <Stat label="Overall" value={`${commercial.overall_commercial_score}/100`} />
          <Stat label="Level" value={commercial.readiness_level} />
          <Stat label="Positioning" value={commercial.positioning_score} />
          <Stat label="Prompt Depth" value={commercial.prompt_depth_score} />
          <Stat label="PDF Premium" value={commercial.pdf_premium_score} />
          <Stat label="Marketplace" value={commercial.marketplace_copy_score} />
        </div>
        <Card className="border-dashed"><CardContent className="p-3 space-y-1">
          <div><b>Detected Intent:</b> {intent.intent} ({intent.confidence}/100)</div>
          <div><b>Recommended Adapter:</b> {intent.recommended_adapter}</div>
          {intent.mismatch_warning && <div className="text-destructive"><b>Mismatch:</b> {intent.mismatch_warning}</div>}
          {intent.ambiguity_warning && <div className="text-yellow-700"><b>Ambiguity:</b> {intent.ambiguity_warning}</div>}
          <div><b>Buyer Transformation:</b> {strategy.buyer_transformation}</div>
        </CardContent></Card>
        {commercial.recommendations.length > 0 ? (
          <div>
            <b>Recommendations:</b>
            <ul className="list-disc pl-5">{commercial.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        ) : <p className="text-muted-foreground">Tidak ada rekomendasi mayor. Tetap review manual sebelum jual.</p>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <div className="p-2 rounded-md bg-muted"><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div>;
}

function handbookMetaFromBundle(bundle: any) {
  return {
    productName: bundle?.seller?.brand || "Premium Product",
    niche: bundle?.seller?.niche || "",
    audience: bundle?.seller?.audience || "",
    license: bundle?.seller?.license || "Personal & Commercial",
    version: "1.0",
    releaseDate: new Date().toISOString().slice(0, 10),
  };
}

function PdfHandbookCard({ bundle }: { bundle: any }) {
  const draft = (bundle.modules as any[]).find((m) => m.file_name === "20_Complete_PDF_Product_Draft.md");
  const meta = handbookMetaFromBundle(bundle);
  const handleDownload = () => {
    if (!draft?.content) { toast.error("PDF source draft belum digenerate. Jalankan Generate Semua File dulu."); return; }
    try {
      const blob = generateProductHandbookPdf(draft.content, meta);
      v2DownloadBlob(blob, "Product_Handbook.pdf");
      toast.success("Product_Handbook.pdf dibuat.");
    } catch (e: any) { toast.error(e.message ?? String(e)); }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Premium PDF Handbook</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Sumber PDF: <code>20_Complete_PDF_Product_Draft.md</code>. Cover styled, page break per H1, footer page numbers. Tidak menyertakan materi seller.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDownload} disabled={!draft?.content}><Download className="w-4 h-4 mr-1" /> Download Product_Handbook.pdf</Button>
        </div>
        {draft?.content ? (
          <Collapsible>
            <CollapsibleTrigger className="text-xs underline">Preview Markdown Source</CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-xs bg-muted p-3 rounded-md max-h-[480px] overflow-auto whitespace-pre-wrap">{draft.content}</pre>
            </CollapsibleContent>
          </Collapsible>
        ) : <p className="text-xs text-muted-foreground">Source draft belum ada. Generate Semua File terlebih dahulu.</p>}
      </CardContent>
    </Card>
  );
}

function PremiumExportCard({ bundle }: { bundle: any }) {
  const modules = (bundle.modules as any[]).filter((m) => m.content && !isForbiddenModuleKey(m.module_key));
  const meta = handbookMetaFromBundle(bundle);
  const qcScore = bundle?.qc?.payload?.score;
  const blocking = bundle?.qc?.blocking_errors ?? null;
  const hasPdfDraft = modules.some((m) => m.file_name === "20_Complete_PDF_Product_Draft.md");
  const hasSellerToolkit = modules.some((m) => m.file_name === "00_Seller_Master_Toolkit.md");
  const isolation = buyerPackageIsClean(modules);

  const run = (mode: "buyer" | "seller" | "full") => async () => {
    try {
      let blob: Blob; let name: string;
      const input = { modules, meta };
      if (mode === "buyer") { blob = await buildBuyerZip(input); name = "premium-product-system_v1.0_buyer.zip"; }
      else if (mode === "seller") { blob = await buildSellerZip(input); name = "premium-product-system_v1.0_seller-toolkit.zip"; }
      else { blob = await buildFullSystemZip(input); name = "premium-product-system_v1.0_full-system.zip"; }
      v2DownloadBlob(blob, name);
      toast.success(`${name} siap.`);
    } catch (e: any) { toast.error(e.message ?? String(e)); }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader><CardTitle className="text-base">Premium Product Architecture v2 — Export</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Tiga mode export. Buyer ZIP berisi <b>hanya</b> file buyer + premium PDF. Seller Toolkit ZIP berisi Seller Master Toolkit + manifest admin. Full System ZIP menggabungkan ketiganya.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Stat label="QC Score" value={qcScore ?? "—"} />
            <Stat label="Blocking Errors" value={blocking ?? "—"} />
            <Stat label="PDF Draft" value={hasPdfDraft ? "Ready" : "Missing"} />
            <Stat label="Seller Toolkit" value={hasSellerToolkit ? "Ready" : "Missing"} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Manual Upload Only</Badge>
            <Badge variant="outline">No Marketplace API</Badge>
            <Badge variant={isolation.ok ? "outline" : "destructive"}>{isolation.ok ? "Buyer Isolation OK" : `Buyer leak: ${isolation.leaks.join(", ")}`}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={run("buyer")} disabled={!hasPdfDraft}><Download className="w-4 h-4 mr-1" /> Buyer ZIP</Button>
            <Button variant="secondary" onClick={run("seller")} disabled={!hasSellerToolkit}><Download className="w-4 h-4 mr-1" /> Seller Toolkit ZIP</Button>
            <Button variant="outline" onClick={run("full")} disabled={!hasPdfDraft || !hasSellerToolkit}><Download className="w-4 h-4 mr-1" /> Full System ZIP</Button>
          </div>
          {(!hasPdfDraft || !hasSellerToolkit) && (
            <p className="text-xs text-muted-foreground">Jika tombol disable: jalankan <b>Generate Semua File</b> di tab Pembuat File agar <code>20_Complete_PDF_Product_Draft.md</code> dan <code>00_Seller_Master_Toolkit.md</code> tersedia.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AssumptionCard({ a, onChange, busy, setBusy }: any) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(a.correction ?? "");
  const wrap = (fn: () => Promise<any>) => async () => {
    setBusy(true);
    try { await fn(); await onChange(); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Card><CardContent className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={a.type === "critical" ? "destructive" : "secondary"}>{a.type}</Badge>
        <Badge variant="outline">impact: {a.impact}</Badge>
        <Badge variant="outline">{a.status}</Badge>
      </div>
      <p className="text-sm">{a.text}</p>
      {a.correction && <p className="text-xs text-muted-foreground">Koreksi: {a.correction}</p>}
      {a.status === "pending" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={wrap(() => confirmAssumption(a.id))} disabled={busy}>Confirm</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing((s) => !s)}>Correct</Button>
          <Button size="sm" variant="ghost" onClick={wrap(() => rejectAssumption(a.id))} disabled={busy}>Reject</Button>
        </div>
      )}
      {editing && (
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis koreksi singkat" />
          <Button size="sm" onClick={wrap(() => correctAssumption(a.id, text))} disabled={busy || !text}>Simpan</Button>
        </div>
      )}
    </CardContent></Card>
  );
}

function ApprovalCard({ ready, runId, busy, reload, setBusy, status, approvedAt, onReopen }: any) {
  const [checked, setChecked] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [token, setToken] = useState("");

  if (status === "PASS_FINAL") {
    const doReopen = async () => {
      setBusy(true);
      try {
        await reopenForRegeneration(runId);
        toast.success("Run dibuka kembali untuk regenerasi konten.");
        await reload();
        if (onReopen) await onReopen();
      } catch (e: any) {
        toast.error(e.message ?? String(e));
      } finally {
        setBusy(false);
      }
    };
    return <Card><CardContent className="p-4 text-sm space-y-3">
      <Badge>Disetujui (PASS_FINAL)</Badge>
      <p className="mt-2 text-muted-foreground">Disetujui pada {approvedAt ? new Date(approvedAt).toLocaleString() : "—"}.</p>
      <Button size="sm" variant="outline" onClick={doReopen} disabled={busy}>
        Reopen for Content Regeneration
      </Button>
    </CardContent></Card>;
  }

  const doApprove = async () => {
    setBusy(true);
    try { await approvePackage(runId); toast.success("Paket disetujui."); await reload(); }
    catch (e: any) { toast.error(e.message ?? String(e)); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardContent className="p-4 space-y-3 text-sm">
      <div>
        Status: <Badge variant={ready ? "default" : "outline"}>{ready ? "Siap" : "Belum siap"}</Badge>
      </div>
      <ul className="text-xs space-y-1 list-disc pl-5">
        <li>Manifest sudah dibuat</li>
        <li>Semua modul selesai &amp; PASS</li>
        <li>QC blocking errors = 0</li>
      </ul>
      <label className="flex items-center gap-2">
        <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
        <span>Saya sudah review paket dan siap menyetujui.</span>
      </label>
      <Button onClick={doApprove} disabled={busy || !ready || !checked}>Approve Final Package</Button>
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger className="text-xs underline">Advanced Approval Token</CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          <Textarea rows={2} value={token} onChange={(e) => setToken(e.target.value)} placeholder="Opsional: token manual." />
          <p className="text-xs text-muted-foreground">Mode default adalah one-click di atas. Token manual hanya untuk skenario khusus.</p>
        </CollapsibleContent>
      </Collapsible>
    </CardContent></Card>
  );
}
