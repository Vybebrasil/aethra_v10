# Contrato do backend autoritativo

O cliente atual é um protótipo local. Ele pode simular hunts e duelos contra
bots, mas não tem autoridade competitiva. `AuthorityGateway` é a única fronteira
permitida para conectar o futuro servidor.

## Operações protegidas

| Capacidade | Responsabilidade do servidor |
| --- | --- |
| `combatRng` | seed, decisões por rodada, acerto, crítico, bloqueio, dano e resultado |
| `itemMint` | criação de `instanceId`, rolls, origem e assinatura do item |
| `itemTransfer` | troca de dono com transação e auditoria |
| `rankingWrite` | rating, histórico e posição global |
| `marketWrite` | compra, venda, saldo e taxas |
| `wagerEscrow` | travar, cancelar e liquidar itens apostados |

## Envelope de comando

Cada mutação deve levar `commandId`/chave de idempotência, jogador autenticado,
versão esperada do agregado e payload validado. A resposta retorna a nova versão,
eventos oficiais e uma assinatura verificável pelo cliente. Repetir o mesmo
`commandId` deve devolver a primeira resposta sem aplicar a operação novamente.

## Regras de segurança

- O servidor nunca aceita dano, loot, rolls, saldo ou vencedor calculado pelo cliente.
- O cliente envia intenção; o servidor resolve e persiste o resultado.
- Inventário, mercado e custódia usam transação atômica e log append-only.
- Uma partida competitiva referencia snapshot imutável de equipamento e build.
- Desconexão não liquida aposta no cliente; a custódia aguarda o servidor.
- Saves locais não entram no ambiente competitivo sem importação validada.

## Estado atual

Sem um adaptador `mode: "server"`, `trusted: true`, apostas ficam bloqueadas e
ranking/Coliseu são marcados como simulação local. Registrar um adaptador só
habilita as capacidades que ele declarar explicitamente.
