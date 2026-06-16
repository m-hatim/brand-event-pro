import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/runner/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listRuns } from "@/lib/runner/api";
import { statusLabel } from "@/lib/runner/types";

export default function RunHistory() {
  const [runs, setRuns] = useState<any[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { listRuns().then(setRuns).catch(() => setRuns([])); }, []);
  const filtered = runs.filter((r) =>
    !q || r.run_request_id.toLowerCase().includes(q.toLowerCase()) || r.adapter.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <AppShell>
      <h2 className="text-2xl font-bold mb-4">Run History</h2>
      <Input placeholder="Cari run id atau adapter…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
      <Card><CardContent className="p-0">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Belum ada run.</p>
        ) : (
          <div className="divide-y">
            {filtered.map((r) => (
              <Link key={r.id} to={`/runs/${r.id}`} className="flex items-center justify-between p-4 hover:bg-muted">
                <div>
                  <div className="font-mono text-xs">{r.run_request_id}</div>
                  <div className="text-sm">{r.adapter} • {(r.marketplaces ?? []).join(", ") || "—"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <Badge variant="outline">{statusLabel(r.status)}</Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent></Card>
    </AppShell>
  );
}