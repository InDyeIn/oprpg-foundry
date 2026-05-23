/**
 * One Piece RPG (d20) — Foundry VTT module
 * Built on top of the dnd5e system. Overrides CONFIG.DND5E.* in runtime
 * so the underlying system files stay untouched.
 *
 * Strategy: keep dnd5e internal keys (int/wis/cha) intact; only labels
 * are translated via lang/pt-br.json. This avoids breaking actor data,
 * advancement, modules and any other code that depends on the D&D schema.
 */

const MODULE_ID = "oprpg";
const log = (...args) => console.log(`[${MODULE_ID}]`, ...args);
const warn = (...args) => console.warn(`[${MODULE_ID}]`, ...args);
const error = (...args) => console.error(`[${MODULE_ID}]`, ...args);

Hooks.once("init", () => {
  log("Initializing One Piece RPG overrides...");

  if (!globalThis.CONFIG?.DND5E) {
    error("CONFIG.DND5E not found. The dnd5e system must be active for this module to work.");
    return;
  }

  registerSettings();

  const results = {
    skills: applySkillOverrides(),
    damageTypes: applyDamageTypeOverrides(),
    conditions: applyConditionOverrides(),
    encumbrance: applyEncumbranceOverrides(),
    currencies: applyCurrencyOverrides(),
    activation: applyActivationOverrides(),
    tabs: applyTabsOverride(),
    featureTypes: applyFeatureTypesOverride()
    // featureSections moved to 'setup' hook below (timing-sensitive: needs
    // dnd5e application classes fully populated).
  };

  log("Overrides applied:", results);
});

// Run sheet method wraps in 'setup' instead of 'init'. By 'setup', the dnd5e
// system has finished its own init hook and exposed all application classes
// on globalThis.dnd5e.applications.actor. Trying this in 'init' is racey.
Hooks.once("setup", () => {
  const result = applyFeatureSectionsOverride();
  log("Feature sections override:", result);
});

Hooks.on("preCreateActor", _onPreCreateActor);

// ---- Dano Verdadeiro (true damage) bypass ----
// The dnd5e engine reduces incoming damage by the actor's resistance and
// boosts it by vulnerability, both keyed by damage type. For OP "verdadeiro",
// nothing should reduce or amplify the damage — ever.
//
// We hook the two-stage damage pipeline:
//   1. preCalculateDamage  -> remember the raw value before adjustments.
//   2. calculateDamage     -> restore the raw value, killing any trait effect.
Hooks.on("dnd5e.preCalculateDamage", (actor, damages, options) => {
  if (getSetting("danoVerdadeiroBypass") === false) return;
  for (const d of damages) {
    if (d?.type === "verdadeiro") {
      d._oprpgRawValue = Number(d.value) || 0;
    }
  }
});
Hooks.on("dnd5e.calculateDamage", (actor, damages, options) => {
  if (getSetting("danoVerdadeiroBypass") === false) return;
  const multiplier = options?.multiplier ?? 1;
  for (const d of damages) {
    if (d?.type === "verdadeiro" && typeof d._oprpgRawValue === "number") {
      d.value = Math.trunc(d._oprpgRawValue * multiplier);
      d.active ??= {};
      d.active.multiplier = multiplier;
      d.active.oprpgVerdadeiro = true;
    }
  }
});

// Render-time DOM injection on the character sheet sidebar. The dnd5e modern
// sheet doesn't render resources.primary/secondary, Haki tracks, or a quick-
// access Técnicas list — we add them ourselves.
function _onRenderCharacterSheet(app, html) {
  const root = html?.jquery ? html[0] : html;
  if (!root || !(root instanceof HTMLElement)) return;
  const actor = app?.actor ?? app?.document;
  if (!actor || actor.type !== "character") return;

  // Insertion order matters — each panel anchors to "previous panel or card".
  // Bounty first (it's the "identity" stat, lives at the top).
  if (getSetting("showBountyPanel") !== false) _injectBountyPanel(app, root, actor);
  _injectResourcesPanel(app, root, actor);
  if (getSetting("showHakiPanel") !== false) _injectHakiPanel(app, root, actor);
  if (getSetting("showTecnicasPanel") !== false) _injectTecnicasPanel(app, root, actor);
}
Hooks.on("renderCharacterActorSheet", _onRenderCharacterSheet);
Hooks.on("renderActorSheet5eCharacter2", _onRenderCharacterSheet);
Hooks.on("renderActorSheet5eCharacter", _onRenderCharacterSheet);

Hooks.once("ready", () => {
  // 1) Expose API FIRST so the sanity check can verify it, and so the GM
  //    can use the commands immediately after the log lines below.
  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = {
      // Character helpers
      initializeCharacter,
      initializeAllCharacters,
      RESOURCE_PATHS,
      get version() { return mod.version; }
    };
    log("API exposed at game.modules.get('oprpg').api");
  }

  // 2) Late sanity check — after all modules and the system finished loading
  //    AND after our API got attached above.
  const summary = sanityCheck();
  if (summary.problems.length) {
    warn(`Sanity check found ${summary.problems.length} issue(s):`);
    summary.problems.forEach((p, i) => console.warn(`[${MODULE_ID}]   ${i + 1}. ${p}`));
  } else {
    log("Sanity check OK. Module is healthy.");
  }

});

/* -------------------------------------------- */
/*  Resources (Pontos de Poder / Ambição)        */
/* -------------------------------------------- */

const RESOURCE_PATHS = Object.freeze({
  pontosPoder: "system.resources.primary",
  pontosAmbicao: "system.resources.secondary"
});

/* -------------------------------------------- */
/*  Settings                                     */
/* -------------------------------------------- */

/**
 * Register module settings exposed on Game Settings → Configure Settings.
 * Each setting is opt-in for an OP optional rule. They're declared here even
 * if the corresponding mechanic isn't implemented yet — placeholders so the
 * UI is ready when the rule lands.
 */
function registerSettings() {
  const opt = {
    name: "OPRPG.SETTING.Motivacao.name",
    hint: "OPRPG.SETTING.Motivacao.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  };

  game.settings.register(MODULE_ID, "ruleMotivacao", { ...opt });
  game.settings.register(MODULE_ID, "ruleGuerreirosPiratas", {
    ...opt,
    name: "OPRPG.SETTING.GuerreirosPiratas.name",
    hint: "OPRPG.SETTING.GuerreirosPiratas.hint"
  });
  game.settings.register(MODULE_ID, "ruleFerimentosPersistentes", {
    ...opt,
    name: "OPRPG.SETTING.FerimentosPersistentes.name",
    hint: "OPRPG.SETTING.FerimentosPersistentes.hint"
  });
  game.settings.register(MODULE_ID, "ruleCombateSubmerso", {
    ...opt,
    name: "OPRPG.SETTING.CombateSubmerso.name",
    hint: "OPRPG.SETTING.CombateSubmerso.hint"
  });

  // Engine toggles
  game.settings.register(MODULE_ID, "danoVerdadeiroBypass", {
    name: "OPRPG.SETTING.DanoVerdadeiroBypass.name",
    hint: "OPRPG.SETTING.DanoVerdadeiroBypass.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // UI toggles
  game.settings.register(MODULE_ID, "showBountyPanel", {
    name: "OPRPG.SETTING.ShowBountyPanel.name",
    hint: "OPRPG.SETTING.ShowBountyPanel.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "showHakiPanel", {
    name: "OPRPG.SETTING.ShowHakiPanel.name",
    hint: "OPRPG.SETTING.ShowHakiPanel.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "showTecnicasPanel", {
    name: "OPRPG.SETTING.ShowTecnicasPanel.name",
    hint: "OPRPG.SETTING.ShowTecnicasPanel.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
}

/** Convenience accessor for settings. Returns undefined if the setting isn't registered yet. */
function getSetting(key) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch {
    return undefined;
  }
}

/* -------------------------------------------- */

/**
 * Default values applied to a character actor so it ships with OP-style
 * resources out of the box. We never overwrite a label the user has already
 * customised — we only fill empty slots.
 */
function _buildResourceDefaults(actor) {
  const PP_LABEL = game.i18n.localize("OPRPG.ResourcePontosPoder");
  const PA_LABEL = game.i18n.localize("OPRPG.ResourcePontosAmbicao");

  const current = actor?.system?.resources ?? {};
  const update = {};

  // Primary -> Pontos de Poder, refreshes on long rest
  if (!current.primary?.label) {
    update["system.resources.primary.label"] = PP_LABEL;
  }
  if (!current.primary?.lr) {
    update["system.resources.primary.lr"] = true;
  }

  // Secondary -> Pontos de Ambição, refreshes on long rest (default — book may
  // refine this once Cap. 7 (Haki) is incorporated).
  if (!current.secondary?.label) {
    update["system.resources.secondary.label"] = PA_LABEL;
  }
  if (!current.secondary?.lr) {
    update["system.resources.secondary.lr"] = true;
  }

  // Prototype token defaults: bar1 = HP, bar2 = Pontos de Poder.
  // Only set if the actor's prototype token doesn't already have them
  // configured by the user.
  const proto = actor?.prototypeToken;
  if (proto && !proto.bar1?.attribute) {
    update["prototypeToken.bar1.attribute"] = "attributes.hp";
  }
  if (proto && !proto.bar2?.attribute) {
    update["prototypeToken.bar2.attribute"] = "resources.primary";
  }

  return update;
}

function _onPreCreateActor(document, data, options, userId) {
  if (document.type !== "character") return;
  const update = _buildResourceDefaults(document);
  if (!Object.keys(update).length) return;
  document.updateSource(update);
  log(`preCreateActor: seeded resources for '${document.name}'`, update);
}

/* -------------------------------------------- */
/*  Sheet injection: Bounty + Estágio de Fama    */
/* -------------------------------------------- */

/** Fame stages map to proficiency-bonus tiers from the OP XP table (Cap. 1.3). */
const FAME_STAGES = [
  { from: 1,  to: 4,  key: "OPRPG.FameStage.Desconhecido" },
  { from: 5,  to: 8,  key: "OPRPG.FameStage.NotoriedadeLocal" },
  { from: 9,  to: 12, key: "OPRPG.FameStage.FamaRegional" },
  { from: 13, to: 16, key: "OPRPG.FameStage.RenomeGrandLine" },
  { from: 17, to: 20, key: "OPRPG.FameStage.FamaMundial" }
];

/** @param {number} level @returns {string} i18n key for the fame stage label. */
function getFameStageKey(level) {
  const lv = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  return FAME_STAGES.find(s => lv >= s.from && lv <= s.to)?.key ?? FAME_STAGES[0].key;
}

/** Format a Beli amount in pt-BR style: 50000000 → "50.000.000". */
function formatBounty(amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  try {
    return new Intl.NumberFormat("pt-BR").format(n);
  } catch {
    return String(n);
  }
}

function _injectBountyPanel(app, root, actor) {
  root.querySelector(".oprpg-bounty-panel")?.remove();

  const sidebar = root.querySelector(".sidebar");
  if (!sidebar) return;

  const anchor = sidebar.querySelector(":scope > .card");
  if (!anchor) return;

  const bounty = Number(actor.flags?.oprpg?.bounty ?? 0);
  const level = Number(actor.system?.details?.level ?? 1);
  const fameKey = getFameStageKey(level);
  const fameLabel = game.i18n.localize(fameKey);
  const PANEL_TITLE = game.i18n.localize("OPRPG.PanelBountyTitle");
  const LABEL_BOUNTY = game.i18n.localize("OPRPG.LabelBounty");
  const LABEL_FAME = game.i18n.localize("OPRPG.LabelFameStage");

  const panel = document.createElement("section");
  panel.classList.add("oprpg-bounty-panel");
  panel.innerHTML = `
    <h3 class="oprpg-title">
      <i class="fas fa-skull-crossbones" inert></i>
      <span>${_escapeHtml(PANEL_TITLE)}</span>
    </h3>
    <div class="oprpg-bounty-row">
      <span class="oprpg-bounty-label">${_escapeHtml(LABEL_BOUNTY)}</span>
      <div class="oprpg-bounty-value">
        <span class="oprpg-bounty-symbol" aria-hidden="true">฿</span>
        <input type="text" class="oprpg-bounty-input" inputmode="numeric"
               value="${_escapeHtml(formatBounty(bounty))}"
               aria-label="${_escapeHtml(LABEL_BOUNTY)}">
      </div>
    </div>
    <div class="oprpg-bounty-row">
      <span class="oprpg-bounty-label">${_escapeHtml(LABEL_FAME)}</span>
      <span class="oprpg-fame-stage" data-level="${level}">${_escapeHtml(fameLabel)}</span>
    </div>
  `;

  // Persist edits: strip non-digits, save, reformat.
  const input = panel.querySelector(".oprpg-bounty-input");
  input.addEventListener("change", async (ev) => {
    const raw = String(ev.target.value ?? "").replace(/\D/g, "");
    const next = Math.max(0, parseInt(raw, 10) || 0);
    await actor.setFlag(MODULE_ID, "bounty", next);
    ev.target.value = formatBounty(next);
  });

  // Auto-select on focus for quick replace.
  input.addEventListener("focus", (ev) => ev.target.select());

  if (!actor.isOwner || app.isLocked || (app.options && app.options.editable === false)) {
    input.disabled = true;
  }

  anchor.insertAdjacentElement("afterend", panel);
}

/* -------------------------------------------- */
/*  Sheet injection: Resources panel             */
/* -------------------------------------------- */

/**
 * Inject a "Recursos" panel into the character sheet sidebar so Pontos de Poder
 * and Pontos de Ambição are visible/editable. The dnd5e modern sheet does not
 * render system.resources for character actors out of the box.
 *
 * @param {ActorSheet|ApplicationV2} app  the sheet application
 * @param {HTMLElement|jQuery} html       the sheet root element (V2: HTMLElement, V1: jQuery)
 */
function _injectResourcesPanel(app, root, actor) {
  // Avoid double-injection if the sheet re-renders partially.
  root.querySelector(".oprpg-resources-panel")?.remove();

  const sidebar = root.querySelector(".sidebar");
  if (!sidebar) return;

  const anchor = sidebar.querySelector(".oprpg-bounty-panel")
              ?? sidebar.querySelector(":scope > .card");
  if (!anchor) return;

  const res = actor.system?.resources ?? {};
  const pp = res.primary ?? { value: 0, max: 0, label: "" };
  const pa = res.secondary ?? { value: 0, max: 0, label: "" };

  const PP_LABEL = pp.label || game.i18n.localize("OPRPG.ResourcePontosPoder");
  const PA_LABEL = pa.label || game.i18n.localize("OPRPG.ResourcePontosAmbicao");
  const PANEL_TITLE = game.i18n.localize("OPRPG.PanelResourcesTitle");
  const CURRENT_LABEL = game.i18n.localize("OPRPG.LabelCurrent");
  const MAX_LABEL = game.i18n.localize("OPRPG.LabelMax");

  const renderResourceRow = (key, label, data) => `
    <div class="oprpg-resource" data-path="${key}">
      <div class="oprpg-resource-label">${_escapeHtml(label)}</div>
      <div class="oprpg-meter">
        <div class="oprpg-field">
          <span class="oprpg-microlabel">${_escapeHtml(CURRENT_LABEL)}</span>
          <input type="number" class="oprpg-input" data-field="value"
                 value="${data.value ?? 0}" min="0" step="1"
                 aria-label="${_escapeHtml(label)} — ${_escapeHtml(CURRENT_LABEL)}">
        </div>
        <span class="oprpg-separator" aria-hidden="true">/</span>
        <div class="oprpg-field">
          <span class="oprpg-microlabel">${_escapeHtml(MAX_LABEL)}</span>
          <input type="number" class="oprpg-input" data-field="max"
                 value="${data.max ?? 0}" min="0" step="1"
                 aria-label="${_escapeHtml(label)} — ${_escapeHtml(MAX_LABEL)}">
        </div>
      </div>
    </div>
  `;

  const panel = document.createElement("section");
  panel.classList.add("oprpg-resources-panel");
  panel.innerHTML = `
    <h3 class="oprpg-title">
      <i class="fas fa-star" inert></i>
      <span>${_escapeHtml(PANEL_TITLE)}</span>
    </h3>
    ${renderResourceRow("primary", PP_LABEL, pp)}
    ${renderResourceRow("secondary", PA_LABEL, pa)}
  `;

  // Wire change handlers — write back to the actor directly, bypassing the
  // form pipeline so we don't fight whatever data-binding the dnd5e sheet
  // is doing on its own inputs.
  panel.querySelectorAll(".oprpg-input").forEach(input => {
    input.addEventListener("change", async (ev) => {
      const resourceKey = ev.target.closest(".oprpg-resource")?.dataset?.path; // 'primary' or 'secondary'
      const field = ev.target.dataset.field; // 'value' or 'max'
      if (!resourceKey || !field) return;
      const next = Number(ev.target.value);
      if (Number.isNaN(next)) return;
      await actor.update({ [`system.resources.${resourceKey}.${field}`]: next });
    });
  });

  // Disable inputs if the sheet is in read-only mode.
  if (!actor.isOwner || app.isLocked || (app.options && app.options.editable === false)) {
    panel.querySelectorAll(".oprpg-input").forEach(i => { i.disabled = true; });
  }

  anchor.insertAdjacentElement("afterend", panel);
}

/* -------------------------------------------- */
/*  Sheet injection: Haki panel                  */
/* -------------------------------------------- */

const HAKI_BRANCHES = [
  { key: "armamento",  labelKey: "OPRPG.HakiSubtype.Armamento",  short: "ARM" },
  { key: "observacao", labelKey: "OPRPG.HakiSubtype.Observacao", short: "OBS" },
  { key: "rei",        labelKey: "OPRPG.HakiSubtype.Rei",        short: "REI" }
];

function _injectHakiPanel(app, root, actor) {
  root.querySelector(".oprpg-haki-panel")?.remove();

  const sidebar = root.querySelector(".sidebar");
  if (!sidebar) return;

  // Insert after resources panel if present, else after the main card.
  const anchor = sidebar.querySelector(".oprpg-resources-panel")
              ?? sidebar.querySelector(":scope > .card");
  if (!anchor) return;

  const stored = actor.flags?.oprpg?.haki ?? {};
  const PANEL_TITLE = game.i18n.localize("OPRPG.PanelHakiTitle");

  const rows = HAKI_BRANCHES.map(b => {
    const lvl = Number(stored[b.key] ?? 0);
    const label = game.i18n.localize(b.labelKey);
    return `
      <div class="oprpg-haki-row" data-branch="${b.key}">
        <div class="oprpg-haki-label" title="${_escapeHtml(label)}">
          <span class="oprpg-haki-short">${_escapeHtml(b.short)}</span>
          <span class="oprpg-haki-full">${_escapeHtml(label)}</span>
        </div>
        <div class="oprpg-haki-stepper">
          <button type="button" class="oprpg-haki-btn" data-delta="-1" aria-label="−">−</button>
          <input type="number" class="oprpg-haki-input" min="0" step="1"
                 value="${lvl}" aria-label="${_escapeHtml(label)}">
          <button type="button" class="oprpg-haki-btn" data-delta="1" aria-label="+">+</button>
        </div>
      </div>
    `;
  }).join("");

  const panel = document.createElement("section");
  panel.classList.add("oprpg-haki-panel");
  panel.innerHTML = `
    <h3 class="oprpg-title">
      <i class="fas fa-yin-yang" inert></i>
      <span>${_escapeHtml(PANEL_TITLE)}</span>
    </h3>
    ${rows}
  `;

  // Persist on direct edit
  panel.querySelectorAll(".oprpg-haki-input").forEach(input => {
    input.addEventListener("change", async (ev) => {
      const branch = ev.target.closest(".oprpg-haki-row")?.dataset?.branch;
      if (!branch) return;
      const next = Math.max(0, Math.floor(Number(ev.target.value) || 0));
      await actor.setFlag(MODULE_ID, `haki.${branch}`, next);
    });
  });

  // +/− steppers
  panel.querySelectorAll(".oprpg-haki-btn").forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      const row = ev.target.closest(".oprpg-haki-row");
      const branch = row?.dataset?.branch;
      if (!branch) return;
      const input = row.querySelector(".oprpg-haki-input");
      const delta = Number(ev.target.dataset.delta) || 0;
      const next = Math.max(0, Math.floor((Number(input.value) || 0) + delta));
      input.value = next;
      await actor.setFlag(MODULE_ID, `haki.${branch}`, next);
    });
  });

  // Read-only mode
  if (!actor.isOwner || app.isLocked || (app.options && app.options.editable === false)) {
    panel.querySelectorAll("input, button").forEach(el => { el.disabled = true; });
  }

  anchor.insertAdjacentElement("afterend", panel);
}

/* -------------------------------------------- */
/*  Sheet injection: Técnicas quick-cast panel   */
/* -------------------------------------------- */

const OP_TECNICA_TYPES = new Set(["tecnicaCombate", "tecnicaAuxiliar", "manifestacaoPoder"]);

/**
 * Try to figure out a Técnica's PP cost by walking its activities' consumption
 * targets and adding up any that consume from resources.primary (PP).
 * Returns null if no Técnica activity consumes PP (then we show "—").
 */
function _resolveTecnicaPPCost(item) {
  const activities = item.system?.activities;
  if (!activities) return null;
  let total = 0;
  let found = false;
  // activities is a Collection-like Map.
  const iter = typeof activities.values === "function" ? activities.values() : Object.values(activities);
  for (const act of iter) {
    const targets = act?.consumption?.targets ?? [];
    for (const t of targets) {
      const isAttribute = t?.type === "attribute";
      const targetsPP = (t?.target ?? "").includes("resources.primary");
      if (isAttribute && targetsPP) {
        const v = Number(t.value);
        if (Number.isFinite(v)) { total += v; found = true; }
      }
    }
  }
  return found ? total : null;
}

function _injectTecnicasPanel(app, root, actor) {
  root.querySelector(".oprpg-tecnicas-panel")?.remove();

  const sidebar = root.querySelector(".sidebar");
  if (!sidebar) return;

  // Collect Técnica items
  const tecnicas = actor.items
    .filter(i => i.type === "feat" && OP_TECNICA_TYPES.has(i.system?.type?.value))
    .sort((a, b) => {
      const ga = Number(a.getFlag(MODULE_ID, "grau") ?? 99);
      const gb = Number(b.getFlag(MODULE_ID, "grau") ?? 99);
      if (ga !== gb) return ga - gb;
      return a.name.localeCompare(b.name);
    });

  if (!tecnicas.length) return; // nothing to show, skip the panel entirely

  // Insert after Haki (preferred) or Resources or main card.
  const anchor = sidebar.querySelector(".oprpg-haki-panel")
              ?? sidebar.querySelector(".oprpg-resources-panel")
              ?? sidebar.querySelector(":scope > .card");
  if (!anchor) return;

  const PANEL_TITLE = game.i18n.localize("OPRPG.PanelTecnicasTitle");
  const LABEL_GRAU = game.i18n.localize("OPRPG.LabelGrau");
  const LABEL_PP = game.i18n.localize("OPRPG.ResourcePontosPoderAbbr");

  const rows = tecnicas.map(item => {
    const grau = item.getFlag(MODULE_ID, "grau");
    const ppCost = _resolveTecnicaPPCost(item);
    const grauTag = grau != null ? `${LABEL_GRAU} ${grau}` : "—";
    const ppTag = ppCost != null ? `${ppCost} ${LABEL_PP}` : "—";
    return `
      <li class="oprpg-tecnica-row" data-item-id="${item.id}">
        <button type="button" class="oprpg-tecnica-use" data-action="use"
                title="${_escapeHtml(item.name)}">
          <img src="${item.img}" alt="" class="oprpg-tecnica-icon">
          <div class="oprpg-tecnica-meta">
            <span class="oprpg-tecnica-name">${_escapeHtml(item.name)}</span>
            <span class="oprpg-tecnica-tags">
              <span class="oprpg-tag oprpg-tag-grau">${_escapeHtml(grauTag)}</span>
              <span class="oprpg-tag oprpg-tag-pp">${_escapeHtml(ppTag)}</span>
            </span>
          </div>
        </button>
      </li>
    `;
  }).join("");

  const panel = document.createElement("section");
  panel.classList.add("oprpg-tecnicas-panel");
  panel.innerHTML = `
    <h3 class="oprpg-title">
      <i class="fas fa-bolt" inert></i>
      <span>${_escapeHtml(PANEL_TITLE)}</span>
      <span class="oprpg-count">${tecnicas.length}</span>
    </h3>
    <ul class="oprpg-tecnica-list">
      ${rows}
    </ul>
  `;

  // Wire click handlers — fire item.use() so dnd5e handles consumption etc.
  panel.querySelectorAll(".oprpg-tecnica-use").forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const itemId = ev.currentTarget.closest(".oprpg-tecnica-row")?.dataset?.itemId;
      const item = itemId && actor.items.get(itemId);
      if (!item) return;
      try {
        await item.use();
      } catch (e) {
        warn(`Falha ao usar técnica '${item.name}':`, e);
        ui.notifications?.warn(`Não consegui usar '${item.name}': ${e.message}`);
      }
    });
  });

  if (!actor.isOwner) {
    panel.querySelectorAll("button").forEach(b => { b.disabled = true; });
  }

  anchor.insertAdjacentElement("afterend", panel);
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * API: bring an EXISTING character actor up to OP defaults without clobbering
 * any field the user has already set.
 * @param {Actor} actor
 * @returns {Promise<object>} the patch that was applied (may be empty)
 */
async function initializeCharacter(actor) {
  if (!actor) throw new Error("initializeCharacter: actor is required");
  if (actor.type !== "character") {
    warn(`initializeCharacter: '${actor.name}' is type '${actor.type}', skipping.`);
    return {};
  }
  const update = _buildResourceDefaults(actor);
  if (!Object.keys(update).length) {
    log(`initializeCharacter: '${actor.name}' already has resources set; nothing to do.`);
    return {};
  }
  await actor.update(update);
  log(`initializeCharacter: applied to '${actor.name}'`, update);
  return update;
}

/**
 * API: run initializeCharacter on every character actor in the world.
 * @returns {Promise<{updated: string[], skipped: string[]}>}
 */
async function initializeAllCharacters() {
  const updated = [];
  const skipped = [];
  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    const patch = await initializeCharacter(actor);
    if (Object.keys(patch).length) updated.push(actor.name);
    else skipped.push(actor.name);
  }
  log(`initializeAllCharacters: updated=${updated.length}, skipped=${skipped.length}`);
  return { updated, skipped };
}

/* -------------------------------------------- */
/*  Skills                                      */
/* -------------------------------------------- */

function applySkillOverrides() {
  const skills = CONFIG.DND5E.skills;
  if (!skills) {
    error("CONFIG.DND5E.skills missing.");
    return { ok: false };
  }

  const removed = [];
  // D&D skills with no OP equivalent.
  for (const key of ["arc", "ani", "rel"]) {
    if (skills[key]) {
      delete skills[key];
      removed.push(key);
    }
  }

  // Re-bind D&D skills to OP attribute associations.
  // OP attribute layout (labels via lang):
  //   int -> "Sabedoria" (D&D Intelligence)
  //   wis -> "Vontade"  (D&D Wisdom)
  //   cha -> "Presença" (D&D Charisma)
  //
  // OP groupings per Cap. 9:
  //   Força (str): Atletismo (ath)
  //   Destreza (dex): Acrobacia (acr), Furtividade (ste), Prestidigitação (slt)
  //   Sabedoria (int): História (his), Investigação (inv), Medicina (med),
  //                    Natureza (nat), Sobrevivência (sur)
  //   Vontade (wis): Haki (hak)*, Intuição (ins), Percepção (prc),
  //                  Sobrenatural (sob)*, Sorte (srt)*
  //   Presença (cha): Atuação (prf), Enganação (dec), Intimidação (itm),
  //                   Persuasão (per), Provocação (prv)*
  //   (* = added below)

  // D&D defaults wis for med and sur; OP places them under Sabedoria (int key).
  if (skills.med) skills.med.ability = "int";
  if (skills.sur) skills.sur.ability = "int";

  // Add OP-exclusive skills under Vontade (wis) and Presença (cha).
  const added = [];
  const newSkills = {
    hak: {
      label: "OPRPG.SkillHak",
      ability: "wis",
      fullKey: "haki",
      icon: "icons/magic/light/explosion-star-glow-yellow.webp"
    },
    sob: {
      label: "OPRPG.SkillSob",
      ability: "wis",
      fullKey: "supernatural",
      icon: "icons/magic/control/silhouette-aura-energy-purple.webp"
    },
    srt: {
      label: "OPRPG.SkillSrt",
      ability: "wis",
      fullKey: "luck",
      icon: "icons/sundries/gaming/dice-pair-white-green.webp"
    },
    prv: {
      label: "OPRPG.SkillPrv",
      ability: "cha",
      fullKey: "taunt",
      icon: "icons/skills/social/intimidation-impressing.webp"
    }
  };
  for (const [k, v] of Object.entries(newSkills)) {
    if (skills[k]) {
      warn(`Skill key '${k}' already exists; skipping add to avoid clobber.`);
      continue;
    }
    skills[k] = v;
    added.push(k);
  }

  return { ok: true, removed, added, rebound: ["med", "sur"] };
}

/* -------------------------------------------- */
/*  Damage Types                                */
/* -------------------------------------------- */

function applyDamageTypeOverrides() {
  const types = CONFIG.DND5E.damageTypes;
  if (!types) {
    error("CONFIG.DND5E.damageTypes missing.");
    return { ok: false };
  }

  const removed = [];
  // OP has no necrotic or radiant. Keep them mapped out so the GM doesn't
  // see "radiant" in attack dropdowns. (We don't delete the entry from the
  // config in case some compendium item still references it — instead we
  // could relabel, but removing matches OP rules cleanly.)
  for (const k of ["necrotic", "radiant"]) {
    if (types[k]) {
      delete types[k];
      removed.push(k);
    }
  }

  // Add Verdadeiro (true damage — bypasses resistance/vulnerability).
  // The dnd5e engine doesn't enforce "true damage" automatically; this is a
  // labelled type. Damage application bypass logic will come later via a hook.
  const added = [];
  if (!types.verdadeiro) {
    types.verdadeiro = {
      label: "OPRPG.DamageVerdadeiro",
      icon: "systems/dnd5e/icons/svg/damage/force.svg",
      color: globalThis.Color ? new Color(0xFFFFFF) : 0xFFFFFF
    };
    added.push("verdadeiro");
  }

  return { ok: true, removed, added };
}

/* -------------------------------------------- */
/*  Conditions                                  */
/* -------------------------------------------- */

function applyConditionOverrides() {
  const conditions = CONFIG.DND5E.conditionTypes;
  if (!conditions) {
    error("CONFIG.DND5E.conditionTypes missing.");
    return { ok: false };
  }

  // OP conditions that already exist in dnd5e under different names — just
  // relabeled by lang file:
  //   bleeding -> Sangramento
  //   burning  -> Queimado
  //   suffocation -> Sufocado
  //   grappled -> Agarrado
  //   prone    -> Caído
  //   ... etc.
  //
  // OP conditions that don't have a dnd5e equivalent — added below as
  // pseudo-conditions (status effects without rule enforcement).

  const added = [];
  const opOnly = {
    bebado: {
      name: "OPRPG.ConditionBebado",
      img: "icons/consumables/drinks/beer-stein-wooden-brown.webp",
      pseudo: true
    },
    empoderado: {
      name: "OPRPG.ConditionEmpoderado",
      img: "icons/magic/control/buff-strength-muscle-damage-orange.webp",
      pseudo: true
    },
    enfraquecido: {
      name: "OPRPG.ConditionEnfraquecido",
      img: "icons/magic/unholy/strike-body-explode-disintegrate.webp",
      pseudo: true,
      statuses: ["incapacitated"]
    },
    enfurecido: {
      name: "OPRPG.ConditionEnfurecido",
      img: "icons/magic/control/fear-fright-shadow-monster-red.webp",
      pseudo: true
    },
    estremecido: {
      name: "OPRPG.ConditionEstremecido",
      img: "icons/magic/control/silhouette-fear-shake.webp",
      pseudo: true
    },
    letargico: {
      name: "OPRPG.ConditionLetargico",
      img: "icons/magic/control/buff-strength-muscle-damage-blue.webp",
      pseudo: true
    },
    sonolento: {
      name: "OPRPG.ConditionSonolento",
      img: "icons/magic/control/sleep-trance-magenta.webp",
      pseudo: true
    }
  };

  for (const [key, value] of Object.entries(opOnly)) {
    if (conditions[key]) {
      warn(`Condition key '${key}' already exists; skipping.`);
      continue;
    }
    conditions[key] = value;
    added.push(key);
  }

  return { ok: true, added };
}

/* -------------------------------------------- */
/*  Encumbrance (Carga / Sobrecarga)            */
/* -------------------------------------------- */

function applyEncumbranceOverrides() {
  const enc = CONFIG.DND5E.encumbrance;
  if (!enc?.threshold) {
    error("CONFIG.DND5E.encumbrance.threshold missing.");
    return { ok: false };
  }

  // OP rules (Cap. 9 - Força):
  //   Capacidade de Carga (máximo) = Força × 10
  //   Sobrecarga      (encumbered)       > Força × 3 -> -3 m deslocamento
  //   Sobrecarga Pesada (heavilyEncumbered) > Força × 6 -> -6 m deslocamento, desvantagem
  //
  // dnd5e stores these as multipliers per unit system (imperial uses lb, metric uses kg).
  // OP uses kg in the metric branch.
  const before = JSON.parse(JSON.stringify(enc.threshold));

  enc.threshold.encumbered.imperial = 3;
  enc.threshold.encumbered.metric = 3;
  enc.threshold.heavilyEncumbered.imperial = 6;
  enc.threshold.heavilyEncumbered.metric = 6;
  enc.threshold.maximum.imperial = 10;
  enc.threshold.maximum.metric = 10;

  return { ok: true, before, after: JSON.parse(JSON.stringify(enc.threshold)) };
}

/* -------------------------------------------- */
/*  Currencies (Beli)                           */
/* -------------------------------------------- */

function applyCurrencyOverrides() {
  // Replace D&D coins (pp/gp/ep/sp/cp) with a single Beli currency.
  // This is destructive: existing items priced in gp will show 0 Beli unless
  // we also migrate. For a new world this is fine.
  CONFIG.DND5E.currencies = {
    beli: {
      label: "OPRPG.CurrencyBeli",
      abbreviation: "OPRPG.CurrencyBeliAbbr",
      conversion: 1,
      icon: "systems/dnd5e/icons/currency/gold.webp"
    }
  };
  CONFIG.DND5E.defaultCurrency = "beli";

  return { ok: true, currencies: Object.keys(CONFIG.DND5E.currencies) };
}

/* -------------------------------------------- */
/*  Activation: Ação Poderosa                   */
/* -------------------------------------------- */

function applyActivationOverrides() {
  const acts = CONFIG.DND5E.activityActivationTypes;
  if (!acts) {
    error("CONFIG.DND5E.activityActivationTypes missing.");
    return { ok: false };
  }

  if (acts.actionPoderosa) {
    return { ok: true, note: "actionPoderosa already present, no change." };
  }

  // OP "Ação Poderosa" is the spell-action slot specifically for Técnicas.
  // Foundry doesn't enforce action economy by itself, so this is mainly
  // a categorisation/label so Técnicas show up with the right activation
  // header on the sheet.
  acts.actionPoderosa = {
    label: "OPRPG.ActivationActionPoderosa",
    header: "OPRPG.ActivationActionPoderosaHeader",
    group: "DND5E.ACTIVATION.Category.Standard"
  };

  return { ok: true, added: ["actionPoderosa"] };
}

/* -------------------------------------------- */
/*  Tabs (hide D&D-only tabs from character sheet) */
/* -------------------------------------------- */

const HIDDEN_CHARACTER_TABS = new Set(["spells", "bastion"]);

function applyTabsOverride() {
  const sheetClass = globalThis.dnd5e?.applications?.actor?.CharacterActorSheet;
  if (!sheetClass) {
    warn("dnd5e.applications.actor.CharacterActorSheet not exposed; tabs override skipped.");
    return { ok: false, reason: "class not found" };
  }
  if (!Array.isArray(sheetClass.TABS)) {
    warn("CharacterActorSheet.TABS is not an array; skipping.");
    return { ok: false, reason: "TABS not array" };
  }

  const hidden = [];
  for (const tab of sheetClass.TABS) {
    if (HIDDEN_CHARACTER_TABS.has(tab.tab)) {
      // Wrap with a condition that always returns false. dnd5e's _getTabs()
      // filters out entries whose condition returns falsy.
      tab.condition = () => false;
      hidden.push(tab.tab);
    }
  }

  return { ok: true, hidden };
}

/* -------------------------------------------- */
/*  OP Feature types + custom sections          */
/* -------------------------------------------- */

/**
 * Definition of OP-specific feature categories. The `key` matches what gets
 * stored in `item.system.type.value` and what we route into ctx.groups.origin.
 * The `order` controls placement on the Features tab (sandwich between class
 * sections (~100-N00) and "Other" (3000), so OP categories live around 1500-1600).
 */
const OP_FEATURE_DEFS = [
  { key: "tecnicaCombate",   label: "OPRPG.FeatureType.TecnicaCombate",   order: 1500 },
  { key: "tecnicaAuxiliar",  label: "OPRPG.FeatureType.TecnicaAuxiliar",  order: 1510 },
  { key: "manifestacaoPoder",label: "OPRPG.FeatureType.ManifestacaoPoder",order: 1520 },
  { key: "akumaNoMi",        label: "OPRPG.FeatureType.AkumaNoMi",        order: 1530 },
  { key: "habilidadeHaki",   label: "OPRPG.FeatureType.HabilidadeHaki",   order: 1540 },
  { key: "codigoHonra",      label: "OPRPG.FeatureType.CodigoHonra",      order: 1550 },
  { key: "singularidade",    label: "OPRPG.FeatureType.Singularidade",    order: 1560 },
  { key: "defeito",          label: "OPRPG.FeatureType.Defeito",          order: 1570 }
];
const OP_FEATURE_TYPES_SET = new Set(OP_FEATURE_DEFS.map(d => d.key));

function applyFeatureTypesOverride() {
  const featureTypes = CONFIG.DND5E.featureTypes;
  if (!featureTypes) {
    error("CONFIG.DND5E.featureTypes missing.");
    return { ok: false };
  }

  const added = [];
  // Top-level OP categories: each becomes a selectable type on the feat sheet.
  featureTypes.tecnicaCombate    = { label: "OPRPG.FeatureType.TecnicaCombate" };
  featureTypes.tecnicaAuxiliar   = { label: "OPRPG.FeatureType.TecnicaAuxiliar" };
  featureTypes.manifestacaoPoder = { label: "OPRPG.FeatureType.ManifestacaoPoder" };
  featureTypes.akumaNoMi = {
    label: "OPRPG.FeatureType.AkumaNoMi",
    subtypes: {
      logia:         "OPRPG.AkumaSubtype.Logia",
      paramecia:     "OPRPG.AkumaSubtype.Paramecia",
      zoanComum:     "OPRPG.AkumaSubtype.ZoanComum",
      zoanAncestral: "OPRPG.AkumaSubtype.ZoanAncestral",
      zoanMitica:    "OPRPG.AkumaSubtype.ZoanMitica"
    }
  };
  featureTypes.habilidadeHaki = {
    label: "OPRPG.FeatureType.HabilidadeHaki",
    subtypes: {
      armamento:  "OPRPG.HakiSubtype.Armamento",
      observacao: "OPRPG.HakiSubtype.Observacao",
      rei:        "OPRPG.HakiSubtype.Rei"
    }
  };
  featureTypes.codigoHonra   = { label: "OPRPG.FeatureType.CodigoHonra" };
  featureTypes.singularidade = { label: "OPRPG.FeatureType.Singularidade" };
  featureTypes.defeito       = { label: "OPRPG.FeatureType.Defeito" };

  added.push(...OP_FEATURE_DEFS.map(d => d.key));
  return { ok: true, added };
}

/**
 * Wrap CharacterActorSheet methods so OP-typed features show up under
 * dedicated sections (Técnicas de Combate, Akuma no Mi, etc.) instead of
 * being lumped into "Other Features".
 */
function applyFeatureSectionsOverride() {
  const sheetClass = globalThis.dnd5e?.applications?.actor?.CharacterActorSheet;
  if (!sheetClass) {
    // Detailed diagnostics — try multiple known paths and report what we found.
    const present = {
      "globalThis.dnd5e": !!globalThis.dnd5e,
      "globalThis.dnd5e.applications": !!globalThis.dnd5e?.applications,
      "globalThis.dnd5e.applications.actor": !!globalThis.dnd5e?.applications?.actor,
      "applications.actor keys": Object.keys(globalThis.dnd5e?.applications?.actor ?? {})
    };
    warn("CharacterActorSheet not exposed; feature sections override skipped.", present);
    return { ok: false, reason: "class not found", diagnostics: present };
  }

  const proto = sheetClass.prototype;

  // ---- Wrap _prepareItemFeature: assign OP origin to OP-typed items ----
  const origPrepareItem = proto._prepareItemFeature;
  if (typeof origPrepareItem !== "function") {
    warn("CharacterActorSheet._prepareItemFeature missing; can't wire item -> section.");
    return { ok: false, reason: "_prepareItemFeature missing" };
  }
  if (origPrepareItem.__oprpgWrapped) {
    return { ok: true, note: "already wrapped" };
  }
  proto._prepareItemFeature = async function(item, ctx) {
    await origPrepareItem.call(this, item, ctx);
    const opType = item.system?.type?.value;
    if (opType && OP_FEATURE_TYPES_SET.has(opType)) {
      // Route this item to our OP section by overriding its origin group.
      ctx.groups ??= {};
      ctx.groups.origin = `oprpg-${opType}`;
    }
  };
  proto._prepareItemFeature.__oprpgWrapped = true;

  // ---- Wrap _prepareFeaturesContext: inject OP sections ----
  const origPrepareCtx = proto._prepareFeaturesContext;
  if (typeof origPrepareCtx !== "function") {
    warn("CharacterActorSheet._prepareFeaturesContext missing; can't add OP sections.");
    return { ok: false, reason: "_prepareFeaturesContext missing" };
  }
  if (origPrepareCtx.__oprpgWrapped) {
    return { ok: true, note: "already wrapped (ctx)" };
  }
  proto._prepareFeaturesContext = async function(context, options) {
    const result = await origPrepareCtx.call(this, context, options);

    const InventoryEl = customElements.get(this.options?.elements?.inventory ?? "dnd5e-inventory");
    if (!InventoryEl?.mapColumns) return result;

    // Reuse the same column layout as the base "other" section so OP sections
    // render columns consistently (Uses / Recovery / Controls).
    const baseSection = result.sections?.find(s => s.id === "other") ?? result.sections?.[0];
    const columns = baseSection?.columns ?? InventoryEl.mapColumns([{ id: "uses", order: 200 }, "recovery", "controls"]);

    const opSections = OP_FEATURE_DEFS.map(def => ({
      columns,
      id: `oprpg-${def.key}`,
      label: def.label,
      order: def.order,
      groups: { origin: `oprpg-${def.key}` },
      dataset: { "group-origin": `oprpg-${def.key}` },
      items: []
    }));

    // Merge and resort by order.
    result.sections = [...(result.sections ?? []), ...opSections]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return result;
  };
  proto._prepareFeaturesContext.__oprpgWrapped = true;

  return { ok: true, sections: OP_FEATURE_DEFS.map(d => d.key) };
}

/* -------------------------------------------- */
/*  Sanity check (runs at 'ready')              */
/* -------------------------------------------- */

function sanityCheck() {
  const problems = [];
  const checks = [];

  const skills = CONFIG.DND5E.skills ?? {};
  for (const key of ["hak", "sob", "srt", "prv"]) {
    if (!skills[key]) problems.push(`Skill '${key}' missing after init.`);
  }
  for (const key of ["arc", "ani", "rel"]) {
    if (skills[key]) problems.push(`Skill '${key}' should have been removed.`);
  }
  checks.push(`Skills present: ${Object.keys(skills).length}`);

  const dt = CONFIG.DND5E.damageTypes ?? {};
  if (!dt.verdadeiro) problems.push("Damage type 'verdadeiro' missing.");
  if (dt.necrotic) problems.push("Damage type 'necrotic' should be removed.");
  if (dt.radiant) problems.push("Damage type 'radiant' should be removed.");
  checks.push(`Damage types present: ${Object.keys(dt).length}`);

  const cond = CONFIG.DND5E.conditionTypes ?? {};
  for (const key of ["bebado", "empoderado", "enfraquecido", "enfurecido", "estremecido", "letargico", "sonolento"]) {
    if (!cond[key]) problems.push(`Condition '${key}' missing.`);
  }
  checks.push(`Condition types present: ${Object.keys(cond).length}`);

  const curr = CONFIG.DND5E.currencies ?? {};
  if (!curr.beli) problems.push("Currency 'beli' missing.");
  if (curr.gp) problems.push("Currency 'gp' should have been removed.");

  const enc = CONFIG.DND5E.encumbrance?.threshold ?? {};
  if (enc.maximum?.metric !== 10) problems.push(`Encumbrance maximum.metric expected 10, got ${enc.maximum?.metric}.`);
  if (enc.heavilyEncumbered?.metric !== 6) problems.push(`Encumbrance heavilyEncumbered.metric expected 6, got ${enc.heavilyEncumbered?.metric}.`);
  if (enc.encumbered?.metric !== 3) problems.push(`Encumbrance encumbered.metric expected 3, got ${enc.encumbered?.metric}.`);

  const acts = CONFIG.DND5E.activityActivationTypes ?? {};
  if (!acts.actionPoderosa) problems.push("Activation 'actionPoderosa' missing.");

  // Hook bound?
  const preCreateActorBound = Hooks.events?.preCreateActor?.some(h => h?.fn === _onPreCreateActor);
  if (preCreateActorBound === false) {
    problems.push("Hook 'preCreateActor' is not bound to _onPreCreateActor.");
  }

  // Consumption type 'attribute' must exist for Técnica → PP economy.
  const consumption = CONFIG.DND5E.activityConsumptionTypes ?? {};
  if (!consumption.attribute) {
    problems.push("CONFIG.DND5E.activityConsumptionTypes.attribute missing (Técnicas can't consume PP).");
  }

  // API exposed?
  const api = game.modules.get(MODULE_ID)?.api;
  if (!api?.initializeCharacter) problems.push("Module API not exposed.");

  // Tabs hidden?
  const sheetClass = globalThis.dnd5e?.applications?.actor?.CharacterActorSheet;
  if (sheetClass?.TABS) {
    for (const tabKey of HIDDEN_CHARACTER_TABS) {
      const tab = sheetClass.TABS.find(t => t.tab === tabKey);
      if (!tab) {
        problems.push(`Expected tab '${tabKey}' to still exist on the class (just hidden), but it's missing entirely.`);
      } else if (!tab.condition || tab.condition() !== false) {
        problems.push(`Tab '${tabKey}' is not being hidden as expected.`);
      }
    }
  }

  // Feature types registered?
  const ft = CONFIG.DND5E.featureTypes ?? {};
  for (const def of OP_FEATURE_DEFS) {
    if (!ft[def.key]) problems.push(`Feature type '${def.key}' missing.`);
  }

  // Sheet method wraps installed?
  if (sheetClass?.prototype) {
    if (!sheetClass.prototype._prepareItemFeature?.__oprpgWrapped) {
      problems.push("_prepareItemFeature wrap missing — OP items won't route to OP sections.");
    }
    if (!sheetClass.prototype._prepareFeaturesContext?.__oprpgWrapped) {
      problems.push("_prepareFeaturesContext wrap missing — OP sections won't appear.");
    }
  }

  // Settings registered?
  const requiredSettings = [
    "ruleMotivacao", "ruleGuerreirosPiratas", "ruleFerimentosPersistentes", "ruleCombateSubmerso",
    "danoVerdadeiroBypass", "showBountyPanel", "showHakiPanel", "showTecnicasPanel"
  ];
  for (const key of requiredSettings) {
    if (game.settings.settings.get(`${MODULE_ID}.${key}`) === undefined) {
      problems.push(`Setting '${key}' not registered.`);
    }
  }

  return { problems, checks };
}
