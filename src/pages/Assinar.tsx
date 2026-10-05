import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, CircleCheckBig, Copy, CreditCard, Loader2, QrCode, TriangleAlert, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoBadge } from "@/components/EstadoBadge";
import { QrFalso } from "@/components/QrFalso";
import {
  criarCobranca, expirarVencidas, getUsuario, pagarNoProvedor, receberWebhook,
  recusarCartao, type UsuarioVista,
} from "@/lib/api";
import { MINUTOS_PIX, PLANOS, brl, plano, type Cobranca, type Metodo } from "@/lib/tipos";
import NaoEncontrada from "@/pages/NaoEncontrada";

function Relogio({ expiraEm }: { expiraEm: string }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.round((new Date(expiraEm).getTime() - agora) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span data-teste="relogio" data-segundos={s}
      className={`font-mono tabular-nums ${s <= 60 ? "font-bold text-alerta" : "text-muted-foreground"}`}>
      {mm}:{ss}
    </span>
  );
}

export default function Assinar() {
  const { usuarioId = "" } = useParams();
  const [v, setV] = useState<UsuarioVista | null | "carregando">("carregando");
  const [planoId, setPlanoId] = useState("mensal");
  const [metodo, setMetodo] = useState<Metodo>("pix");
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [duplo, setDuplo] = useState<string | null>(null);
  const chave = useRef(`${usuarioId}-${Date.now()}`);

  const puxar = async () => { await expirarVencidas(); const r = await getUsuario(usuarioId); setV(r); return r; };

  /** Cobrança que ainda está viva: pendente, ou paga no provedor e não liberada aqui. */
  const emAberto = (r: UsuarioVista | null) =>
    r?.cobrancas.find((c) => c.estado === "pendente" || (c.pagoNoPsp && c.estado !== "paga" && c.estado !== "estornada")) ?? null;

  useEffect(() => {
    let vivo = true;
    getUsuario(usuarioId).then((r) => {
      if (!vivo) return;
      setV(r);
      // quem já tem Pix em aberto não pode cair num formulário em branco e gerar o segundo
      const aberta = emAberto(r);
      if (aberta) setCobranca(aberta);
    });
    const t = setInterval(async () => { await expirarVencidas(); const r = await getUsuario(usuarioId); if (vivo) setV(r); }, 5000);
    return () => { vivo = false; clearInterval(t); };
  }, [usuarioId]);

  if (v === "carregando") return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-80 w-full" /></div>;
  if (!v) return <NaoEncontrada />;

  const p = plano(planoId);
  const atual = cobranca ? v.cobrancas.find((c) => c.id === cobranca.id) ?? cobranca : null;

  const correr = async (k: string, fn: () => Promise<unknown>, ok?: string) => {
    setOcupado(k);
    try { await fn(); await puxar(); if (ok) toast.success(ok); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não deu certo"); await puxar(); }
    finally { setOcupado(null); }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link to="/" className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Voltar aos assinantes
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {v.premium ? "Renovar Premium" : "Assinar Premium"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {v.usuario.nome}
          {v.premium && v.usuario.premiumAte &&
            ` · hoje vale até ${new Date(v.usuario.premiumAte).toLocaleDateString("pt-BR")}`}
        </p>
      </div>

      {duplo && (
        <p className="rounded-lg border border-pago/30 bg-pago/5 p-3 text-sm" data-teste="resultado-duplo">
          {duplo}
        </p>
      )}

      {!atual ? (
        <Card><CardContent className="space-y-5 p-5">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Plano</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PLANOS.map((x) => (
                <button key={x.id} type="button" data-teste={`plano-${x.id}`}
                  onClick={() => setPlanoId(x.id)}
                  className={`rounded-lg border p-4 text-left ${planoId === x.id ? "border-primary bg-accent" : "hover:bg-secondary"}`}>
                  <span className="block font-semibold">{x.nome}</span>
                  <span className="block font-mono text-xl font-bold">{brl(x.precoCentavos)}</span>
                  {x.destaque && <span className="mt-1 inline-block rounded bg-pago/10 px-1.5 py-0.5 text-xs text-pago">{x.destaque}</span>}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Como pagar</legend>
            <div className="flex gap-2">
              {(["pix", "cartao"] as const).map((m) => (
                <Button key={m} type="button" variant={metodo === m ? "default" : "outline"} className="h-11 flex-1 gap-2"
                  data-teste={`metodo-${m}`} onClick={() => setMetodo(m)}>
                  {m === "pix" ? <QrCode className="size-4" aria-hidden /> : <CreditCard className="size-4" aria-hidden />}
                  {m === "pix" ? "Pix" : "Cartão"}
                </Button>
              ))}
            </div>
          </fieldset>

          <Button className="h-12 w-full" disabled={!!ocupado} data-teste="gerar"
            onClick={() => correr("gerar", async () => {
              const c = await criarCobranca(usuarioId, planoId, metodo, chave.current);
              setCobranca(c);
            })}>
            {ocupado === "gerar" && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {metodo === "pix" ? `Gerar Pix de ${brl(p.precoCentavos)}` : `Pagar ${brl(p.precoCentavos)} no cartão`}
          </Button>

          <div className="rounded-lg border border-dashed p-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Dois toques no botão não podem virar duas cobranças. A chave de idempotência é o que impede.
            </p>
            <Button variant="outline" size="sm" className="h-10 gap-2" disabled={!!ocupado} data-teste="duplo-toque"
              onClick={async () => {
                setOcupado("duplo");
                const k = `duplo-${Date.now()}`;
                const [a, b] = await Promise.all([
                  criarCobranca(usuarioId, planoId, metodo, k),
                  criarCobranca(usuarioId, planoId, metodo, k),
                ]);
                setDuplo(a.id === b.id
                  ? `Os dois toques devolveram a mesma cobrança: ${a.id}`
                  : `Criou duas cobranças: ${a.id} e ${b.id}`);
                setCobranca(a);
                setOcupado(null);
                await puxar();
              }}>
              <Zap className="size-4" aria-hidden /> Tocar duas vezes ao mesmo tempo
            </Button>
          </div>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <EstadoBadge estado={atual.estado} />
            <span className="font-mono text-xl font-bold">{brl(atual.valorCentavos)}</span>
            <span className="text-sm text-muted-foreground">{plano(atual.planoId).nome}</span>
            {atual.estado === "pendente" && atual.expiraEm && (
              <span className="ml-auto text-sm">vence em <Relogio expiraEm={atual.expiraEm} /></span>
            )}
          </div>

          {atual.estado === "paga" && (
            <div className="rounded-lg border border-pago/30 bg-pago/5 p-4" data-teste="liberado">
              <p className="flex items-center gap-2 font-medium text-pago">
                <CircleCheckBig className="size-5" aria-hidden /> Premium liberado
              </p>
              <p className="mt-1 text-sm">
                Vale até {new Date((v.usuario.premiumAte ?? ""))?.toLocaleDateString("pt-BR")}.
                {atual.conciliadaEm
                  ? " Quem liberou foi a conciliação, não o webhook."
                  : " Liberado pelo webhook do provedor."}
              </p>
            </div>
          )}

          {atual.estado === "pendente" && atual.metodo === "pix" && atual.copiaECola && (
            <div className="space-y-3">
              <div className="flex justify-center"><QrFalso semente={atual.copiaECola} /></div>
              <p className="text-center text-xs text-muted-foreground">
                QR de demonstração, não escaneável. O código vale {MINUTOS_PIX} minutos.
              </p>
              <div className="flex gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-3 py-2.5 font-mono text-xs"
                  data-teste="copia-e-cola">{atual.copiaECola}</code>
                <Button variant="outline" size="icon" className="size-11" aria-label="Copiar código"
                  onClick={() => { navigator.clipboard?.writeText(atual.copiaECola!); toast.success("Código copiado"); }}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {atual.estado === "expirada" && (
            <p className="rounded-md border border-vencido/30 bg-vencido/5 p-3 text-sm" data-teste="expirada">
              O código venceu. Em produção o cliente gera outro; um código vencido não libera
              nada, nem se o webhook chegar depois.
            </p>
          )}

          {atual.estado === "pendente" && (
            <div className="space-y-2 rounded-lg border border-dashed p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Simular o que o provedor faria
              </p>
              {atual.metodo === "pix" ? (
                atual.pagoNoPsp ? (
                  // já pagou lá fora: o que falta é a notificação, não o pagamento
                  <Button className="h-11 w-full" disabled={!!ocupado} data-teste="pagar-com-webhook"
                    onClick={() => correr("pw", () => pagarNoProvedor(atual.id, true), "Webhook chegou e o Premium saiu")}>
                    O provedor reenvia o webhook
                  </Button>
                ) : (
                <>
                  <Button className="h-11 w-full" disabled={!!ocupado} data-teste="pagar-com-webhook"
                    onClick={() => correr("pw", () => pagarNoProvedor(atual.id, true), "Pago e liberado")}>
                    Cliente paga e o webhook chega
                  </Button>
                  <Button variant="outline" className="h-11 w-full gap-2" disabled={!!ocupado} data-teste="pagar-sem-webhook"
                    onClick={() => correr("ps", () => pagarNoProvedor(atual.id, false), "Pagou. O webhook não chegou.")}>
                    <TriangleAlert className="size-4" aria-hidden /> Cliente paga e o webhook se perde
                  </Button>
                </>
                )
              ) : (
                <>
                  <Button className="h-11 w-full" disabled={!!ocupado} data-teste="aprovar-cartao"
                    onClick={() => correr("ac", () => pagarNoProvedor(atual.id, true), "Cartão aprovado")}>
                    Cartão aprovado
                  </Button>
                  <Button variant="outline" className="h-11 w-full" disabled={!!ocupado} data-teste="recusar-cartao"
                    onClick={() => correr("rc", () => recusarCartao(atual.id), "Cartão recusado")}>
                    Cartão recusado
                  </Button>
                </>
              )}
            </div>
          )}

          {atual.estado === "paga" && (
            <Button variant="outline" className="h-11 w-full" disabled={!!ocupado} data-teste="webhook-repetido"
              onClick={() => correr("wr", async () => {
                const r = await receberWebhook(atual.pspId);
                toast[r.aplicado ? "success" : "error"](r.motivo ?? "Aplicado");
              })}>
              Reenviar o mesmo webhook
            </Button>
          )}

          {atual.pagoNoPsp && atual.estado !== "paga" && atual.estado !== "estornada" && (
            <p className="rounded-md border border-alerta/30 bg-alerta/5 p-3 text-sm text-alerta" data-teste="pendurado">
              O dinheiro entrou no provedor e o Premium não foi liberado. Em produção ninguém
              vê isso aqui: quem acha é a conciliação, na tela de assinantes.
            </p>
          )}

          <Link to="/" className={`${buttonVariants({ variant: "outline" })} h-11 w-full`}>
            Voltar aos assinantes
          </Link>
        </CardContent></Card>
      )}
    </div>
  );
}
