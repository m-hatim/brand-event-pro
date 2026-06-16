import { useEffect, useState } from "react";
import { AppShell } from "@/components/runner/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSettings, updateSettings } from "@/lib/runner/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Settings() {
  const [s, setS] = useState<any>(null);
  const [newPw, setNewPw] = useState("");
  useEffect(() => { getSettings().then(setS).catch((e) => toast.error(e.message)); }, []);

  const save = async (patch: any) => {
    const updated = await updateSettings(patch);
    setS(updated);
    toast.success("Settings tersimpan.");
  };

  const changePw = async () => {
    if (newPw.length < 8) return toast.error("Password minimal 8 karakter.");
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) return toast.error(error.message);
    toast.success("Password diperbarui.");
    setNewPw("");
  };

  if (!s) return <AppShell><p>Memuat…</p></AppShell>;

  return (
    <AppShell>
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <div className="space-y-4 max-w-2xl">
        <Card><CardHeader><CardTitle>Default Generation Mode</CardTitle></CardHeader><CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Upload Manual Saja</div>
              <div className="text-xs text-muted-foreground">Mapping internal: MANUAL_UPLOAD_ONLY</div>
            </div>
            <Badge>Aktif</Badge>
          </div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>API Mode — Pengembangan Lanjutan</CardTitle></CardHeader><CardContent>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>API Mode</Label>
              <p className="text-xs text-muted-foreground">OFF by default. Modul API_* tidak akan pernah digenerate di mode manual.</p>
            </div>
            <Switch checked={s.api_mode_enabled} onCheckedChange={(v) => save({ api_mode_enabled: v })} />
          </div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Low Model Mode</CardTitle></CardHeader><CardContent>
          <div className="flex items-center justify-between"><Label>Low Model Mode</Label>
            <Switch checked={s.low_model_mode} onCheckedChange={(v) => save({ low_model_mode: v })} /></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Redacted Logs</CardTitle></CardHeader><CardContent>
          <div className="flex items-center justify-between"><Label>Redacted Logs</Label>
            <Switch checked={s.redacted_logs_enabled} onCheckedChange={(v) => save({ redacted_logs_enabled: v })} /></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Output Language Default</CardTitle></CardHeader><CardContent>
          <Input value={s.output_language_default} onChange={(e) => setS({ ...s, output_language_default: e.target.value })}
            onBlur={() => save({ output_language_default: s.output_language_default })} />
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Change Password</CardTitle></CardHeader><CardContent>
          <div className="flex gap-2">
            <Input type="password" placeholder="Password baru" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <Button onClick={changePw}>Update</Button>
          </div>
        </CardContent></Card>
      </div>
    </AppShell>
  );
}