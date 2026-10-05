import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Loader2, RefreshCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoBadge } from "@/components/EstadoBadge";
import { conciliar, expirarVencidas, getResumo, getUsuarios, type Resumo, type UsuarioVista } from "@/lib/api";
import { brl, plano } from "@/lib/tipos";

export default function Assinantes() {
  const [us, setUs] = useState<UsuarioVista[] | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [conciliando, setConciliando] = useState(false);

  const puxar = async () => {
    await expirarVencidas();
    const [u, r] = await Promise.all([getUsuarios(), getResumo()]);
    setUs(u); setResumo(r);
  };
  useEffect(() => { let v = true; puxar().then(() => { if (!v) setUs(null); }); return () => { v = false; }; }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assinantes</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite" data-teste="total">
          {us === null ? "Carregando..." : `${us.length} usuários · ${resumo?.assinantes ?? 0} com Premium ativo`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { r: "Premium ativo", v: resumo?.assinantes, c: "text-pago" },
          { r: "Aguardando pagamento", v: resumo?.pendentes, c: "text-pendente" },
          { r: "Pagou e não liberou", v: resumo?.pagouSemLiberar, c: "text-alerta" },
          { r: "Receita confirmada", v: resumo ? brl(resumo.receitaCentavos) : undefined, c: "text-foreground" },
        ].map((k) => (
          <Card key={k.r} data-teste={`kpi-${k.r}`}><CardContent className="p-4">
            {k.v === undefined ? <Skeleton className="h-8 w-16" />
              : <p className={`text-2xl font-bold tracking-tight ${k.c}`}>{k.v}</p>}
            <p className="mt-0.5 text-sm text-muted-foreground">{k.r}</p>
          </CardContent></Card>
        ))}
      </div>

      {resumo && resumo.pagouSemLiberar > 0 && (
        <div data-teste="alerta-conciliacao"
          className="rounded-lg border border-alerta/30 bg-alerta/5 p-4">
          <p className="flex items-start gap-2 text-sm text-alerta">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {resumo.pagouSemLiberar === 1
                ? "Uma pessoa pagou e continua sem Premium: o dinheiro está no provedor e a notificação nunca chegou aqui."
                : `${resumo.pagouSemLiberar} pessoas pagaram e continuam sem Premium: o dinheiro está no provedor e a notificação nunca chegou aqui.`}
            </span>
          </p>
          <Button className="mt-3 h-11 gap-2" disabled={conciliando} data-teste="conciliar"
            onClick={async () => {
              setConciliando(true);
              try {
                const r = await conciliar();
                toast.success(r.liberadas.length === 0
                  ? "Nada a liberar: o provedor não tem pagamento pendente"
                  : `${r.liberadas.length} liberado após consultar ${r.verificadas} cobranças`);
                await puxar();
              } finally { setConciliando(false); }
            }}>
            {conciliando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCcw className="size-4" aria-hidden />}
            Consultar o provedor e conciliar
          </Button>
        </div>
      )}

      {us === null ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <ul className="space-y-2">
          {us.map((v) => (
            <li key={v.usuario.id} data-teste={`usuario-${v.usuario.id}`} data-premium={v.premium ? "si" : "no"}
              data-pendurado={v.pagouSemLiberar ? "si" : "no"}
              className={`rounded-lg border bg-card p-4 ${v.pagouSemLiberar ? "border-alerta/40" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    {v.usuario.nome}
                    {v.premium && <Crown className="size-4 text-primary" aria-hidden />}
                  </span>
                  <span className="block text-xs text-muted-foreground">{v.usuario.email}</span>
                </span>
                <span className="text-sm">
                  {v.premium
                    ? <span className="text-pago" data-teste="ate">Premium até {new Date(v.usuario.premiumAte!).toLocaleDateString("pt-BR")}</span>
                    : v.usuario.premiumAte
                      ? <span className="text-muted-foreground" data-teste="venceu">Premium venceu em {new Date(v.usuario.premiumAte).toLocaleDateString("pt-BR")}</span>
                      : <span className="text-muted-foreground">nunca assinou</span>}
                </span>
                <Link to={`/assinar/${v.usuario.id}`} className={`${buttonVariants({ variant: "outline" })} h-10`}
                  data-teste="assinar">
                  {v.premium ? "Renovar" : "Assinar"}
                </Link>
              </div>

              {v.pagouSemLiberar && (
                <p className="mt-2 text-sm text-alerta" data-teste="pendurado">
                  Pagou e não liberou. O dinheiro está no provedor.
                </p>
              )}

              {v.cobrancas.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {v.cobrancas.slice(0, 3).map((c) => (
                    <li key={c.id} data-teste={`cobranca-${c.id}`} data-estado={c.estado}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <EstadoBadge estado={c.estado} />
                      <span>{plano(c.planoId).nome}</span>
                      <span className="font-mono">{brl(c.valorCentavos)}</span>
                      <span>{c.metodo === "pix" ? "Pix" : "cartão"}</span>
                      {c.conciliadaEm && <span className="text-pix">liberado pela conciliação</span>}
                      {c.webhookEm && !c.conciliadaEm && <span>liberado pelo webhook</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
