import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HelpCircle, LogOut } from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/runs/new", label: "Buat Run Baru" },
  { to: "/runs", label: "Run History" },
  { to: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const nav = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Prompt Product Factory</h1>
              <p className="text-xs text-muted-foreground">Internal Runner — Manual Upload Only</p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><HelpCircle className="w-4 h-4 mr-1" /> Cara Pakai</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Cara Pakai Singkat</DialogTitle>
                  </DialogHeader>
                  <ol className="text-sm space-y-1 list-decimal pl-5">
                    <li>Klik <b>Buat Run Baru</b>.</li>
                    <li>Pilih jenis produk.</li>
                    <li>Isi informasi produk. Klik <b>Rapikan Deskripsi Otomatis</b> lalu <b>Gunakan Deskripsi Ini</b>.</li>
                    <li>Klik <b>Buat Otomatis</b> untuk Kata Kunci Produk.</li>
                    <li>Pilih marketplace minimal satu, review, lalu Create Run.</li>
                    <li>Di halaman run: Generate Architecture → Approve → konfirmasi asumsi → Buat Manifest.</li>
                    <li>Klik <b>Generate Semua File</b>. Setelah QC pass, klik <b>Approve Final Package</b>.</li>
                  </ol>
                </DialogContent>
              </Dialog>
              {user && (
                <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav("/auth"); }}>
                  <LogOut className="w-4 h-4 mr-1" /> Keluar
                </Button>
              )}
            </div>
          </div>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}