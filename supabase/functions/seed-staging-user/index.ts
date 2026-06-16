import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key);
    const email = "bisnis@internal.local";
    const password = "Ai@belajar1";
    const { data: existing, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    const found = existing.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) {
      return new Response(JSON.stringify({ ok: true, created: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, created: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});