/**
 * API simulada do pagamento. A aplicação fala com estas funções como se fosse
 * um cliente HTTP; em produção é o backend do app.
 *
 * As regras que importam vivem aqui, não na tela: a chave de idempotência
 * impede cobrança dobrada, um QR vencido não vira pago, e o webhook repetido
 * não estende o Premium duas vezes.
 */
import { copiaECola, gerar, type Dados } from "./seed";
import {
  MINUTOS_PIX, novaValidade, plano, temPremium,
  type Cobranca, type EstadoCobranca, type Metodo, type Usuario,
} from "./tipos";

const K = "premium:dados:v1";
const espera = (ms?: number) => new Promise((r) => setTimeout(r, ms ?? 200 + Math.random() * 350));

function ler(): Dados {
  try {
    const c = localStorage.getItem(K);
    if (c) { const d = JSON.parse(c) as Dados; if (d?.usuarios?.length) return d; }
  } catch { /* modo privado */ }
  const novo = gerar();
  grabar(novo);
  return novo;
}
function grabar(d: Dados) { try { localStorage.setItem(K, JSON.stringify(d)); } catch { /* ignora */ } }

export class CobrancaExpiradaError extends Error {
  constructor() { super("Este código Pix venceu. Gere um novo para pagar."); }
}
export class EstadoInvalidoError extends Error {}

export interface UsuarioVista {
  usuario: Usuario;
  premium: boolean;
  cobrancas: Cobranca[];
  /** Pagou, o dinheiro está no provedor, e o nosso lado nunca soube. */
  pagouSemLiberar: boolean;
}

function vista(d: Dados, u: Usuario): UsuarioVista {
  const cs = d.cobrancas.filter((c) => c.usuarioId === u.id)
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  return {
    usuario: u, premium: temPremium(u), cobrancas: cs,
    pagouSemLiberar: cs.some((c) => c.pagoNoPsp && c.estado !== "paga" && c.estado !== "estornada"),
  };
}

export async function getUsuarios(): Promise<UsuarioVista[]> {
  await espera();
  const d = ler();
  return d.usuarios.map((u) => vista(d, u));
}

export async function getUsuario(id: string): Promise<UsuarioVista | null> {
  await espera();
  const d = ler();
  const u = d.usuarios.find((x) => x.id === id);
  return u ? vista(d, u) : null;
}

/** Marca como expiradas as cobranças Pix cujo prazo passou. */
export async function expirarVencidas(): Promise<number> {
  const d = ler();
  const agora = Date.now();
  let n = 0;
  d.cobrancas.filter((c) => c.estado === "pendente" && c.expiraEm && agora > new Date(c.expiraEm).getTime())
    .forEach((c) => { c.estado = "expirada"; n += 1; });
  if (n > 0) grabar(d);
  return n;
}

/**
 * Cria a cobrança. A mesma chave de idempotência devolve sempre a mesma
 * cobrança: é o que impede dois toques no botão virarem duas cobranças.
 */
export async function criarCobranca(
  usuarioId: string, planoId: string, metodo: Metodo, chaveIdempotencia: string,
): Promise<Cobranca> {
  await espera();
  const d = ler();
  const existente = d.cobrancas.find((c) => c.chaveIdempotencia === chaveIdempotencia);
  if (existente) return existente;

  const p = plano(planoId);
  const agora = Date.now();
  const pspId = `psp_${agora.toString(36)}`;
  const c: Cobranca = {
    id: `cb${agora.toString(36)}`, usuarioId, planoId, metodo,
    valorCentavos: p.precoCentavos, estado: "pendente",
    chaveIdempotencia, pspId,
    copiaECola: metodo === "pix" ? copiaECola(pspId, p.precoCentavos) : null,
    criadaEm: new Date(agora).toISOString(),
    expiraEm: metodo === "pix" ? new Date(agora + MINUTOS_PIX * 60000).toISOString() : null,
    confirmadaEm: null, webhookEm: null, conciliadaEm: null, pagoNoPsp: false,
  };
  d.cobrancas.push(c);
  grabar(d);
  return c;
}

/** Só para a demonstração: o cliente pagou de verdade, do lado do provedor. */
export async function pagarNoProvedor(cobrancaId: string, comWebhook: boolean): Promise<void> {
  await espera(300);
  const d = ler();
  const c = d.cobrancas.find((x) => x.id === cobrancaId);
  if (!c) throw new Error("Cobrança não encontrada.");
  if (c.estado === "expirada") throw new CobrancaExpiradaError();
  c.pagoNoPsp = true;
  grabar(d);
  if (comWebhook) await receberWebhook(c.pspId);
}

function liberar(d: Dados, c: Cobranca, via: "webhook" | "conciliacao") {
  const u = d.usuarios.find((x) => x.id === c.usuarioId)!;
  const p = plano(c.planoId);
  c.estado = "paga";
  c.confirmadaEm = new Date().toISOString();
  if (via === "webhook") c.webhookEm = c.confirmadaEm;
  else c.conciliadaEm = c.confirmadaEm;
  u.premiumAte = novaValidade(u.premiumAte, p.periodoDias);
}

/**
 * Chamada do provedor avisando que pagou. Chega duas vezes com frequência,
 * então tem de ser idempotente: a segunda não pode estender o Premium de novo.
 */
export async function receberWebhook(pspId: string): Promise<{ aplicado: boolean; motivo?: string }> {
  await espera(250);
  const d = ler();
  const c = d.cobrancas.find((x) => x.pspId === pspId);
  if (!c) return { aplicado: false, motivo: "Cobrança desconhecida." };
  if (c.estado === "paga") {
    // já liberado: registra que chegou de novo e não mexe na validade
    c.webhookEm = c.webhookEm ?? new Date().toISOString();
    grabar(d);
    return { aplicado: false, motivo: "Já estava paga. Webhook repetido não libera de novo." };
  }
  if (c.estado === "expirada") { grabar(d); return { aplicado: false, motivo: "O código já tinha vencido." }; }
  if (c.estado === "estornada") { grabar(d); return { aplicado: false, motivo: "Cobrança estornada." }; }

  liberar(d, c, "webhook");
  grabar(d);
  return { aplicado: true };
}

export interface ResultadoConciliacao { verificadas: number; liberadas: Cobranca[] }

/**
 * Pergunta ao provedor o que ele sabe sobre as cobranças que para nós ainda
 * estão pendentes. É o que recupera o dinheiro que entrou sem o webhook chegar.
 */
export async function conciliar(): Promise<ResultadoConciliacao> {
  await espera(700);
  const d = ler();
  const candidatas = d.cobrancas.filter((c) => c.estado === "pendente" || c.estado === "expirada");
  const liberadas: Cobranca[] = [];
  for (const c of candidatas) {
    if (!c.pagoNoPsp) continue;          // o provedor não tem pagamento para esta
    liberar(d, c, "conciliacao");
    liberadas.push(c);
  }
  grabar(d);
  return { verificadas: candidatas.length, liberadas };
}

export async function estornar(cobrancaId: string): Promise<Cobranca> {
  await espera();
  const d = ler();
  const c = d.cobrancas.find((x) => x.id === cobrancaId);
  if (!c) throw new Error("Cobrança não encontrada.");
  if (c.estado !== "paga") throw new EstadoInvalidoError("Só dá para estornar uma cobrança paga.");
  const u = d.usuarios.find((x) => x.id === c.usuarioId)!;
  const p = plano(c.planoId);
  c.estado = "estornada";
  // devolve os dias que esta cobrança tinha dado
  if (u.premiumAte) {
    const novo = new Date(u.premiumAte).getTime() - p.periodoDias * 86400000;
    u.premiumAte = novo > Date.now() ? new Date(novo).toISOString() : null;
  }
  grabar(d);
  return c;
}

export async function recusarCartao(cobrancaId: string): Promise<Cobranca> {
  await espera();
  const d = ler();
  const c = d.cobrancas.find((x) => x.id === cobrancaId);
  if (!c) throw new Error("Cobrança não encontrada.");
  if (c.estado !== "pendente") throw new EstadoInvalidoError("Esta cobrança não está mais pendente.");
  c.estado = "falhou";
  grabar(d);
  return c;
}

export interface Resumo {
  assinantes: number;
  pendentes: number;
  pagouSemLiberar: number;
  receitaCentavos: number;
  porEstado: Record<EstadoCobranca, number>;
}

export async function getResumo(): Promise<Resumo> {
  await espera();
  const d = ler();
  const porEstado = { pendente: 0, paga: 0, expirada: 0, falhou: 0, estornada: 0 } as Record<EstadoCobranca, number>;
  d.cobrancas.forEach((c) => { porEstado[c.estado] += 1; });
  return {
    assinantes: d.usuarios.filter((u) => temPremium(u)).length,
    pendentes: porEstado.pendente,
    pagouSemLiberar: d.cobrancas.filter((c) => c.pagoNoPsp && c.estado !== "paga" && c.estado !== "estornada").length,
    receitaCentavos: d.cobrancas.filter((c) => c.estado === "paga").reduce((s, c) => s + c.valorCentavos, 0),
    porEstado,
  };
}

export async function restaurarDados() {
  await espera();
  try { localStorage.removeItem(K); } catch { /* ignora */ }
  ler();
}
