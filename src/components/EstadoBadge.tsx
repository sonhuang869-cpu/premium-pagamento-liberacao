import { Badge } from "@/components/ui/badge";
import { ESTADO_ROTULO, type EstadoCobranca } from "@/lib/tipos";

const C: Record<EstadoCobranca, string> = {
  pendente: "bg-pendente/14 text-pendente hover:bg-pendente/14",
  paga: "bg-pago/12 text-pago hover:bg-pago/12",
  expirada: "bg-vencido/12 text-vencido hover:bg-vencido/12",
  falhou: "bg-alerta/12 text-alerta hover:bg-alerta/12",
  estornada: "bg-alerta/10 text-alerta hover:bg-alerta/10",
};

export function EstadoBadge({ estado }: { estado: EstadoCobranca }) {
  return <Badge className={C[estado]} data-teste={`estado-${estado}`}>{ESTADO_ROTULO[estado]}</Badge>;
}
