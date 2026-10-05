export type Metodo = "pix" | "cartao";
export type EstadoCobranca = "pendente" | "paga" | "expirada" | "falhou" | "estornada";

export interface Plano {
  id: string;
  nome: string;
  periodoDias: number;
  precoCentavos: number;
  destaque?: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  /** Até quando o Premium vale. null = nunca assinou ou já venceu. */
  premiumAte: string | null;
}

export interface Cobranca {
  id: string;
  usuarioId: string;
  planoId: string;
  metodo: Metodo;
  valorCentavos: number;
  estado: EstadoCobranca;
  /** Impede que dois toques no botão virem duas cobranças. */
  chaveIdempotencia: string;
  /** Identificador do lado do provedor de pagamento. */
  pspId: string;
  /** Pix: o código copia-e-cola. Cartão: null. */
  copiaECola: string | null;
  criadaEm: string;
  expiraEm: string | null;
  confirmadaEm: string | null;
  /** Quando o webhook do PSP chegou. Null com pagamento feito = notificação perdida. */
  webhookEm: string | null;
  /** Achada pela conciliação, não pelo webhook. */
  conciliadaEm: string | null;
  /**
   * Só para a demonstração: o que o PSP sabe, independentemente do que
   * o nosso lado ouviu. É isso que a conciliação vai consultar.
   */
  pagoNoPsp: boolean;
}

export const PLANOS: Plano[] = [
  { id: "mensal", nome: "Premium mensal", periodoDias: 30, precoCentavos: 1990 },
  { id: "anual", nome: "Premium anual", periodoDias: 365, precoCentavos: 19900, destaque: "2 meses grátis" },
];

/** O QR do Pix tem validade. Depois disso o código não serve mais. */
export const MINUTOS_PIX = 30;

export const ESTADO_ROTULO: Record<EstadoCobranca, string> = {
  pendente: "Aguardando pagamento",
  paga: "Paga",
  expirada: "Expirada",
  falhou: "Recusada",
  estornada: "Estornada",
};

export const METODO_ROTULO: Record<Metodo, string> = { pix: "Pix", cartao: "Cartão" };

export const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");

export const plano = (id: string) => PLANOS.find((p) => p.id === id)!;

/** Premium vale enquanto a data não passou. */
export const temPremium = (u: Usuario, agora = Date.now()) =>
  Boolean(u.premiumAte && new Date(u.premiumAte).getTime() > agora);

/**
 * Nova validade ao confirmar um pagamento: soma o período ao que ainda resta,
 * para que renovar antes do fim não jogue dias fora.
 */
export function novaValidade(atual: string | null, periodoDias: number, agora = Date.now()): string {
  const base = atual && new Date(atual).getTime() > agora ? new Date(atual).getTime() : agora;
  return new Date(base + periodoDias * 86400000).toISOString();
}
