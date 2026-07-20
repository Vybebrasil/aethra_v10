# Continuous Hunt Loop

- A trilha visual `Partida → Trilha → Evento → Área hostil → Descoberta` foi removida da interface.
- `elapsedTicks` continua sendo usado internamente pelo `HuntSystem` e pelo `ExplorationSystem` para gerar encontros e eventos.
- A Hunt permanece ativa indefinidamente até o jogador parar, voltar à cidade ou selecionar outra região.
- O painel central mostra apenas a atividade atual e o histórico de eventos da região.
- O nome da Hunt ativa e o estado da sessão aparecem no cabeçalho do painel, sem progresso artificial de rota.
