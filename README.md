# Premium · pagamento e liberação

Demonstração do fluxo de assinatura Premium: Pix e cartão, e o que acontece
quando a notificação do pagamento não chega.

Tudo roda no navegador. Os usuários, as cobranças e os códigos são inventados,
o QR não é escaneável e nenhum dinheiro se move. Os dados ficam no
`localStorage` e sobrevivem ao recarregar; "Restaurar dados" volta ao início.

## O que dá para experimentar

- **Gerar um Pix** com QR, copia-e-cola e relógio de validade de 30 minutos.
- **Cliente paga e o webhook chega** — o Premium é liberado na hora.
- **Cliente paga e o webhook se perde** — o dinheiro entra no provedor e o
  Premium não sai. É assim que esses fluxos vazam receita sem ninguém ver.
- **Conciliar** — a tela de assinantes vai perguntar ao provedor o que ele sabe
  e libera o que o webhook não entregou.
- **Reenviar o mesmo webhook** — chega duas vezes com frequência, e a segunda
  não pode estender o Premium de novo.
- **Tocar duas vezes ao mesmo tempo** — dois toques simultâneos no botão
  devolvem uma cobrança só, pela chave de idempotência.
- **Cartão recusado** e **estorno**, que devolve os dias concedidos.

Wesley Tomás já começa com um pagamento preso: pagou e continua sem Premium.

## As regras que importam

Ficam em `src/lib/api.ts`, não nas telas:

- a mesma chave de idempotência devolve sempre a mesma cobrança;
- um código vencido não vira pago, nem se o webhook chegar depois;
- webhook repetido registra a chegada e não mexe na validade;
- renovar antes do vencimento soma ao que resta, em vez de jogar dias fora;
- estornar devolve exatamente os dias que aquela cobrança tinha dado.

## Rodar

```bash
npm install
npm run dev
```

## Stack

Vite, React, TypeScript, Tailwind, shadcn/ui, React Router.
A API é simulada, com atraso de rede, sobre `localStorage`.
Em produção, o mesmo contrato é atendido pelo backend do aplicativo.

Justin Gnoh · outubro de 2026
