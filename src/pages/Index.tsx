import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/runner/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listRuns } from "@/lib/runner/api";
import { statusLabel } from "@/lib/runner/types";

export default function Dashboard() {
  const [runs, setRuns] = useState<any[]>([]);
  useEffect(() => { listRuns().then(setRuns).catch(() => setRuns([])); }, []);
  const recent = runs.slice(0, 5);
  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Ringkasan run produksi internal Anda.</p>
        </div>
        <Button asChild><Link to="/runs/new">+ Buat Run Baru</Link></Button>
      </div>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card><CardHeader><CardTitle className="text-sm">Total Run</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{runs.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Disetujui</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{runs.filter(r => r.status === "PASS_FINAL").length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Dalam Proses</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{runs.filter(r => !["PASS_FINAL","STOPPED"].includes(r.status)).length}</CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Run Terbaru</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada run. Klik Buat Run Baru untuk memulai.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((r) => (
                <Link key={r.id} to={`/runs/${r.id}`} className="flex items-center justify-between p-3 rounded-md hover:bg-muted">
                  <div>
                    <div className="font-mono text-xs">{r.run_request_id}</div>
                    <div className="text-sm text-muted-foreground">{r.adapter} • {(r.marketplaces ?? []).join(", ") || "—"}</div>
                  </div>
                  <Badge variant="outline">{statusLabel(r.status)}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}