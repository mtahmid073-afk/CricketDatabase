const JSON_FILE_PATH = "data/players.json";

let allPlayers = [];
let filteredPlayers = [];

let currentSort = {
  key: null,
  direction: "asc"
};

const playerTableBody = document.getElementById("playerTableBody");
const playerCount = document.getElementById("playerCount");
const searchInput = document.getElementById("searchInput");
const nationFilter = document.getElementById("nationFilter");
const roleFilter = document.getElementById("roleFilter");
const resetBtn = document.getElementById("resetBtn");

const PLAYER_EDITOR_STORAGE_KEY = "cm25_database_player_edits_v1";
let editingPlayerId = null;
const ORIGINAL_PLAYER_COPY_BY_ID = new Map();

const playerModal = document.getElementById("playerModal");
const modalContent = document.getElementById("modalContent");
const closeModalBtn = document.getElementById("closeModalBtn");

const BATTING_STYLE_CODES = {
  "Opener - Slogger": "O-SLG",
  "Opener - Balanced": "O-BAL",
  "Opener - Anchor": "O-ANC",
  "Top Order - Slogger": "T-SLG",
  "Top Order - Balanced": "T-BAL",
  "Top Order - Anchor": "T-ANC",
  "Middle Order - Slogger": "M-SLG",
  "Middle Order - Balanced": "M-BAL",
  "Middle Order - Anchor": "M-ANC",
  "Lower Order - Slogger": "L-SLG",
  "Lower Order - Balanced": "L-BAL",
  "Lower Order - Anchor": "L-ANC",
  "Finisher": "S-FIN",
  "Runner": "S-RUN",
  "Pinch-Hitter": "S-PNH",
  "Wall": "S-WAL"
};

const BOWLING_STYLE_CODES = {
  "Swing Bowler": "P-SWG",
  "Hit-the-Deck Seamer": "P-HTD",
  "Short-Ball Specialist": "P-SBS",
  "Death Specialist": "P-DTH",
  "Classical Spinner": "S-CLS",
  "Flat Spinner": "S-FLT",
  "Mystery Spinner": "S-MYS",
  "Containment Spinner": "S-CTN"
};

const FIELD_NAMES = {
  name: ["name", "player", "playerName", "player_name", "fullName", "full_name", "displayName"],
  age: ["age"],
  nation: ["nation", "nationality", "country", "teamCountry", "team_country"],
  role: ["role", "playerRole", "player_role", "typeRole"],
  hand: ["hand", "battingHand", "batting_hand", "bat_hand", "batHand", "dominantHand"],
  bowlingType: ["type", "bowlingType", "bowling_type", "bowlerType", "bowlType", "bowl_type"],
  style: ["style", "bowlingStyle", "bowling_style", "mainStyle", "main_style", "bowlingStyleAbbrev"]
};

async function loadPlayers() {
  try {
    const response = await fetch(JSON_FILE_PATH);

    if (!response.ok) {
      throw new Error("Could not load players.json");
    }

    const rawData = await response.json();

    allPlayers = normalizePlayers(rawData).map((player, index) => ({
      ...player,
      id: String(player.id ?? player.playerId ?? player.player_id ?? `player_${index}`)
    }));

    snapshotOriginalPlayers();
    applySavedPlayerEdits();

    filteredPlayers = [...allPlayers];

    buildFilters();
    renderTable(filteredPlayers);
    updateSortButtons();
  } catch (error) {
    console.error(error);

    playerTableBody.innerHTML = `
      <tr>
        <td colspan="10">
          Could not load JSON file. Make sure your file is at:
          <strong>data/players.json</strong>
          and you are running a local server.
        </td>
      </tr>
    `;
  }
}

function normalizePlayers(rawData) {
  if (Array.isArray(rawData)) return rawData;
  if (rawData.players && Array.isArray(rawData.players)) return rawData.players;
  if (rawData.data && Array.isArray(rawData.data)) return rawData.data;

  for (const key in rawData) {
    if (Array.isArray(rawData[key])) return rawData[key];
  }

  if (typeof rawData === "object" && rawData !== null) {
    return Object.entries(rawData).map(([id, player]) => {
      if (typeof player === "object" && player !== null) {
        return { id, ...player };
      }
      return { id, value: player };
    });
  }

  return [];
}

function getField(player, possibleNames) {
  for (const fieldName of possibleNames) {
    if (player[fieldName] !== undefined && player[fieldName] !== null && player[fieldName] !== "") {
      return player[fieldName];
    }
  }

  return "-";
}

function roundRating(rating) {
  if (rating === undefined || rating === null || rating === "") return "-";
  return Math.round(Number(rating));
}

function isNoBowlingValue(value) {
  const text = String(value ?? "").trim().toLowerCase();

  return (
    text === "" ||
    text === "-" ||
    text === "null" ||
    text === "none" ||
    text === "n/a" ||
    text === "does not bowl" ||
    text === "does not bowl (0)"
  );
}

function cleanBowlingDisplay(value) {
  return isNoBowlingValue(value) ? "-" : value;
}

function getTopPlaystyle(player, category) {
  if (
    player.topPlaystyles?.[category] &&
    Array.isArray(player.topPlaystyles[category]) &&
    player.topPlaystyles[category].length > 0
  ) {
    const first = player.topPlaystyles[category][0];

    if (category === "bowling" && isNoBowlingValue(first?.name)) {
      return null;
    }

    return first;
  }

  if (player.primaryPlaystyle?.[category] && player.playstyleRatings?.[category]) {
    const styleName = player.primaryPlaystyle[category];

    if (category === "bowling" && isNoBowlingValue(styleName)) {
      return null;
    }

    return { name: styleName, rating: player.playstyleRatings[category][styleName] };
  }

  if (player.playstyleRatings?.[category]) {
    const ratings = player.playstyleRatings[category];
    let bestName = null;
    let bestRating = -1;

    for (const styleName in ratings) {
      if (category === "bowling" && isNoBowlingValue(styleName)) continue;

      const rating = Number(ratings[styleName]);

      if (Number.isFinite(rating) && rating > bestRating) {
        bestName = styleName;
        bestRating = rating;
      }
    }

    if (bestName !== null) return { name: bestName, rating: bestRating };
  }

  return null;
}

function getTopThreePlaystyles(player, category) {
  let playstyles = [];

  if (player.topPlaystyles?.[category] && Array.isArray(player.topPlaystyles[category])) {
    playstyles = player.topPlaystyles[category].slice(0, 3);
  } else if (player.playstyleRatings?.[category]) {
    playstyles = Object.entries(player.playstyleRatings[category])
      .map(([name, rating]) => ({ name, rating }))
      .filter((item) => item.rating !== null && item.rating !== undefined)
      .sort((a, b) => Number(b.rating) - Number(a.rating))
      .slice(0, 3);
  }

  if (category === "bowling") {
    playstyles = playstyles.filter((item) => !isNoBowlingValue(item.name) && Number(item.rating) > 0);
  }

  return playstyles;
}

function getBatStyle(player) {
  const topBatting = getTopPlaystyle(player, "batting");
  if (!topBatting) return "-";

  const code = BATTING_STYLE_CODES[topBatting.name] || topBatting.name;
  return `${code} (${roundRating(topBatting.rating)})`;
}

function getBowlStyle(player) {
  const topBowling = getTopPlaystyle(player, "bowling");

  if (!topBowling || isNoBowlingValue(topBowling.name)) return "-";

  const rating = roundRating(topBowling.rating);
  if (rating === "-" || Number(rating) <= 0) return "-";

  const code = BOWLING_STYLE_CODES[topBowling.name] || topBowling.name;
  return `${code} (${rating})`;
}

function getFieldStyle(player) {
  const topFielding = getTopPlaystyle(player, "fielding");
  if (!topFielding) return "-";

  const rating = roundRating(topFielding.rating);

  if (Number(rating) >= 60) return `WKP (${rating})`;
  return `Fielder (${rating})`;
}

function getBatStyleTooltip(player) {
  const topBatting = getTopPlaystyle(player, "batting");
  if (!topBatting) return "";

  const code = BATTING_STYLE_CODES[topBatting.name] || topBatting.name;
  return `${code} = ${topBatting.name}`;
}

function getBowlStyleTooltip(player) {
  const topBowling = getTopPlaystyle(player, "bowling");
  if (!topBowling || isNoBowlingValue(topBowling.name)) return "";

  const code = BOWLING_STYLE_CODES[topBowling.name] || topBowling.name;
  return `${code} = ${topBowling.name}`;
}

function getBatStyleClass(player) {
  const topBatting = getTopPlaystyle(player, "batting");
  if (!topBatting) return "ps-none";

  const name = topBatting.name;

  if (name.includes("Slogger")) return "ps-slogger";
  if (name.includes("Balanced")) return "ps-balanced";
  if (name.includes("Anchor")) return "ps-anchor";
  if (name === "Finisher") return "ps-finisher";
  if (name === "Runner") return "ps-runner";
  if (name === "Pinch-Hitter") return "ps-pinch";
  if (name === "Wall") return "ps-wall";

  return "ps-none";
}

function getBowlStyleClass(player) {
  const topBowling = getTopPlaystyle(player, "bowling");
  if (!topBowling || isNoBowlingValue(topBowling.name)) return "ps-none";

  const name = topBowling.name;

  if (name === "Swing Bowler") return "ps-swing";
  if (name === "Hit-the-Deck Seamer") return "ps-hitdeck";
  if (name === "Short-Ball Specialist") return "ps-shortball";
  if (name === "Death Specialist") return "ps-death";
  if (name === "Classical Spinner") return "ps-classical";
  if (name === "Flat Spinner") return "ps-flat";
  if (name === "Mystery Spinner") return "ps-mystery";
  if (name === "Containment Spinner") return "ps-containment";

  return "ps-none";
}

function getFieldStyleClass(player) {
  const topFielding = getTopPlaystyle(player, "fielding");
  if (!topFielding) return "ps-none";

  const rating = roundRating(topFielding.rating);

  if (Number(rating) >= 60) return "ps-wicketkeeper";
  return "ps-fielder";
}

function getDisplayPlayer(player) {
  return {
    name: getField(player, FIELD_NAMES.name),
    age: getField(player, FIELD_NAMES.age),
    nation: getField(player, FIELD_NAMES.nation),
    role: getField(player, FIELD_NAMES.role),
    hand: getField(player, FIELD_NAMES.hand),
    bowlingType: cleanBowlingDisplay(getField(player, FIELD_NAMES.bowlingType)),
    style: cleanBowlingDisplay(getField(player, FIELD_NAMES.style)),
    batStyle: getBatStyle(player),
    bowlStyle: getBowlStyle(player),
    fieldStyle: getFieldStyle(player),
    batStyleTooltip: getBatStyleTooltip(player),
    bowlStyleTooltip: getBowlStyleTooltip(player),
    batStyleClass: getBatStyleClass(player),
    bowlStyleClass: getBowlStyleClass(player),
    fieldStyleClass: getFieldStyleClass(player)
  };
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatLabel(text) {
  if (!text) return "-";

  return String(text)
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^./, firstLetter => firstLetter.toUpperCase());
}

function extractNumberFromStyle(value) {
  const text = String(value);
  const match = text.match(/\((\d+)\)/);

  if (match) return Number(match[1]);
  return 0;
}

function getPlayerOverall(player) {
  const role = String(getField(player, FIELD_NAMES.role)).toLowerCase();
  const battingOverall = Number(player.attributes?.overall?.batting_overall) || 0;
  const bowlingOverall = Number(player.attributes?.overall?.bowling_overall) || 0;

  if (role.includes("all-rounder") || role.includes("all rounder")) {
    const higherOverall = Math.max(battingOverall, bowlingOverall);
    const lowerOverall = Math.min(battingOverall, bowlingOverall);
    const boostedLowerOverall = lowerOverall * 1.3;
    const allRounderOverall = (higherOverall + boostedLowerOverall) / 2;
    return Math.min(allRounderOverall, 20);
  }

  if (role.includes("bowler") || role.includes("bowl")) return Math.min(bowlingOverall, 20);
  if (role.includes("wicket") || role.includes("keeper")) return Math.min(battingOverall, 20);
  if (role.includes("batsman") || role.includes("batter") || role.includes("bat")) return Math.min(battingOverall, 20);

  return Math.min(Math.max(battingOverall, bowlingOverall), 20);
}

function renderStarRating(overallNumber) {
  const maxOverall = 20;
  const maxStars = 5;
  const safeOverall = Math.max(0, Math.min(Number(overallNumber) || 0, maxOverall));
  const starValue = safeOverall / 4;
  let starsHTML = "";

  for (let i = 1; i <= maxStars; i++) {
    let fillPercent = 0;

    if (starValue >= i) fillPercent = 100;
    else if (starValue > i - 1) fillPercent = (starValue - (i - 1)) * 100;

    starsHTML += `<span class="star"><span class="star-fill" style="width: ${fillPercent}%"></span></span>`;
  }

  return `<span class="overall-star-box" title="Overall star rating"><span class="star-rating">${starsHTML}</span></span>`;
}

function getVisibleSectionsByRole(role) {
  const normalizedRole = String(role).toLowerCase();

  if (normalizedRole.includes("all-rounder") || normalizedRole.includes("all rounder")) {
    return { playstyles: ["batting", "bowling"], attributes: ["batting", "bowling"] };
  }

  if (normalizedRole.includes("wicket") || normalizedRole.includes("keeper")) {
    return { playstyles: ["batting", "fielding"], attributes: ["batting", "fielding"] };
  }

  if (normalizedRole.includes("bowler") || normalizedRole.includes("bowl")) {
    return { playstyles: ["bowling", "fielding"], attributes: ["bowling", "fielding"] };
  }

  if (normalizedRole.includes("batsman") || normalizedRole.includes("batter") || normalizedRole.includes("bat")) {
    return { playstyles: ["batting", "fielding"], attributes: ["batting", "fielding"] };
  }

  return { playstyles: ["batting", "fielding"], attributes: ["batting", "fielding"] };
}

function renderTable(players) {
  playerCount.textContent = players.length;

  if (players.length === 0) {
    playerTableBody.innerHTML = `<tr><td colspan="10">No players found.</td></tr>`;
    return;
  }

  playerTableBody.innerHTML = "";

  players.forEach((player) => {
    const display = getDisplayPlayer(player);
    const row = document.createElement("tr");

    row.innerHTML = `
      <td class="player-name"><button class="player-link">${escapeHTML(display.name)}</button></td>
      <td>${escapeHTML(display.age)}</td>
      <td>${escapeHTML(display.nation)}</td>
      <td><span class="badge">${escapeHTML(display.role)}</span></td>
      <td>${escapeHTML(display.hand)}</td>
      <td>${escapeHTML(display.bowlingType)}</td>
      <td>${escapeHTML(display.style)}</td>
      <td title="${escapeHTML(display.batStyleTooltip)}"><span class="playstyle-pill ${display.batStyleClass}">${escapeHTML(display.batStyle)}</span></td>
      <td title="${escapeHTML(display.bowlStyleTooltip)}"><span class="playstyle-pill ${display.bowlStyleClass}">${escapeHTML(display.bowlStyle)}</span></td>
      <td><span class="playstyle-pill ${display.fieldStyleClass}">${escapeHTML(display.fieldStyle)}</span></td>
    `;

    row.querySelector(".player-link").addEventListener("click", () => openPlayerModal(player));
    playerTableBody.appendChild(row);
  });
}

function renderPlaystyleRows(playstyles) {
  if (!playstyles || playstyles.length === 0) return `<p>-</p>`;

  return playstyles.map((style, index) => {
    const star = index === 0 ? "★ " : "";
    const rating = roundRating(style.rating);
    return `<div class="playstyle-row"><span>${star}${escapeHTML(style.name)}</span><span class="rating">${escapeHTML(rating)}</span></div>`;
  }).join("");
}

function renderProfileCard(title, playstyles, className) {
  return `<div class="profile-card ${className}"><h3>${escapeHTML(title)}</h3>${renderPlaystyleRows(playstyles)}</div>`;
}

function renderAttributeGroup(title, attributes, className) {
  if (!attributes) return "";

  const items = Object.entries(attributes).map(([key, value]) => {
    return `<div class="attribute-item"><span class="attribute-name">${escapeHTML(formatLabel(key))}</span><span class="attribute-value">${escapeHTML(value)}</span></div>`;
  }).join("");

  return `<div class="attribute-group ${className}"><h4>${escapeHTML(title)}</h4><div class="attribute-list">${items}</div></div>`;
}

function openPlayerModal(player) {
  const display = getDisplayPlayer(player);
  const visibleSections = getVisibleSectionsByRole(display.role);
  const overallNumber = getPlayerOverall(player);

  const battingPlaystyles = getTopThreePlaystyles(player, "batting");
  const bowlingPlaystyles = getTopThreePlaystyles(player, "bowling");
  const fieldingPlaystyles = getTopThreePlaystyles(player, "fielding");

  const battingAttributes = player.attributes?.batting;
  const bowlingAttributes = player.attributes?.bowling;
  const fieldingAttributes = player.attributes?.fielding;

  let profileCardsHTML = "";
  if (visibleSections.playstyles.includes("batting")) profileCardsHTML += renderProfileCard("Top Batting Playstyles", battingPlaystyles, "batting");
  if (visibleSections.playstyles.includes("bowling")) profileCardsHTML += renderProfileCard("Top Bowling Playstyles", bowlingPlaystyles, "bowling");
  if (visibleSections.playstyles.includes("fielding")) profileCardsHTML += renderProfileCard("Top Fielding Playstyles", fieldingPlaystyles, "fielding");

  let attributesHTML = "";
  if (visibleSections.attributes.includes("batting")) attributesHTML += renderAttributeGroup("Batting", battingAttributes, "batting");
  if (visibleSections.attributes.includes("bowling")) attributesHTML += renderAttributeGroup("Bowling", bowlingAttributes, "bowling");
  if (visibleSections.attributes.includes("fielding")) attributesHTML += renderAttributeGroup("Fielding", fieldingAttributes, "fielding");

  modalContent.innerHTML = `
    <div class="player-profile-header">
      <div class="player-profile-title-row">
        <h2>${escapeHTML(display.name)}</h2>
        <button class="db-edit-player-btn" onclick="openPlayerEditor('${escapeHTML(player.id)}')">
          Edit Player
        </button>
      </div>

      <div class="player-meta">
        <span class="meta-badge">${escapeHTML(display.role)}</span>
        ${renderStarRating(overallNumber)}
        <span>${escapeHTML(display.nation)}</span>
        <span>${escapeHTML(display.age)} years</span>
        <span>Bats: ${escapeHTML(display.hand)}</span>
        <span>Bowls: ${escapeHTML(display.style)}</span>
      </div>
    </div>

    <div class="profile-grid">${profileCardsHTML}</div>

    <div class="attributes-section">
      <h3>Attributes</h3>
      <div class="attributes-grid">${attributesHTML}</div>
    </div>
  `;

  playerModal.classList.remove("hidden");
}

function closePlayerModal() {
  playerModal.classList.add("hidden");
}

/* =========================================================
   PLAYER EDITOR MODAL
========================================================= */

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function snapshotOriginalPlayers() {
  allPlayers.forEach((player) => {
    const id = String(player.id);

    if (!ORIGINAL_PLAYER_COPY_BY_ID.has(id)) {
      ORIGINAL_PLAYER_COPY_BY_ID.set(id, deepClone(player));
    }
  });
}

function getSavedPlayerEdits() {
  const raw = localStorage.getItem(PLAYER_EDITOR_STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) || {};
  } catch (error) {
    console.error("Could not read saved player edits:", error);
    return {};
  }
}

function writeSavedPlayerEdits(edits) {
  localStorage.setItem(PLAYER_EDITOR_STORAGE_KEY, JSON.stringify(edits));
}

function applySavedPlayerEdits() {
  const edits = getSavedPlayerEdits();

  allPlayers = allPlayers.map((player) => {
    const edited = edits[String(player.id)];
    return edited ? edited : player;
  });
}

function findEditorPlayerById(playerId) {
  return allPlayers.find((player) => String(player.id) === String(playerId));
}

function getNestedValue(obj, path, fallback = "") {
  const value = path.split(".").reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, obj);

  return value === undefined || value === null ? fallback : value;
}

function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  let current = obj;

  keys.slice(0, -1).forEach((key) => {
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }

    current = current[key];
  });

  current[keys[keys.length - 1]] = value;
}

function normalizeEditorValue(value, type) {
  if (value === "" || value === "__NULL__") return null;

  if (type === "number") {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  if (type === "boolean") {
    return value === "true";
  }

  return value;
}

function editorOptions(options, currentValue) {
  return options.map((option) => {
    const selected = String(currentValue) === String(option.value) ? "selected" : "";

    return `
      <option value="${escapeHTML(option.value)}" ${selected}>
        ${escapeHTML(option.label)}
      </option>
    `;
  }).join("");
}

function editorField(label, path, type = "text", options = null) {
  const player = findEditorPlayerById(editingPlayerId);
  const value = getNestedValue(player, path, "");
  const safeValue = value === "" || value === null ? "__NULL__" : value;

  if (options) {
    return `
      <label class="editor-field">
        <span>${escapeHTML(label)}</span>
        <select data-edit-path="${escapeHTML(path)}" data-edit-type="${escapeHTML(type)}">
          ${editorOptions(options, safeValue)}
        </select>
      </label>
    `;
  }

  return `
    <label class="editor-field">
      <span>${escapeHTML(label)}</span>
      <input
        type="${type === "number" ? "number" : "text"}"
        data-edit-path="${escapeHTML(path)}"
        data-edit-type="${escapeHTML(type)}"
        value="${escapeHTML(value)}"
      >
    </label>
  `;
}

function editorNumberField(label, path, min = 0, max = 20, step = 1) {
  const player = findEditorPlayerById(editingPlayerId);
  const value = getNestedValue(player, path, "");

  return `
    <label class="editor-field">
      <span>${escapeHTML(label)}</span>
      <input
        type="number"
        min="${min}"
        max="${max}"
        step="${step}"
        data-edit-path="${escapeHTML(path)}"
        data-edit-type="number"
        value="${escapeHTML(value)}"
      >
    </label>
  `;
}

function uniqueOptionList(values) {
  return [...new Set(values.filter(Boolean))]
    .sort()
    .map((value) => ({ value, label: value }));
}

function getNationalityOptions() {
  return uniqueOptionList(allPlayers.map((player) => player.nationality));
}

function renderEditorPreviewRows(player, category) {
  const rows = getTopThreePlaystyles(player, category);

  if (!rows.length) {
    return `<div class="editor-preview-empty">No ${category} playstyles</div>`;
  }

  return rows.map((style, index) => `
    <div class="editor-preview-row ${index === 0 ? "top" : ""}">
      <span>${index === 0 ? "★ " : ""}${escapeHTML(style.name)}</span>
      <b>${escapeHTML(roundRating(style.rating))}</b>
    </div>
  `).join("");
}

function renderEditorPlaystylePreview(player) {
  return `
    <section class="editor-section editor-playstyle-preview">
      <h3>Playstyle Preview</h3>
      <p>Playstyles are calculated from attributes and shown here as read-only.</p>

      <div class="editor-preview-grid">
        <div>
          <h4>Top Batting</h4>
          ${renderEditorPreviewRows(player, "batting")}
        </div>

        <div>
          <h4>Top Bowling</h4>
          ${renderEditorPreviewRows(player, "bowling")}
        </div>

        <div>
          <h4>Top Fielding</h4>
          ${renderEditorPreviewRows(player, "fielding")}
        </div>
      </div>
    </section>
  `;
}

function renderNationalFormatFields() {
  return `
    <section class="editor-section">
      <h3>National Formats</h3>
      <div class="editor-grid compact">
        ${editorField("Test", "nationalFormats.test", "boolean", [
          { value: "true", label: "true" },
          { value: "false", label: "false" }
        ])}

        ${editorField("ODI", "nationalFormats.odi", "boolean", [
          { value: "true", label: "true" },
          { value: "false", label: "false" }
        ])}

        ${editorField("T20", "nationalFormats.t20", "boolean", [
          { value: "true", label: "true" },
          { value: "false", label: "false" }
        ])}
      </div>
    </section>
  `;
}

function renderPlayerEditorForm(player) {
  const roleOptions = [
    { value: "batsman", label: "batsman" },
    { value: "bowler", label: "bowler" },
    { value: "all-rounder", label: "all-rounder" },
    { value: "wicket-keeper", label: "wicket-keeper" }
  ];

  const handOptions = [
    { value: "__NULL__", label: "-" },
    { value: "right", label: "Right" },
    { value: "left", label: "Left" }
  ];

  const bowlingTypeOptions = [
    { value: "__NULL__", label: "-" },
    { value: "pace", label: "pace" },
    { value: "spin", label: "spin" },
    { value: "none", label: "none" }
  ];

  return `
    <div class="player-editor-modal">
      <div class="player-editor-header">
        <div>
          <h2>Edit Player</h2>
          <p>${escapeHTML(player.name)} • ID ${escapeHTML(player.id)}</p>
        </div>

        <button class="editor-close-btn" onclick="closePlayerEditor()">×</button>
      </div>

      <div class="player-editor-body">
        <section class="editor-section">
          <h3>Basic Information</h3>

          <div class="editor-grid">
            ${editorField("Name", "name")}
            ${editorField("Full Name", "fullName")}
            ${editorField("Age", "age", "number")}
            ${editorField("DOB", "DOB")}
            ${editorField("Nationality", "nationality", "text", getNationalityOptions())}
            ${editorField("Role", "role", "text", roleOptions)}
            ${editorField("Batting Hand", "battingHand", "text", handOptions)}
            ${editorField("Bowling Hand", "bowlingHand", "text", handOptions)}
            ${editorField("Bowling Type", "bowlingType", "text", bowlingTypeOptions)}
            ${editorField("Bowling Style", "bowlingStyle")}
            ${editorField("Bowling Abbrev", "bowlingStyleAbbrev")}
            ${editorField("Batting Position", "primaryBattingPosition", "number")}
            ${editorField("Current Team", "currentTeam")}
            ${editorField("Sold Price", "soldPrice", "number")}
          </div>
        </section>

        ${renderEditorPlaystylePreview(player)}

        <section class="editor-section">
          <h3>Batting</h3>
          <div class="editor-grid compact">
            ${editorNumberField("Technique", "attributes.batting.technique")}
            ${editorNumberField("Timing", "attributes.batting.timing")}
            ${editorNumberField("Footwork", "attributes.batting.footwork")}
            ${editorNumberField("Placement", "attributes.batting.placement")}
            ${editorNumberField("360° Range", "attributes.batting.range360")}
            ${editorNumberField("Defensive", "attributes.batting.defensiveShots")}
            ${editorNumberField("Neutral", "attributes.batting.neutralShots")}
            ${editorNumberField("Attacking", "attributes.batting.attackingShots")}
            ${editorNumberField("vs Pace", "attributes.batting.vsPace")}
            ${editorNumberField("vs Spin", "attributes.batting.vsSpin")}
            ${editorNumberField("Creativity", "attributes.batting.creativity")}
            ${editorNumberField("Bat Overall", "attributes.overall.batting_overall")}
          </div>
        </section>

        <section class="editor-section">
          <h3>Bowling</h3>
          <div class="editor-grid compact">
            ${editorNumberField("Accuracy", "attributes.bowling.accuracy")}
            ${editorNumberField("Speed", "attributes.bowling.bowlingSpeed")}
            ${editorNumberField("Swing", "attributes.bowling.swing")}
            ${editorNumberField("Turn", "attributes.bowling.turn")}
            ${editorNumberField("Flight", "attributes.bowling.flight")}
            ${editorNumberField("Variations", "attributes.bowling.variations")}
            ${editorNumberField("Intelligence", "attributes.bowling.intelligence")}
            ${editorNumberField("Defensive", "attributes.bowling.defensiveBowling")}
            ${editorNumberField("Neutral", "attributes.bowling.neutralBowling")}
            ${editorNumberField("Attacking", "attributes.bowling.attackingBowling")}
            ${editorNumberField("Bowl Overall", "attributes.overall.bowling_overall")}
          </div>
        </section>

        <section class="editor-section">
          <h3>Physical</h3>
          <div class="editor-grid compact">
            ${editorNumberField("Strength", "attributes.physical.strength")}
            ${editorNumberField("Speed", "attributes.physical.speed")}
            ${editorNumberField("Agility", "attributes.physical.agility")}
            ${editorNumberField("Max Fitness", "attributes.physical.maxFitness")}
            ${editorNumberField("Endurance", "attributes.physical.endurance")}
            ${editorNumberField("Stamina", "attributes.physical.stamina")}
          </div>
        </section>

        <section class="editor-section">
          <h3>Mental</h3>
          <div class="editor-grid compact">
            ${editorNumberField("Concentration", "attributes.mental.concentration")}
            ${editorNumberField("Temperament", "attributes.mental.temperament")}
            ${editorNumberField("Aggression", "attributes.mental.aggression")}
            ${editorNumberField("Judgement", "attributes.mental.judgement")}
            ${editorNumberField("Leadership", "attributes.mental.leadership")}
          </div>
        </section>

        <section class="editor-section">
          <h3>Fielding</h3>
          <div class="editor-grid compact">
            ${editorNumberField("Catching", "attributes.fielding.catching")}
            ${editorNumberField("Reflexes", "attributes.fielding.reflexes")}
            ${editorNumberField("Ground Field", "attributes.fielding.groundFielding")}
            ${editorNumberField("Throw Power", "attributes.fielding.throwPower")}
            ${editorNumberField("Throw Acc", "attributes.fielding.throwAccuracy")}
            ${editorNumberField("Keeping", "attributes.fielding.keeping")}
            ${editorNumberField("Collecting", "attributes.fielding.collecting")}
            ${editorNumberField("Stumping", "attributes.fielding.stumping")}
          </div>
        </section>

        <section class="editor-section">
          <h3>Condition</h3>
          <div class="editor-grid compact">
            ${editorNumberField("Fitness", "condition.fitness", 0, 100, 0.5)}
            ${editorNumberField("Fatigue", "condition.fatigue", 0, 100, 0.1)}
            ${editorField("Injury", "condition.injury")}
            ${editorNumberField("Injury Duration", "condition.injuryDuration", 0, 365)}
            ${editorNumberField("Rest Days", "condition.consecutiveRestDays", 0, 365)}
            ${editorNumberField("Morale", "condition.morale", 0, 100)}
          </div>
        </section>

        <section class="editor-section">
          <h3>Career Stats</h3>
          <div class="editor-grid compact">
            ${editorNumberField("Matches", "careerStats.matches", 0, 1000)}
            ${editorNumberField("Innings", "careerStats.innings", 0, 1000)}
            ${editorNumberField("Runs", "careerStats.runs", 0, 100000)}
            ${editorNumberField("Wickets", "careerStats.wickets", 0, 10000)}
            ${editorNumberField("Catches", "careerStats.catches", 0, 10000)}
            ${editorNumberField("Stumpings", "careerStats.stumpings", 0, 10000)}
          </div>
        </section>

        <section class="editor-section">
          <h3>Season Stats</h3>
          <div class="editor-grid compact">
            ${editorNumberField("Matches", "seasonStats.matches", 0, 1000)}
            ${editorNumberField("Innings", "seasonStats.innings", 0, 1000)}
            ${editorNumberField("Runs", "seasonStats.runs", 0, 100000)}
            ${editorNumberField("Wickets", "seasonStats.wickets", 0, 10000)}
            ${editorNumberField("Catches", "seasonStats.catches", 0, 10000)}
            ${editorNumberField("Stumpings", "seasonStats.stumpings", 0, 10000)}
          </div>
        </section>

        ${renderNationalFormatFields()}
      </div>

      <div class="player-editor-footer">
        <button class="editor-reset-btn" onclick="resetPlayerEditorToDefault()">Reset to Default</button>
        <button class="editor-cancel-btn" onclick="closePlayerEditor()">Cancel</button>
        <button class="editor-save-btn" onclick="savePlayerEditorChanges()">Save Changes</button>
      </div>
    </div>
  `;
}

function ensurePlayerEditorRoot() {
  let root = document.getElementById("playerEditorOverlay");

  if (!root) {
    root = document.createElement("div");
    root.id = "playerEditorOverlay";
    root.className = "player-editor-overlay";
    document.body.appendChild(root);
  }

  return root;
}

function openPlayerEditor(playerId) {
  snapshotOriginalPlayers();

  const player = findEditorPlayerById(playerId);

  if (!player) {
    alert("Player not found.");
    return;
  }

  editingPlayerId = String(playerId);

  const root = ensurePlayerEditorRoot();
  root.innerHTML = renderPlayerEditorForm(player);
  root.classList.add("show");
  document.body.classList.add("editor-open");
}

function closePlayerEditor() {
  const root = document.getElementById("playerEditorOverlay");

  if (root) {
    root.classList.remove("show");
    root.innerHTML = "";
  }

  editingPlayerId = null;
  document.body.classList.remove("editor-open");
}

function normalizeNoBowlerFields(player) {
  if (
    player.bowlingType === null ||
    player.bowlingType === "none" ||
    player.bowlingStyle === null ||
    isNoBowlingValue(player.bowlingStyle)
  ) {
    player.bowlingHand = null;
    player.bowlingType = null;
    player.bowlingStyle = null;
    player.bowlingStyleAbbrev = null;

    if (!player.primaryPlaystyle) player.primaryPlaystyle = {};
    player.primaryPlaystyle.bowling = null;

    if (!player.topPlaystyles) player.topPlaystyles = {};
    player.topPlaystyles.bowling = [];

    if (!player.playstyleRatings) player.playstyleRatings = {};
    if (!player.playstyleRatings.bowling) player.playstyleRatings.bowling = {};
    player.playstyleRatings.bowling["Does Not Bowl"] = null;

    if (player.attributes?.overall) {
      player.attributes.overall.bowling_overall = null;
    }
  }
}

function savePlayerEditorChanges() {
  const player = findEditorPlayerById(editingPlayerId);

  if (!player) return;

  document.querySelectorAll("#playerEditorOverlay [data-edit-path]").forEach((input) => {
    const path = input.dataset.editPath;
    const type = input.dataset.editType;
    const value = normalizeEditorValue(input.value, type);

    setNestedValue(player, path, value);
  });

  normalizeNoBowlerFields(player);

  const edits = getSavedPlayerEdits();
  edits[String(player.id)] = deepClone(player);
  writeSavedPlayerEdits(edits);

  filteredPlayers = filteredPlayers.map((filteredPlayer) => {
    return String(filteredPlayer.id) === String(player.id) ? player : filteredPlayer;
  });

  closePlayerEditor();
  closePlayerModal();
  applyFilters();
  openPlayerModal(player);
}

function resetPlayerEditorToDefault() {
  const original = ORIGINAL_PLAYER_COPY_BY_ID.get(String(editingPlayerId));

  if (!original) {
    alert("Original player copy not found.");
    return;
  }

  const index = allPlayers.findIndex((player) => String(player.id) === String(editingPlayerId));

  if (index >= 0) {
    allPlayers[index] = deepClone(original);
  }

  const edits = getSavedPlayerEdits();
  delete edits[String(editingPlayerId)];
  writeSavedPlayerEdits(edits);

  filteredPlayers = [...allPlayers];
  closePlayerEditor();
  applyFilters();

  if (index >= 0) {
    openPlayerModal(allPlayers[index]);
  }
}

function downloadEditedPlayersJson() {
  const exportData = {
    format: "cm25-player-database",
    version: "edited-local",
    exportedAt: new Date().toISOString(),
    players: allPlayers
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "players_edited.json";
  anchor.click();

  URL.revokeObjectURL(url);
}

function buildFilters() {
  const nations = new Set();
  const roles = new Set();

  nationFilter.innerHTML = `<option value="all">All Nations</option>`;
  roleFilter.innerHTML = `<option value="all">All Roles</option>`;

  allPlayers.forEach((player) => {
    const display = getDisplayPlayer(player);

    if (display.nation !== "-") nations.add(display.nation);
    if (display.role !== "-") roles.add(display.role);
  });

  [...nations].sort().forEach((nation) => {
    const option = document.createElement("option");
    option.value = nation;
    option.textContent = nation;
    nationFilter.appendChild(option);
  });

  [...roles].sort().forEach((role) => {
    const option = document.createElement("option");
    option.value = role;
    option.textContent = role;
    roleFilter.appendChild(option);
  });
}

function applyFilters() {
  const searchText = searchInput.value.toLowerCase();
  const selectedNation = nationFilter.value;
  const selectedRole = roleFilter.value;

  filteredPlayers = allPlayers.filter((player) => {
    const display = getDisplayPlayer(player);
    const searchableText = JSON.stringify(player).toLowerCase();
    const matchesSearch = searchableText.includes(searchText);
    const matchesNation = selectedNation === "all" || display.nation === selectedNation;
    const matchesRole = selectedRole === "all" || display.role === selectedRole;

    return matchesSearch && matchesNation && matchesRole;
  });

  applySortAndRender();
}

function sortPlayers(players) {
  if (!currentSort.key) return players;

  return [...players].sort((a, b) => {
    const playerA = getDisplayPlayer(a);
    const playerB = getDisplayPlayer(b);

    let valueA = playerA[currentSort.key];
    let valueB = playerB[currentSort.key];

    const numericColumns = ["age", "batStyle", "bowlStyle", "fieldStyle"];

    if (numericColumns.includes(currentSort.key)) {
      if (currentSort.key === "age") {
        valueA = Number(valueA) || 0;
        valueB = Number(valueB) || 0;
      } else {
        valueA = extractNumberFromStyle(valueA);
        valueB = extractNumberFromStyle(valueB);
      }
    } else {
      valueA = String(valueA).toLowerCase();
      valueB = String(valueB).toLowerCase();
    }

    if (valueA < valueB) return currentSort.direction === "asc" ? -1 : 1;
    if (valueA > valueB) return currentSort.direction === "asc" ? 1 : -1;
    return 0;
  });
}

function updateSortButtons() {
  const sortButtons = document.querySelectorAll(".column-sort-btn");

  sortButtons.forEach((button) => {
    const sortKey = button.dataset.sort;
    const icon = button.querySelector(".sort-icon");

    button.classList.remove("active");

    if (sortKey === currentSort.key) {
      button.classList.add("active");
      icon.textContent = currentSort.direction === "asc" ? "↑" : "↓";
    } else {
      icon.textContent = "↕";
    }
  });
}

function applySortAndRender() {
  const sortedPlayers = sortPlayers(filteredPlayers);
  renderTable(sortedPlayers);
  updateSortButtons();
}

document.querySelectorAll(".column-sort-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const selectedSortKey = button.dataset.sort;

    if (currentSort.key === selectedSortKey) {
      currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
    } else {
      currentSort.key = selectedSortKey;
      currentSort.direction = "asc";
    }

    applySortAndRender();
  });
});

searchInput.addEventListener("input", applyFilters);
nationFilter.addEventListener("change", applyFilters);
roleFilter.addEventListener("change", applyFilters);

resetBtn.addEventListener("click", () => {
  searchInput.value = "";
  nationFilter.value = "all";
  roleFilter.value = "all";
  currentSort.key = null;
  currentSort.direction = "asc";
  filteredPlayers = [...allPlayers];
  renderTable(filteredPlayers);
  updateSortButtons();
});

closeModalBtn.addEventListener("click", closePlayerModal);

playerModal.addEventListener("click", (event) => {
  if (event.target === playerModal) closePlayerModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const editorOverlay = document.getElementById("playerEditorOverlay");

    if (editorOverlay && editorOverlay.classList.contains("show")) {
      closePlayerEditor();
      return;
    }

    closePlayerModal();
  }
});

loadPlayers();