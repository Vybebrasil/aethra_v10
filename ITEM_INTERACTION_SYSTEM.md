# Item Math, Tooltip, Drag & Drop e NPCs

- Cada item gerado salva `statMultiplier`, `individualMultipliers`, `baseStats` e `affixes`.
- `Aethra.GameData.calculateItemStats(item)` nunca sorteia novamente.
- Itens podem ser clicados, destacados, equipados com duplo clique ou arrastados para o Paperdoll.
- Equipar remove da mochila, troca o item anterior e recalcula os atributos do herói.
- Clique no Mercador ou chegue a até 72px e pressione Espaço para abrir `npc-shop-view`.
