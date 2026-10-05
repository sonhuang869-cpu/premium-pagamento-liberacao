import { MINUTOS_PIX, plano, type Cobranca, type Usuario } from "./tipos";

function semente(n: number) {
  let a = (n * 0x9e3779b1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Código copia-e-cola no formato do BR Code. Chave e CRC são de mentira. */
export function copiaECola(pspId: string, valorCentavos: number): string {
  const valor = (valorCentavos / 100).toFixed(2);
  const campo = (id: string, v: string) => `${id}${String(v.length).padStart(2, "0")}${v}`;
  const merchant = campo("00", "BR.GOV.BCB.PIX") + campo("01", `demo-${pspId}@exemplo.com.br`);
  return [
    campo("00", "01"),
    campo("26", merchant),
    campo("52", "0000"),
    campo("53", "986"),
    campo("54", valor),
    campo("58", "BR"),
    campo("59", "APP DEMONSTRACAO"),
    campo("60", "SAO PAULO"),
    campo("62", campo("05", pspId.toUpperCase())),
    "6304",
  ].join("") + pspId.slice(-4).toUpperCase();
}

export const USUARIOS: Usuario[] = [
  { id: "u1", nome: "Camila Rezende", email: "camila@exemplo.com", premiumAte: null },
  { id: "u2", nome: "Anderson Paiva", email: "anderson@exemplo.com", premiumAte: null },
  { id: "u3", nome: "Juliana Braz", email: "juliana@exemplo.com", premiumAte: null },
  { id: "u4", nome: "Wesley Tomás", email: "wesley@exemplo.com", premiumAte: null },
  { id: "u5", nome: "Larissa Pontes", email: "larissa@exemplo.com", premiumAte: null },
];

export interface Dados { usuarios: Usuario[]; cobrancas: Cobranca[] }

export function gerar(): Dados {
  const agora = Date.now();
  const MIN = 60000, DIA = 86400000;
  const usuarios = USUARIOS.map((u) => ({ ...u }));
  const cobrancas: Cobranca[] = [];
  let n = 0;

  const criar = (o: Partial<Cobranca> & { usuarioId: string; planoId: string; metodo: Cobranca["metodo"] }) => {
    n += 1;
    const r = semente(n);
    const p = plano(o.planoId);
    const pspId = `psp_${Math.floor(r() * 1e9).toString(36)}`;
    const c: Cobranca = {
      id: `cb${n}`, valorCentavos: p.precoCentavos, estado: "pendente",
      chaveIdempotencia: `seed-${n}`, pspId,
      copiaECola: o.metodo === "pix" ? copiaECola(pspId, p.precoCentavos) : null,
      criadaEm: new Date(agora).toISOString(),
      expiraEm: o.metodo === "pix" ? new Date(agora + MINUTOS_PIX * MIN).toISOString() : null,
      confirmadaEm: null, webhookEm: null, conciliadaEm: null, pagoNoPsp: false,
      ...o,
    };
    cobrancas.push(c);
    return c;
  };

  // u1: assinou no cartão e está com o Premium em dia
  {
    const q = criar({ usuarioId: "u1", planoId: "mensal", metodo: "cartao",
      estado: "paga", pagoNoPsp: true,
      criadaEm: new Date(agora - 8 * DIA).toISOString(),
      confirmadaEm: new Date(agora - 8 * DIA).toISOString(),
      webhookEm: new Date(agora - 8 * DIA).toISOString() });
    usuarios[0].premiumAte = new Date(new Date(q.confirmadaEm!).getTime() + 30 * DIA).toISOString();
  }

  // u2: foi Premium e venceu
  {
    const q = criar({ usuarioId: "u2", planoId: "mensal", metodo: "pix",
      estado: "paga", pagoNoPsp: true,
      criadaEm: new Date(agora - 41 * DIA).toISOString(),
      expiraEm: new Date(agora - 41 * DIA + MINUTOS_PIX * MIN).toISOString(),
      confirmadaEm: new Date(agora - 41 * DIA).toISOString(),
      webhookEm: new Date(agora - 41 * DIA).toISOString() });
    usuarios[1].premiumAte = new Date(new Date(q.confirmadaEm!).getTime() + 30 * DIA).toISOString();
  }

  // u3: nunca assinou
  // u4: PAGOU e a notificação se perdeu. O dinheiro está no PSP e ele não tem Premium.
  criar({ usuarioId: "u4", planoId: "anual", metodo: "pix",
    estado: "pendente", pagoNoPsp: true,
    criadaEm: new Date(agora - 26 * MIN).toISOString(),
    expiraEm: new Date(agora + 4 * MIN).toISOString() });

  // u5: Pix gerado agora, ainda esperando
  criar({ usuarioId: "u5", planoId: "mensal", metodo: "pix",
    criadaEm: new Date(agora - 3 * MIN).toISOString(),
    expiraEm: new Date(agora + 27 * MIN).toISOString() });

  // u3: um QR que venceu sem pagamento
  criar({ usuarioId: "u3", planoId: "mensal", metodo: "pix",
    estado: "expirada",
    criadaEm: new Date(agora - 90 * MIN).toISOString(),
    expiraEm: new Date(agora - 60 * MIN).toISOString() });

  return { usuarios, cobrancas };
}
