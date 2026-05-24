/**
 * Install Lunariano — runs once from the Foundry console (F12 → paste → Enter)
 * Creates in the current world:
 *   • 1 race item: "Lunariano"
 *   • 3 feat items: Heat, Manipulação do Fogo, Cabeça à Prêmio
 *   • 5 macros: Heat anim, Esfera anim, Ativar Aura, Apagar Aura, Caça
 *
 * Requirements: oprpg (≥0.1.0 with postUseActivity hook), dnd5e (5.x),
 *               Sequencer, jb2a_patreon
 *
 * Idempotent: re-running detects existing items/macros by name and skips them.
 */

(async () => {
  const MOD = "oprpg";
  const log = (...a) => console.log("%c[install-lunariano]", "color:#c8a86b;font-weight:bold", ...a);
  const warn = (...a) => console.warn("[install-lunariano]", ...a);

  // ---------- Pre-flight ----------
  if (!game.modules.get("sequencer")?.active)    return ui.notifications.error("Sequencer não está ativo.");
  if (!game.modules.get("jb2a_patreon")?.active) return ui.notifications.error("JB2A Patreon não está ativo.");
  if (!game.modules.get(MOD)?.active)             return ui.notifications.error("oprpg não está ativo.");

  // ---------- Asset paths ----------
  const ASSET = {
    fireJet:    "modules/jb2a_patreon/Library/Generic/Fire/FireJet_01_Orange_15ft_600x200.webm",
    fireImpact: "modules/jb2a_patreon/Library/Generic/Impact/ImpactFire01_01_Regular_Orange_600x600.webm",
    fireCast:   "modules/jb2a_patreon/Library/Generic/Cast/CastFire01_01_Regular_Orange_600x600.webm",
    fireBolt15: "modules/jb2a_patreon/Library/Cantrip/Fire_Bolt/FireBolt_01_Dark_Red_15ft_1000x400.webm"
  };
  const ICONS = {
    race:        "systems/dnd5e/icons/svg/damage/fire.svg",
    heat:        "systems/dnd5e/icons/svg/statuses/burning.svg",
    fireControl: "systems/dnd5e/icons/svg/damage/fire.svg",
    bounty:      "systems/dnd5e/icons/svg/statuses/dead.svg"
  };

  // ---------- Folders ----------
  const FOLDER_ITEM = "OPRPG — Espécies";
  let itemFolder = game.folders.find(f => f.type === "Item" && f.name === FOLDER_ITEM);
  if (!itemFolder) itemFolder = await Folder.create({ name: FOLDER_ITEM, type: "Item", color: "#c8a86b" });
  let subFolder = game.folders.find(f => f.type === "Item" && f.folder?.id === itemFolder.id && f.name === "Lunariano");
  if (!subFolder) subFolder = await Folder.create({ name: "Lunariano", type: "Item", folder: itemFolder.id, color: "#a08654" });

  const MACRO_FOLDER_NAME = "OPRPG — Lunariano";
  let macroFolder = game.folders.find(f => f.type === "Macro" && f.name === MACRO_FOLDER_NAME);
  if (!macroFolder) macroFolder = await Folder.create({ name: MACRO_FOLDER_NAME, type: "Macro", color: "#c8a86b" });

  // ---------- Helpers ----------
  const findItem = (type, ident) => game.items.find(i => i.type === type && i.system.identifier === ident);
  const findMacro = (name) => game.macros.find(m => m.name === name);
  const newActivityId = () => foundry.utils.randomID();

  const ensureMacro = async (name, command) => {
    const existing = findMacro(name);
    if (existing) { log(`Macro '${name}' já existe.`); return existing; }
    const macro = await Macro.create({
      name, type: "script", command, folder: macroFolder.id,
      img: ICONS.fireControl, scope: "global"
    });
    log(`Macro '${name}' criada (id ${macro.id}).`);
    return macro;
  };

  // =================================================================
  // STEP 1 — Create animation macros first (items reference them by id)
  // =================================================================

  // Heat animation: cast burst on caster + impact on each target
  const heatAnim = await ensureMacro("Lunariano — Heat (Animação)", `
// Args injected: actor, item, activity, token, targets
const tk = token ?? canvas.tokens.controlled[0]?.document ?? actor?.getActiveTokens?.()[0]?.document;
if (!tk) { ui.notifications.warn("Heat: token não encontrado."); return; }

await new Sequence()
  .effect()
    .file("${ASSET.fireCast}")
    .atLocation(tk)
    .scaleToObject(0.9)
    .duration(700)
    .fadeOut(250)
    .tint("#ff5a1a")
  .play();

if (targets?.length) {
  for (const target of targets) {
    await new Sequence()
      .effect()
        .file("${ASSET.fireImpact}")
        .atLocation(target)
        .scaleToObject(1.5)
        .tint("#ff5500")
      .play();
  }
}
`.trim());

  // Fire Sphere animation: cast → bolt → impact
  const sphereAnim = await ensureMacro("Lunariano — Esfera de Fogo (Animação)", `
const tk = token ?? canvas.tokens.controlled[0]?.document ?? actor?.getActiveTokens?.()[0]?.document;
if (!tk) { ui.notifications.warn("Esfera: token não encontrado."); return; }
if (!targets?.length) { ui.notifications.warn("Mire (T) em um alvo para arremessar a esfera."); return; }

for (const target of targets) {
  await new Sequence()
    .effect()
      .file("${ASSET.fireCast}")
      .atLocation(tk)
      .scaleToObject(0.8)
      .duration(600)
      .fadeOut(200)
    .effect()
      .file("${ASSET.fireBolt15}")
      .atLocation(tk)
      .stretchTo(target)
      .delay(300)
    .effect()
      .file("${ASSET.fireImpact}")
      .atLocation(target)
      .scaleToObject(1.2)
      .delay(700)
      .tint("#ff7733")
    .play();
}
`.trim());

  // Aura activation
  await ensureMacro("Lunariano — Ativar Aura de Fogo", `
const token = canvas.tokens.controlled[0];
if (!token) { ui.notifications.warn("Selecione um token primeiro."); return; }

await token.document.update({
  light: {
    bright: 6, dim: 9, color: "#ff7720", alpha: 0.55,
    animation: { type: "torch", speed: 3, intensity: 3 },
    luminosity: 0.5
  }
});

Sequencer.EffectManager.endEffects({ name: \`lunariano-fire-\${token.id}\` });
new Sequence()
  .effect()
    .file("${ASSET.fireCast}")
    .attachTo(token, { offset: { x: 0, y: -10 }, randomOffset: false })
    .scaleToObject(1.1)
    .belowTokens(false)
    .persist()
    .name(\`lunariano-fire-\${token.id}\`)
    .tint("#ff5511")
    .fadeIn(500)
    .fadeOut(500)
  .play();

ui.notifications.info(\`Aura de Fogo ativada em \${token.name}\`);
`.trim());

  // Aura deactivation
  await ensureMacro("Lunariano — Apagar Aura de Fogo", `
const token = canvas.tokens.controlled[0];
if (!token) { ui.notifications.warn("Selecione um token primeiro."); return; }

await token.document.update({
  light: { bright: 0, dim: 0, alpha: 0, animation: { type: null } }
});

Sequencer.EffectManager.endEffects({ name: \`lunariano-fire-\${token.id}\` });
ui.notifications.info(\`Aura apagada em \${token.name}\`);
`.trim());

  // Cabeça à Prêmio hunt roll
  await ensureMacro("Lunariano — Cabeça à Prêmio (Caça)", `
const roll = await new Roll("1d12").evaluate();
const triggered = roll.total <= 6;
const flavor = triggered
  ? "<h3 style='color:#c8a86b'>⚠ A CAÇA COMEÇOU</h3><p>Em algum momento do dia seguinte, um grupo do Governo Mundial ou Marinha aparece para capturar o lunariano.</p>"
  : "<h3 style='color:#888'>Por hoje, nada.</h3><p>O lunariano não foi reconhecido. Ninguém vem atrás dele neste dia.</p>";

roll.toMessage({ flavor, speaker: ChatMessage.getSpeaker() });
`.trim());

  // =================================================================
  // STEP 2 — Create items (race + 3 feats), linking macros by id
  // =================================================================

  // ---------- Race ----------
  if (findItem("race", "lunariano")) {
    log("Race 'Lunariano' já existe, pulando.");
  } else {
    await Item.create({
      name: "Lunariano",
      type: "race",
      img: ICONS.race,
      folder: subFolder.id,
      system: {
        description: { value: `
          <p><strong>Os lunarianos</strong> possuem aparência exótica: pele morena, cabelos brancos
          e par de asas com penas negras. Têm uma <strong>esfera de fogo</strong> constantemente
          queimando atrás das costas e nuca.</p>

          <h3>Atributos da Espécie</h3>
          <ul>
            <li><strong>Ajuste:</strong> +1 em dois atributos OU +2 em um (à sua escolha)</li>
            <li><strong>Preconceito:</strong> Medíocre</li>
            <li><strong>PV Base:</strong> 16</li>
            <li><strong>Tamanho:</strong> Médio (1,8m a 5m)</li>
            <li><strong>Peso:</strong> 90 a 600 kg</li>
            <li><strong>Deslocamento:</strong> 9 m; Nado 3 m</li>
          </ul>

          <h3>Traços Culturais</h3>
          <p>Recebe Pontos de Treinamento igual ao mod. de Sabedoria (mínimo 1), convertidos imediatamente
          em treinamentos na criação. Ao subir o modificador de Sabedoria, recebe mais.</p>

          <h3>História</h3>
          <p>Cultuados como "Tribo de Deuses" no topo da Red Line antes de serem quase extintos.
          O Governo Mundial caça lunarianos pagando <strong>฿ 100.000.000</strong> por pista.
          Capturados nunca são soltos — viram cobaias.</p>

          <h3>Comportamento</h3>
          <p>Escondem suas origens, disfarçados sob mantos. Comumente em organizações criminosas.</p>
        `.trim() },
        identifier: "lunariano",
        type: { value: "humanoid" },
        movement: { walk: 9, swim: 3, fly: 0, climb: 0, burrow: 0, units: "m" },
        source: { custom: "One Piece RPG — Cap. 2" }
      },
      flags: {
        [MOD]: { speciesKey: "lunarianos", prejudice: "Medíocre", baseHp: 16 }
      },
      effects: [{
        name: "PV Base da Espécie (Lunariano +16)",
        img: ICONS.race,
        transfer: true,
        changes: [{ key: "system.attributes.hp.bonuses.overall", mode: 2, value: "16", priority: 20 }]
      }]
    });
    log("Race Lunariano criada.");
  }

  // ---------- Heat ----------
  if (findItem("feat", "lunariano-heat")) {
    log("Feat 'Heat' já existe, pulando.");
  } else {
    // 1) Create item base (no activities yet — let dnd5e build them).
    const heat = await Item.create({
      name: "Heat",
      type: "feat",
      img: ICONS.heat,
      folder: subFolder.id,
      system: {
        description: { value: `
          <p><strong>Benefício da Espécie.</strong> Uma vez por rodada, como <strong>ação bônus</strong>,
          adiciona <strong>1d10 de dano de Fogo</strong> a uma jogada de ataque.</p>
          <p>Usável <strong>(nível) vezes por descanso longo</strong>.</p>
          <p>Alternativamente sem ação bônus: até <strong>5 vezes</strong> por descanso longo
          (compartilha o limite total).</p>
          <p><em>Limite: 1 vez por rodada.</em> Compartilhado com "Electro" e "Potencializador Ofensivo".</p>
        `.trim() },
        identifier: "lunariano-heat",
        type: { value: "race" },
        activation: { type: "bonus", value: 1, cost: 1 },
        uses: {
          spent: 0,
          max: "5",
          recovery: [{ period: "lr", type: "recoverAll" }]
        },
        source: { custom: "One Piece RPG — Espécie Lunariana" }
      },
      flags: {
        [MOD]: {
          featureType: "race",
          speciesKey: "lunarianos",
          animationMacroId: heatAnim.id
        }
      }
    });
    // 2) Add a damage activity via the official dnd5e API.
    await heat.createActivity("damage", {
      name: "Heat — Aplicar 1d10 Fogo",
      activation: { type: "bonus", value: 1 },
      consumption: { targets: [{ type: "itemUses", value: "1", target: "" }] },
      damage: {
        parts: [{
          number: 1, denomination: 10, bonus: "", types: ["fire"]
        }]
      }
    }, { renderSheet: false });
    log("Feat Heat criada (com damage activity via API).");
  }

  // ---------- Manipulação do Fogo ----------
  if (findItem("feat", "lunariano-manipulacao-do-fogo")) {
    log("Feat 'Manipulação do Fogo' já existe, pulando.");
  } else {
    const fc = await Item.create({
      name: "Manipulação do Fogo",
      type: "feat",
      img: ICONS.fireControl,
      folder: subFolder.id,
      system: {
        description: { value: `
          <p>Enquanto o fogo nas suas costas se mantém:</p>
          <ul>
            <li><strong>Resistência a Fogo</strong></li>
            <li><strong>Iluminação:</strong> 6m luz plena + 3m penumbra (config. luz do token)</li>
            <li><strong>Esfera de Fogo:</strong> ação, mover esfera até 6m, <strong>1d4 fogo</strong> em criatura
            (apaga ao contato) ou combustão em objetos inflamáveis.</li>
          </ul>
          <p class="note"><em>Use a macro <strong>"Ativar Aura de Fogo"</strong> para aplicar luz +
          aura persistente no token.</em></p>
        `.trim() },
        identifier: "lunariano-manipulacao-do-fogo",
        type: { value: "race" },
        activation: { type: "action", value: 1, cost: 1 },
        source: { custom: "One Piece RPG — Espécie Lunariana" }
      },
      flags: {
        [MOD]: {
          featureType: "race",
          speciesKey: "lunarianos",
          animationMacroId: sphereAnim.id
        }
      },
      effects: [{
        name: "Resistência a Fogo (Manipulação do Fogo)",
        img: ICONS.fireControl,
        transfer: true,
        changes: [{ key: "system.traits.dr.value", mode: 2, value: "fire", priority: 20 }]
      }]
    });
    await fc.createActivity("damage", {
      name: "Esfera de Fogo (1d4)",
      activation: { type: "action", value: 1 },
      damage: {
        parts: [{
          number: 1, denomination: 4, bonus: "", types: ["fire"]
        }]
      },
      range: { value: 6, units: "m" }
    }, { renderSheet: false });
    log("Feat Manipulação do Fogo criada (com Esfera de Fogo activity via API).");
  }

  // ---------- Cabeça à Prêmio ----------
  if (findItem("feat", "lunariano-cabeca-a-premio")) {
    log("Feat 'Cabeça à Prêmio' já existe, pulando.");
  } else {
    await Item.create({
      name: "Cabeça à Prêmio",
      type: "feat",
      img: ICONS.bounty,
      folder: subFolder.id,
      system: {
        description: { value: `
          <p><strong>Dificuldade da Espécie.</strong> Governo Mundial busca capturar/exterminar lunarianos,
          recompensando com <strong>฿ 100.000.000</strong> por pista.</p>
          <p>Se mostrar a aparência em público, Narrador rola <strong>1d12</strong>:
          em <strong>≤6</strong>, em algum momento do dia seguinte aparece um grupo do Governo Mundial
          ou Marinha para capturar.</p>
          <p class="note"><em>Macro <strong>"Cabeça à Prêmio — Caça"</strong> rola automaticamente.</em></p>
        `.trim() },
        identifier: "lunariano-cabeca-a-premio",
        type: { value: "defeito" },
        source: { custom: "One Piece RPG — Espécie Lunariana" }
      },
      flags: { [MOD]: { featureType: "defeito", speciesKey: "lunarianos" } }
    });
    log("Feat Cabeça à Prêmio criada.");
  }

  ui.notifications.info("Lunariano instalado: 1 race + 3 feats + 5 macros.");
  log("DONE.");
})();
