import { useEffect, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EstadoBadge } from "@/components/EstadoBadge";
import { conciliar, estornar, expirarVencidas, getUsuarios, type UsuarioVista } from "@/lib/api";
import { METODO_ROTULO, brl, plano, type Cobranca } from "@/lib/tipos";

export default function Cobrancas() {
  const [us, setUs] = useState<UsuarioVista[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const puxar = async () => { await expirarVencidas(); setUs(await getUsuarios()); };
  useEffect(() => { let v = true; puxar().then(() => { if (!v) setUs(null); }); return () => { v = false; }; }, []);

  const linhas: { c: Cobranca; nome: string }[] = (us ?? [])
    .flatMap((u) => u.cobrancas.map((c) => ({ c, nome: u.usuario.nome })))
    .sort((a, b) => b.c.criadaEm.localeCompare(a.c.criadaEm));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cobranças</h1>
          <p className="text-sm text-muted-foreground" data-teste="total">
            {us === null ? "Carregando..." : `${linhas.length} cobranças`}
          </p>
        </div>
        <Button variant="outline" className="h-11 gap-2" disabled={ocupado === "conc"} data-teste="conciliar"
          onClick={async () => {
            setOcupado("conc");
            try {
              const r = await conciliar();
              toast.success(r.liberadas.length === 0 ? "Nada pendente no provedor" : `${r.liberadas.length} liberado`);
              await puxar();
            } finally { setOcupado(null); }
          }}>
          {ocupado === "conc" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCcw className="size-4" aria-hidden />}
          Conciliar
        </Button>
      </div>

      {us === null ? <Skeleton className="h-80 w-full" /> : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Liberado por</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {linhas.map(({ c, nome }) => (
                  <TableRow key={c.id} data-teste={`linha-${c.id}`} data-estado={c.estado}>
                    <TableCell className="font-medium">{nome}</TableCell>
                    <TableCell>{plano(c.planoId).nome}</TableCell>
                    <TableCell>{METODO_ROTULO[c.metodo]}</TableCell>
                    <TableCell className="text-right font-mono">{brl(c.valorCentavos)}</TableCell>
                    <TableCell><EstadoBadge estado={c.estado} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.conciliadaEm ? <span className="text-pix">conciliação</span>
                        : c.webhookEm ? "webhook"
                          : c.pagoNoPsp ? <span className="text-alerta">pago, não avisado</span> : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.estado === "paga" && (
                        <Button variant="outline" size="sm" className="h-10" disabled={!!ocupado} data-teste="estornar"
                          onClick={async () => {
                            setOcupado(c.id);
                            try { await estornar(c.id); toast.success("Estornada"); await puxar(); }
                            catch (e) { toast.error(e instanceof Error ? e.message : "Não deu"); }
                            finally { setOcupado(null); }
                          }}>
                          Estornar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
