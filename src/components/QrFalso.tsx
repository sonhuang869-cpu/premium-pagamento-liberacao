/**
 * Bloco com cara de QR, desenhado a partir do próprio código copia-e-cola.
 * Não é um QR de verdade e não deve ser escaneado: está aqui só para a tela
 * ter o peso visual que terá em produção.
 */
export function QrFalso({ semente, lado = 196 }: { semente: string; lado?: number }) {
  const n = 25;
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) { h ^= semente.charCodeAt(i); h = Math.imul(h, 16777619); }
  const celulas: boolean[] = [];
  for (let i = 0; i < n * n; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    celulas.push(((h >>> 0) % 100) < 46);
  }
  const marcador = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const dentro = (x: number, y: number, ox: number, oy: number) => {
    const dx = x - ox, dy = y - oy;
    const anel = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
    return anel === 3 || anel <= 1;
  };

  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={lado} height={lado} role="img"
      aria-label="Código QR de demonstração, não escaneável" data-teste="qr"
      className="rounded-lg bg-white p-1 shadow-sm">
      {Array.from({ length: n * n }).map((_, i) => {
        const x = i % n, y = Math.floor(i / n);
        let on = celulas[i];
        if (marcador(x, y)) {
          const ox = x < 7 ? 0 : n - 7, oy = y < 7 ? 0 : n - 7;
          on = dentro(x, y, ox, oy);
        }
        return on ? <rect key={i} x={x} y={y} width="1" height="1" fill="#17121f" /> : null;
      })}
    </svg>
  );
}
