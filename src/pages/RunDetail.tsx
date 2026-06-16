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
  getRunBundle,
  hardRegenerateFailedModules,
  regeneratePackageContent,
  reopenForRegeneration,
  rejectAssumption,
  retryModule,
  stopRun,
} from "@/lib/runner/api";
import type { RegenerateSummary } from "@/lib/runner/api";
import { CHUNK_STATUS_LABEL, isForbiddenModuleKey, statusLabel } from "@/lib/runner/types";

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
  const ready = r.status === "READY_FOR_SELLER_REVIEW";
  const modules = bundle.modules as any[];
  const chunks = bundle.chunks as any[];
  const completed = modules.filter((m) => m.status === "acked").length;
  const failed = modules.filter((m) => m.status === "failed").length;
  const pending = modules.length - completed - failed;
  const pct = modules.length ? Math.round((completed / modules.length) * 100) : 0;

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
          <TabsTrigger value="qc">Pemeriksaan Kualitas</TabsTrigger>
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
          <p className="text-sm text-muted-foreground"><b>Upload manual saja.</b> Semua listing harus di-upload secara manual ke marketplace masing-masing setelah review seller.</p>
          {(r.marketplaces ?? []).map((mp: string) => {
            const mod = modules.find((m: any) => m.module_key === `MARKETPLACE_${mp.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_LISTING`);
            return (
              <Card key={mp}><CardHeader><CardTitle className="text-sm">{mp}</CardTitle></CardHeader>
                <CardContent>
                  {mod?.content ? <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-md">{mod.content}</pre>
                    : <p className="text-sm text-muted-foreground">Belum di-generate.</p>}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* TAB 6 — FILES */}
        <TabsContent value="files" className="mt-4 space-y-2">
          {modules.filter((m) => !isForbiddenModuleKey(m.module_key)).map((m: any) => (
            <Card key={m.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.file_name}</div>
                  <div className="text-xs text-muted-foreground">{m.module_key} • {m.status}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!m.content} onClick={() => { navigator.clipboard.writeText(m.content || ""); toast.success("Disalin."); }}>
                    <Copy className="w-4 h-4 mr-1" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" disabled={!m.content} onClick={() => {
                    const blob = new Blob([m.content || ""], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = m.file_name; a.click();
                    URL.revokeObjectURL(url);
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
              <div>Blocking errors: <b>{bundle.qc.blocking_errors}</b></div>
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

        {/* TAB 8 — APPROVAL */}
        <TabsContent value="approval" className="mt-4">
          <ApprovalCard ready={ready} runId={r.id} busy={busy} reload={reload} setBusy={setBusy} status={r.status} approvedAt={r.approved_at} onReopen={() => runRegenerate("full")} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <div className="p-2 rounded-md bg-muted"><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div>;
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