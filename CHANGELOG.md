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
- Conteúdo de jogo (Espécies, Estilos, Akuma no Mi, etc.) via compendium
  separado

---

## [0.2.0] — 2026-05-24

Segunda release. Adiciona suporte completo a **Tidy5e Sheet** (Classic e
Quadrone) e infraestrutura de **animações via Sequencer/JB2A** acionada por
hook na activity do dnd5e.

### Adicionado

#### Suporte multi-sheet
- **Tidy5e Sheet** (classic + quadrone): hooks `renderTidy5eCharacterSheet` e
  `renderTidy5eCharacterSheetQuadrone` registrados. Painéis OPRPG aparecem
  automaticamente na aba "Character"/"Attributes" do Tidy.
- **Anchor inteligente** por tipo de ficha: usa `[data-tab-contents-for="attributes"]`
  no Quadrone (escondem automaticamente quando outra aba é selecionada),
  `.sidebar > .card` no dnd5e default.
- **Wrapper container** (`.oprpg-panels-wrapper`) que força `flex-direction:
  column` independente do layout do container pai — corrige painéis ficando
  lado a lado em layouts flex-row do Tidy.
- **Placement strategy**: detecta se anchor é tab container (`data-tab-contents-for`
  ou `.tab-content`) e anexa dentro da última `.attributes-column` em vez
  de empilhar no topo — preserva o layout existente da aba.
- **Tab visibility toggle**: hook `tidy5e-sheet.selectTab` esconde wrapper
  quando aba ativa não é uma das overview tabs (`attributes`, `sheet`,
  `details`, `character`).

#### Animação de Activities
- Hook **`dnd5e.postUseActivity`** que dispara quando qualquer activity é
  usada. Lê `flags.oprpg.animationMacroId` do item pai e executa o macro
  Foundry correspondente via `Macro#execute({actor, item, activity, token,
  targets})` (API oficial, sem CSP issues).
- **Auto-roll damage** para activities de tipo `damage` em items OPRPG —
  controlado por `flags.oprpg.autoRollDamage` (opt-in explícito ou default ON
  pra items com flag `oprpg`).
- Macros recebem o contexto padrão: `actor`, `item`, `activity`, `token`,
  `targets` — compatível com macros do hotbar.
- **Desacoplado** via `setTimeout(0)` — falhas na animação não bloqueiam
  o fluxo da activity, dano continua sendo rolado.
- Logs prominentes (`postUseActivity FIRED: ...`) pra diagnóstico.

#### Performance e diagnóstico
- **Debounce de render** via `requestAnimationFrame` (`WeakSet` por sheet) —
  cascada de 5 re-renders por uma única ação colapsa em 1 injeção.
- **Confirmação de hook bound** no `ready`: `dnd5e.postUseActivity hook
  bound — animations ready.`
- **Diagnóstico de sheet type**: log `render → sheetType='tidy5e', actor='...'`
  identifica qual ficha disparou.
- **Detecção de flag itemacro velho**: warn explícito se item tem
  `flags.itemacro` mas não `flags.oprpg.animationMacroId`.

#### CSS
- Estilos dos painéis (`oprpg-bounty-panel`, `oprpg-resources-panel`,
  `oprpg-haki-panel`, `oprpg-tecnicas-panel`) **desacoplados** do escopo
  `.dnd5e2.sheet.actor .sidebar` — funcionam em qualquer ficha.
- Layout específico por sheet via `data-sheet-type`:
  - `dnd5e`: largura 100% (fill da sidebar)
  - `tidy5e`: largura 280px constrangida, `align-self: flex-start`
- Tokens de design compartilhados (`--oprpg-bg`, `--oprpg-accent`, etc.)

#### Exemplo de conteúdo
- **`examples/install-lunariano.js`**: script console-pasteável que cria a
  Espécie Lunariano completa — race + 3 feats (Heat, Manipulação do Fogo,
  Cabeça à Prêmio) + 5 macros (animações Heat/Esfera, Ativar/Apagar Aura
  de Fogo, Caça 1d12). Usa a API oficial `item.createActivity()` pra
  garantir schema válido.

### Corrigido

- Painéis duplicando em cascata quando midi-qol ou outros módulos forçavam
  re-renders múltiplos.
- Wrapper sendo posicionado em local errado no Tidy5e Quadrone (push de
  conteúdo do tab pra fora da tela).
- Activity malformada quando criada via spread de dados literais — agora
  usa a API `item.createActivity(type, data, options)` que garante schema
  válido (`damage.critical`, `damage.parts[].custom`, `damage.parts[].scaling`).
- `flags.itemacro` (módulo Item Macro v3) não disparava no fluxo de
  activities do dnd5e v5.x — substituído por hook nativo + `Macro#execute`.

### Compatibilidade
- Foundry VTT: v13 (testado em 13.347+)
- Sistema dnd5e: ≥ 5.0.0 (testado em 5.3.3)
- **Tidy5e Sheet**: v13.3.0+ (Classic e Quadrone)
- **Sequencer**: 4.x
- **JB2A Patreon**: 0.8.6+
- Compatível com midi-qol (mas auto-roll damage pode conflitar — opcional)

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
