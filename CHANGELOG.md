# Changelog

Todas as mudanças notáveis do módulo serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere a [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não Lançado]

### Pendente
- Implementação completa das regras opcionais (Motivação, Guerreiros Piratas,
  Ferimentos Persistentes, Combate Submerso)
- Mecânica de Pontos de Vida Negativos (Cap. 12.6)
- Sistema de Expertise de Armas em crit natural 20
- Doenças OP como RollTable + condição "Doente"
- Recharge automático da Forma Sulong (Minks)
- Conteúdo de jogo (Espécies, Estilos, Akuma no Mi, etc.) via compendium
  separado

---

## [0.1.0] — 2026-05-22

Primeiro release público. Adapta o sistema dnd5e para One Piece RPG (d20).

### Adicionado

#### Motor de jogo
- Sobrescritas de `CONFIG.DND5E` em runtime (não modifica o sistema dnd5e)
- 4 perícias novas: **Haki**, **Sobrenatural**, **Sorte**, **Provocação**
- Remoção das perícias D&D não usadas: Arcana, Animal Handling, Religion
- Re-vinculação de Medicina e Sobrevivência ao atributo de Sabedoria do OP
- Tipo de dano **Verdadeiro** (ignora resistência/vulnerabilidade/imunidade
  via hooks em `dnd5e.preCalculateDamage` e `dnd5e.calculateDamage`)
- Remoção dos tipos Necrotic e Radiant (não usados no OP)
- 7 condições OP novas: Bêbado, Empoderado, Enfraquecido, Enfurecido,
  Estremecido, Letárgico, Sonolento
- Encumbrance ajustado: Sobrecarga em Força×3, Sobrecarga Pesada em Força×6,
  Máximo em Força×10
- Moeda **Beli (฿)** substituindo as moedas D&D
- Tipo de ativação **Ação Poderosa** (4ª ação além de Ação/Bônus/Reação)
- 8 categorias de feature: Técnicas de Combate, Técnicas Auxiliares,
  Manifestações de Poder, Akuma no Mi (com subtipos Logia/Paramecia/Zoan),
  Habilidades de Haki (com subtipos Armamento/Observação/Rei), Códigos de
  Honra, Singularidades, Defeitos

#### Interface
- **Painel Recompensa**: bounty editável em ฿ (formatado padrão BR) +
  Estágio de Fama derivado automaticamente do nível
- **Painel Recursos**: Pontos de Poder e Pontos de Ambição como medidores
  com indicadores "atual / máx"
- **Painel Haki**: 3 trilhas (Armamento/Observação/Rei) com steppers +/−
  salvas em `flags.oprpg.haki.*`
- **Painel Técnicas**: lista automática de feats com tipo OP, mostra Grau +
  custo em PP (detectado de `consumption.targets`), botão de uso integrado
  com `item.use()`
- Esconde abas D&D não usadas: **Spells**, **Bastion**
- Tradução completa de labels visíveis (Atributos, Perícias, Condições,
  Tamanhos, Tipos de Dano, Ações)
- Token de personagem novo já nasce com `bar1 = HP` e `bar2 = PP`

#### Settings
- 7 toggles em **Game Settings → Configure Settings → One Piece RPG (d20)**:
  - Mostrar painéis (Recompensa, Haki, Técnicas) — por cliente
  - Dano Verdadeiro ignora resistências — por mundo
  - 4 regras opcionais (Motivação, Guerreiros Piratas, Ferimentos
    Persistentes, Combate Submerso) — por mundo, placeholders

#### Infraestrutura
- API exposta em `game.modules.get('oprpg').api`:
  - `initializeCharacter(actor)` — aplica defaults de OP em personagem existente
  - `initializeAllCharacters()` — varre o mundo todo
  - `RESOURCE_PATHS` — paths canônicos pros recursos OP
  - `version` — versão do módulo
- Sanity check em runtime: ao carregar, valida 16+ invariantes e loga
  problemas com numeração no console
- Hook `preCreateActor`: personagem novo já nasce com `resources.primary`
  = Pontos de Poder, `resources.secondary` = Pontos de Ambição (recarga
  automática em descanso longo)

### Limitações conhecidas
- Sem conteúdo de jogo (intencionalmente — distribuir compendium à parte)
- Regras opcionais ainda são placeholders nas settings
- Mecânica de "Pontos de Vida Negativos" do OP ainda usa as death saves do D&D
- Combate Submerso não automatizado
- Sistema de Expertise de armas (crit nat 20) ainda manual

### Compatibilidade
- Foundry VTT: v13 (verificado), provavelmente v12 e v14
- Sistema dnd5e: ≥ 5.0.0 (testado em 5.3.3)
- Compatível com módulos comuns: lib-wrapper, midi-qol (com token na cena),
  dice-so-nice
- **Conflitos conhecidos**: Combat Tracker Extensions ≤ 1.4, Drag Ruler ≤ 1.13.7
  podem quebrar no Foundry v13 (não é falha do oprpg)
