import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { CreditCard, Menu, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { restaurarDados } from "@/lib/api";

const NAV = [
  { to: "/", rotulo: "Assinantes", icone: Users, exato: true },
  { to: "/cobrancas", rotulo: "Cobranças", icone: CreditCard, exato: false },
];

function Nav({ aoNavegar }: { aoNavegar?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.exato} onClick={aoNavegar}
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm font-medium ${
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
          <n.icone className="size-4" aria-hidden />
          {n.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}

export function Layout() {
  const [menu, setMenu] = useState(false);
  const navegar = useNavigate();

  const Restaurar = (
    <AlertDialog>
      <AlertDialogTrigger className={`${buttonVariants({ variant: "outline" })} h-11 w-full gap-2`}>
        <RotateCcw className="size-4" aria-hidden /> Restaurar dados
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restaurar a demonstração?</AlertDialogTitle>
          <AlertDialogDescription>
            As cobranças e liberações feitas aqui somem, e voltam os cinco usuários de exemplo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={async () => { await restaurarDados(); toast.success("Dados restaurados"); navegar(0); }}>
            Restaurar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-card p-4 lg:flex">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
            <CreditCard className="size-5" />
          </span>
          <span className="leading-tight font-bold">Premium</span>
        </Link>
        <Nav />
        <div className="mt-auto pt-4">{Restaurar}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
          <Sheet open={menu} onOpenChange={setMenu}>
            <SheetTrigger className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Abrir menu">
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col">
              <SheetHeader><SheetTitle>Premium</SheetTitle></SheetHeader>
              <div className="flex flex-1 flex-col px-4"><Nav aoNavegar={() => setMenu(false)} />
                <div className="mt-auto pt-4">{Restaurar}</div></div>
            </SheetContent>
          </Sheet>
          <span className="font-bold">Premium</span>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6"><Outlet /></main>

        <footer className="border-t px-4 py-5 text-xs leading-relaxed text-muted-foreground sm:px-6">
          Demonstração do fluxo de pagamento do Premium, para avaliação. Os usuários, as
          cobranças e os códigos são inventados; o QR não é escaneável e nenhum dinheiro
          se move. Os botões de "simular" existem só aqui, para mostrar o que o provedor
          de pagamento faria. Justin Gnoh · outubro de 2026
        </footer>
      </div>
    </div>
  );
}
