import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/runner/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ADAPTERS, AdapterId, LANGUAGES, LICENSES, MARKETPLACES, PROMPT_COUNTS, TARGET_MARKETS, TONES } from "@/lib/runner/types";
import { createRun, generateDescriptionCorrection } from "@/lib/runner/api";
import { generateKeyAnchors } from "@/lib/runner/engine";
import { toast } from "sonner";

export default function NewRun() {
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [adapter, setAdapter] = useState<AdapterId | "">("");
  const [form, setForm] = useState({
    brand: "",
    language: "Indonesia",
    target_market: "Indonesia",
    niche: "",
    audience: "",
    description: "",
    prompt_count: 10 as number,
    tone: "Friendly",
    license: "Personal & Commercial",
    target_price: "",
  });
  const [marketplaces, setMarketplaces] = useState<string[]>([]);
  const [anchors, setAnchors] = useState<string[]>([]);
  const [anchorsText, setAnchorsText] = useState("");

  // description correction state
  const [corrected, setCorrected] = useState<string | null>(null);
  const [editingCorr, setEditingCorr] = useState(false);
  const [editedCorr, setEditedCorr] = useState("");
  const [confirmedDesc, setConfirmedDesc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const adapterLabel = useMemo(() => ADAPTERS.find((a) => a.id === adapter)?.label, [adapter]);

  function update<K extends keyof typeof form>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleCorrect() {
    if (!form.description.trim()) return toast.error("Tulis deskripsi singkat dulu.");
    setBusy(true);
    try {
      const c = await generateDescriptionCorrection(null, form.description);
      setCorrected(c);
      setEditedCorr(c);
      setConfirmedDesc(null);
    } finally { setBusy(false); }
  }

  function handleAutoAnchors() {
    const arr = generateKeyAnchors({
      niche: form.niche, audience: form.audience,
      confirmedDescription: confirmedDesc ?? "",
      marketplaces, tone: form.tone, adapter: adapter as string,
    });
    setAnchors(arr);
    setAnchorsText(arr.join("\n"));
  }

  const canNextFromStep2 =
    form.brand.trim() && form.niche.trim() && form.audience.trim() &&
    form.description.trim() && !!confirmedDesc && marketplaces.length > 0;

  async function submit() {
    setBusy(true);
    try {
      const finalAnchors = (anchorsText.split(/\n+/).map((s) => s.trim()).filter(Boolean));
      const run = await createRun({
        adapter: adapter as string,
        brand: form.brand,
        language: form.language,
        target_market: form.target_market,
        niche: form.niche,
        audience: form.audience,
        description: form.description,
        prompt_count: form.prompt_count,
        tone: form.tone,
        key_anchors: finalAnchors,
        license: form.license,
        target_price: form.target_price || undefined,
        marketplaces,
        original_description: form.description,
        corrected_description: corrected ?? "",
        confirmed_product_description: confirmedDesc ?? "",
      });
      toast.success("Run dibuat.");
      nav(`/runs/${run.id}`);
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally { setBusy(false); }
  }

  return (
    <AppShell>
      <h2 className="text-2xl font-bold mb-1">Buat Run Baru</h2>
      <p className="text-sm text-muted-foreground mb-4">Mode: <Badge variant="secondary">Upload Manual Saja</Badge></p>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Step 1 — Pilih Jenis Produk</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
              {ADAPTERS.map((a) => (
                <button key={a.id} onClick={() => setAdapter(a.id)}
                  className={`p-3 text-left rounded-md border ${adapter === a.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                  <div className="font-medium">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.id}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button disabled={!adapter} onClick={() => setStep(2)}>Lanjut</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Step 2 — Informasi Produk</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">Adapter: <b>{adapterLabel}</b></div>

            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Nama Seller / Brand</Label><Input value={form.brand} onChange={(e) => update("brand", e.target.value)} /></div>
              <div><Label>Bahasa Output</Label>
                <Select value={form.language} onValueChange={(v) => update("language", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Negara / Target Market</Label>
                <Select value={form.target_market} onValueChange={(v) => update("target_market", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TARGET_MARKETS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Gaya Bahasa / Tone</Label>
                <Select value={form.tone} onValueChange={(v) => update("tone", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TONES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Jumlah Prompt</Label>
                <Select value={String(form.prompt_count)} onValueChange={(v) => update("prompt_count", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROMPT_COUNTS.map(l => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Lisensi Produk</Label>
                <Select value={form.license} onValueChange={(v) => update("license", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LICENSES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>Niche Produk</Label>
                <Input value={form.niche} onChange={(e) => update("niche", e.target.value)}
                  placeholder="contoh: prompt untuk mengubah deskripsi mentah menjadi deskripsi produk yang rapi" />
              </div>
              <div className="md:col-span-2"><Label>Target Audiens</Label>
                <Input value={form.audience} onChange={(e) => update("audience", e.target.value)}
                  placeholder="contoh: UMKM, seller Shopee, seller Tokopedia, content creator" />
              </div>
              <div className="md:col-span-2"><Label>Target Harga (opsional)</Label>
                <Input value={form.target_price} onChange={(e) => update("target_price", e.target.value)}
                  placeholder="contoh: Rp 49.000–149.000" />
              </div>
            </div>

            <div>
              <Label>Deskripsi Singkat Produk</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => { update("description", e.target.value); setCorrected(null); setConfirmedDesc(null); }}
                placeholder="Tulis deskripsi singkat seperti yang biasa Anda tulis. Sistem akan merapikannya." />
              <div className="flex gap-2 mt-2">
                <Button variant="outline" type="button" onClick={handleCorrect} disabled={busy}>Rapikan Deskripsi Otomatis</Button>
                {confirmedDesc && <Badge variant="secondary">Deskripsi telah dikonfirmasi</Badge>}
              </div>

              {corrected && (
                <div className="mt-3 grid md:grid-cols-2 gap-3">
                  <Card><CardHeader><CardTitle className="text-sm">Deskripsi Awal</CardTitle></CardHeader>
                    <CardContent className="text-sm whitespace-pre-wrap">{form.description}</CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm">Deskripsi yang Dirapikan</CardTitle></CardHeader>
                    <CardContent className="text-sm">
                      {editingCorr ? (
                        <Textarea rows={5} value={editedCorr} onChange={(e) => setEditedCorr(e.target.value)} />
                      ) : (
                        <p className="whitespace-pre-wrap">{editedCorr}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {editingCorr ? (
                          <>
                            <Button size="sm" onClick={() => { setEditingCorr(false); setConfirmedDesc(editedCorr); toast.success("Edit disimpan & dikonfirmasi."); }}>Simpan Edit</Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditingCorr(false); setEditedCorr(corrected); }}>Batal</Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" onClick={() => setConfirmedDesc(editedCorr)}>Gunakan Deskripsi Ini</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingCorr(true)}>Edit Hasil</Button>
                            <Button size="sm" variant="ghost" onClick={handleCorrect}>Buat Ulang</Button>
                          </>
                        )}
                      </div>
                    </CardContent></Card>
                </div>
              )}
            </div>

            <div>
              <Label>Kata Kunci Produk — otomatis</Label>
              <Textarea rows={4} value={anchorsText} onChange={(e) => setAnchorsText(e.target.value)}
                placeholder="Satu kata kunci per baris. Klik Buat Otomatis untuk mengisi otomatis." />
              <div className="flex gap-2 mt-2">
                <Button variant="outline" type="button" onClick={handleAutoAnchors}>Buat Otomatis</Button>
                <span className="text-xs text-muted-foreground self-center">Jika kosong/&lt;3, akan diisi otomatis saat submit.</span>
              </div>
              {anchors.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {anchorsText.split(/\n+/).filter(Boolean).map((a, i) => <Badge key={i} variant="secondary">{a}</Badge>)}
                </div>
              )}
            </div>

            <div>
              <Label>Marketplace (manual upload, minimal 1)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                {MARKETPLACES.map((m) => (
                  <label key={m} className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted cursor-pointer">
                    <Checkbox checked={marketplaces.includes(m)} onCheckedChange={(v) => {
                      setMarketplaces((prev) => v ? [...prev, m] : prev.filter((x) => x !== m));
                    }} />
                    <span className="text-sm">{m}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Catatan: tidak ada integrasi API. Semua listing untuk upload manual.</p>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Kembali</Button>
              <Button onClick={() => setStep(3)} disabled={!canNextFromStep2}>Lanjut Review</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Review</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><b>Adapter:</b> {adapterLabel} <span className="text-muted-foreground">({adapter})</span></div>
            <div><b>Brand:</b> {form.brand}</div>
            <div><b>Bahasa / Market:</b> {form.language} • {form.target_market}</div>
            <div><b>Niche:</b> {form.niche}</div>
            <div><b>Audiens:</b> {form.audience}</div>
            <div><b>Tone / Jumlah Prompt / Lisensi:</b> {form.tone} • {form.prompt_count} • {form.license}</div>
            {form.target_price && <div><b>Target Harga:</b> {form.target_price}</div>}
            <div><b>Marketplace:</b> {marketplaces.join(", ")}</div>
            <div>
              <b>Deskripsi Final yang Dipakai:</b>
              <p className="mt-1 p-3 bg-muted rounded-md whitespace-pre-wrap">{confirmedDesc}</p>
            </div>
            <div>
              <b>Kata Kunci Produk:</b>
              <div className="flex flex-wrap gap-1 mt-1">
                {anchorsText.split(/\n+/).filter(Boolean).map((a, i) => <Badge key={i} variant="secondary">{a}</Badge>)}
                {anchorsText.split(/\n+/).filter(Boolean).length < 3 && (
                  <span className="text-xs text-muted-foreground self-center">Akan dilengkapi otomatis saat submit.</span>
                )}
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)}>Kembali</Button>
              <Button onClick={submit} disabled={busy}>{busy ? "Membuat..." : "Create Run"}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}