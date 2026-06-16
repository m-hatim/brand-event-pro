import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const STAGING_EMAIL = "bisnis@internal.local";

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState(STAGING_EMAIL);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate("/", { replace: true }); }, [user, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    let { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error && email === STAGING_EMAIL) {
      try { await supabase.functions.invoke("seed-staging-user"); } catch {}
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Berhasil masuk.");
    navigate("/", { replace: true });
  }

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Prompt Product Factory</CardTitle>
          <CardDescription>Internal Runner — Manual Upload Only</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Masuk..." : "Masuk"}</Button>
          </form>
          <div className="mt-4 p-3 rounded-md bg-muted text-xs">
            <p className="font-medium mb-1">Kredensial staging awal:</p>
            <p>Email: <code>bisnis@internal.local</code></p>
            <p>Password: <code>Ai@belajar1</code></p>
            <p className="mt-1 text-muted-foreground">Ubah password di Settings setelah login pertama.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}