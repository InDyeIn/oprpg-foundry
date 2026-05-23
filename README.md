# One Piece RPG (d20) — Foundry VTT

> Módulo de adaptação do sistema **dnd5e** para o **RPG de One Piece** baseado em d20.

[![Foundry v13](https://img.shields.io/badge/Foundry-v13-informational)](https://foundryvtt.com/)
[![dnd5e ≥ 5.0](https://img.shields.io/badge/dnd5e-%E2%89%A55.0.0-red)](https://github.com/foundryvtt/dnd5e)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Versão 0.1.0](https://img.shields.io/badge/version-0.1.0-blue)](CHANGELOG.md)

Adapta o sistema D&D 5e do Foundry VTT para jogar o **RPG de One Piece**
(baseado em d20) sem precisar criar um sistema novo do zero. Sobrescreve
em runtime as configurações do dnd5e (atributos, perícias, condições, tipos
de dano, etc.) e injeta painéis próprios na ficha de personagem
(**Recompensa**, **Recursos**, **Haki**, **Técnicas**).

> ⚠️ **Este módulo não traz conteúdo de jogo.** Espécies, Estilos de Combate,
> Akuma no Mi, Técnicas, armas e equipamentos devem ser criados manualmente
> ou importados de um compendium separado. O módulo só fornece a
> *infraestrutura* (motor, UI, settings).

---

## 📦 Instalação

### Via URL de Manifest (recomendado)
1. No Foundry VTT, vá em **Add-on Modules → Install Module**
2. Cole no campo "Manifest URL":
   ```
   https://github.com/InDyeIn/oprpg-foundry/releases/latest/download/module.json
   ```
3. Clique em **Install**

### Manual (a partir do ZIP)
1. Baixe `oprpg.zip` da [última release](https://github.com/InDyeIn/oprpg-foundry/releases)
2. Extraia em `Data/modules/oprpg/`
3. Reinicie o Foundry e ative o módulo no seu mundo

### Requisitos
- **Foundry VTT** v13 (provavelmente funciona em v12 e v14)
- **Sistema dnd5e** ≥ 5.0.0 (testado em 5.3.3)
- Mundo configurado com o sistema dnd5e ativo

---

## ✨ Funcionalidades

### 🎲 Motor de jogo (automático)

- **Atributos OP**: Força, Destreza, Constituição, Sabedoria, Vontade, Presença
  *(internamente mantidos como str/dex/con/int/wis/cha pra compatibilidade)*
- **4 perícias novas**: Haki, Sobrenatural, Sorte, Provocação
- **18 perícias OP** re-mapeadas dos atributos D&D pros atributos OP
- **Tipo de dano Verdadeiro**: ignora resistências/vulnerabilidades/imunidades
- **7 condições OP novas**: Bêbado, Empoderado, Enfraquecido, Enfurecido,
  Estremecido, Letárgico, Sonolento (+ condições D&D renomeadas: Atordoado,
  Caído, etc.)
- **Encumbrance OP**: Sobrecarga ×3 / Pesada ×6 / Máximo ×10 da Força
- **Moeda Beli (฿)** substituindo as moedas D&D
- **Ação Poderosa**: 4ª ação além de Ação/Bônus/Reação (pra Técnicas)
- **8 categorias de feature OP** na aba Features: Técnicas de Combate,
  Técnicas Auxiliares, Manifestações de Poder, Akuma no Mi (com 5 subtipos),
  Habilidades de Haki, Códigos de Honra, Singularidades, Defeitos

### 🎨 Interface customizada

A sidebar da ficha de personagem ganha 4 painéis novos:

```
┌─────────────────────────────┐
│  Card padrão (PV, etc.)     │
├─────────────────────────────┤
│  ☠ RECOMPENSA              │
│  Bounty: ฿ 50.000.000       │
│  Estágio: Notoriedade Local │
├─────────────────────────────┤
│  ⭐ RECURSOS                │
│  Pontos de Poder            │
│  Pontos de Ambição          │
├─────────────────────────────┤
│  ☯ HAKI                     │
│  ARM / OBS / REI            │
├─────────────────────────────┤
│  ⚡ TÉCNICAS                │
│  Lista com PP e botão usar  │
└─────────────────────────────┘
```

- **Recompensa**: bounty editável + Estágio de Fama derivado automaticamente
  do nível (1–4: Desconhecido / 5–8: Notoriedade Local / 9–12: Fama Regional
  / 13–16: Renome na Grand Line / 17–20: Fama Mundial)
- **Recursos**: Pontos de Poder e Pontos de Ambição como medidores
- **Haki**: 3 trilhas (Armamento, Observação, Rei) com steppers
- **Técnicas**: lista todos os feats com tipo OP, mostra Grau + custo em PP,
  click pra usar

Outros ajustes visuais:
- Abas **Spells** e **Bastion** escondidas
- Tradução completa de labels visíveis (Atributos, Perícias, Condições, etc.)
- Token de personagem novo já nasce com bar1 = PV, bar2 = PP

---

## ⚙️ Configurações

Disponíveis em **Game Settings → Configure Settings → One Piece RPG (d20)**:

| Setting | Escopo | Padrão | O que faz |
|---|---|---|---|
| Mostrar painel de Recompensa | Cliente | Ligado | Esconde/mostra o painel Recompensa |
| Mostrar painel Haki | Cliente | Ligado | Esconde/mostra o painel Haki |
| Mostrar painel Técnicas | Cliente | Ligado | Esconde/mostra o painel Técnicas |
| Dano Verdadeiro ignora resistências | Mundo | Ligado | Liga/desliga o bypass |
| Regra Opcional: Motivação | Mundo | Desligado | *(placeholder)* |
| Regra Opcional: Guerreiros Piratas | Mundo | Desligado | *(placeholder)* |
| Regra Opcional: Ferimentos Persistentes | Mundo | Desligado | *(placeholder)* |
| Regra Opcional: Combate Submerso | Mundo | Desligado | *(placeholder)* |

---

## 🛠️ Como criar Técnicas

Pra que uma habilidade apareça automaticamente no painel **Técnicas** da
sidebar e gaste Pontos de Poder corretamente:

1. Crie um item do tipo **Feat** (em Items ou direto na ficha)
2. Na aba *Details* do item, defina o **Type** como uma das 3 opções:
   - **Técnica de Combate** (ofensivas)
   - **Técnica Auxiliar** (buffs, utility)
   - **Manifestação de Poder** (MP de Akuma no Mi)
3. Defina o **Grau** da Técnica em `flags.oprpg.grau` (1, 2, 3, etc.)
   - *Via macro:* `item.setFlag('oprpg', 'grau', 2)`
4. Configure a **Activity** (Attack/Save/Damage):
   - **Activation** → "Ação Poderosa" (ou Bônus/Reação se aplicável)
   - **Consumption** → tipo **Attribute**, target **`resources.primary.value`**,
     valor = custo em PP (ex: `1`, `3`, etc.)

O painel detecta automaticamente o tipo, o grau e o custo de PP, e mostra
tudo de forma compacta.

---

## 🧱 Arquitetura

```
oprpg/
├── module.json              ← manifest Foundry
├── LICENSE                  ← MIT
├── README.md                ← este arquivo
├── CHANGELOG.md             ← histórico de versões
├── scripts/
│   └── oprpg.mjs            ← código principal (overrides + injetores + API)
├── styles/
│   └── oprpg.css            ← estilização dos painéis injetados
└── lang/
    └── pt-br.json           ← traduções (serve em pt-BR e como override de en)
```

**Princípio de design**: NÃO modificar o sistema dnd5e em disco. Tudo é
sobrescrita em runtime via `CONFIG.DND5E.*` e wraps em métodos de sheet.
Update do sistema dnd5e não quebra o módulo (no máximo precisa ajustar
alguns paths se o dnd5e renomear classes internamente).

API exposta em `game.modules.get('oprpg').api`:
- `initializeCharacter(actor)` — aplica defaults OP em personagem existente
- `initializeAllCharacters()` — varre todos os personagens do mundo
- `RESOURCE_PATHS` — paths canônicos pros recursos OP
- `version` — versão atual

---

## ⚠️ Limitações conhecidas

- **Sem conteúdo de jogo**: o módulo é só infraestrutura. Você precisa criar
  ou importar Espécies, Estilos de Combate, Akuma no Mi, Técnicas, armas, etc.
- **Regras opcionais são placeholders**: Motivação, Guerreiros Piratas,
  Ferimentos Persistentes e Combate Submerso aparecem nas settings mas
  ainda não fazem nada mecanicamente.
- **Pontos de Vida Negativos não implementado**: ainda usa as death saves do D&D.
- **Expertise de armas ainda manual**: não há automatização do efeito em
  crit natural 20.

---

## 🔌 Compatibilidade com outros módulos

### Recomendados
- **lib-wrapper** — não obrigatório, mas evita conflitos com outros módulos
  que wrappam métodos do dnd5e
- **dice-so-nice** — efeitos visuais de dados
- **midi-qol** — automação de combate (precisa de token no canvas)

### Conflitos conhecidos
- **Combat Tracker Extensions** ≤ 1.4 — quebra em Foundry v13 (não é falha
  do oprpg; desative o módulo problemático)
- **Drag Ruler** ≤ 1.13.7 — quebra na renderização do canvas em Foundry v13

---

## 🗺️ Roadmap

Veja [CHANGELOG.md → Não Lançado](CHANGELOG.md) pra prioridades atuais.

**Próximas iterações**:
- Implementar mecanicamente as 4 regras opcionais
- Pontos de Vida Negativos (Cap. 12.6)
- Sistema de Expertise de armas
- Doenças OP (Cap. 10.5) como RollTable + condição
- Compendium separado com Espécies, Estilos de Combate e armas

---

## 🤝 Contribuir

Issues e PRs são bem-vindos em [GitHub](https://github.com/InDyeIn/oprpg-foundry).

### Reportar bug
Inclua:
- Versão do Foundry e do dnd5e (`game.version` e `game.system.version`)
- Versão do módulo (`game.modules.get('oprpg').version`)
- Saída do **Sanity check** no console (F12)
- Stack trace se houver erro

### Desenvolvimento
O módulo é um único arquivo `scripts/oprpg.mjs` (~750 linhas).
Estrutura por seção:
- `init` hook → overrides de CONFIG.DND5E
- `setup` hook → wraps das classes de sheet
- `preCreateActor` → defaults OP em personagem novo
- `renderCharacterActorSheet` → injeção dos 4 painéis
- `dnd5e.preCalculateDamage` / `calculateDamage` → bypass Verdadeiro
- `ready` → sanity check + API

---

## 📜 Licença

MIT (veja [LICENSE](LICENSE)).

Este módulo é uma adaptação não-oficial do RPG de One Piece (sistema d20).
"One Piece" é uma obra de Eiichiro Oda; personagens, locais e lore citados
pertencem aos seus respectivos detentores de direitos. O módulo não inclui
material protegido por direitos autorais do livro de regras — fornece
apenas software de infraestrutura.

Construído em cima do [sistema dnd5e](https://github.com/foundryvtt/dnd5e)
(MIT) que disponibiliza conteúdo via SRD 5.1 / SRD 5.2 (CC-BY-4.0).

---

## 🙏 Créditos

- Comunidade **dnd5e** pelo sistema que serve de base
- Eiichiro Oda pela criação de **One Piece**
- Autores do livro de RPG de One Piece (d20)
