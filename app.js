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

    allPlayers = normalizePlayers(rawData);
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

function getTopPlaystyle(player, category) {
  if (player.topPlaystyles?.[category] && Array.isArray(player.topPlaystyles[category]) && player.topPlaystyles[category].length > 0) {
    return player.topPlaystyles[category][0];
  }

  if (player.primaryPlaystyle?.[category] && player.playstyleRatings?.[category]) {
    const styleName = player.primaryPlaystyle[category];
    return { name: styleName, rating: player.playstyleRatings[category][styleName] };
  }

  if (player.playstyleRatings?.[category]) {
    const ratings = player.playstyleRatings[category];
    let bestName = null;
    let bestRating = -1;

    for (const styleName in ratings) {
      if (ratings[styleName] > bestRating) {
        bestName = styleName;
        bestRating = ratings[styleName];
      }
    }

    if (bestName !== null) return { name: bestName, rating: bestRating };
  }

  return null;
}

function getTopThreePlaystyles(player, category) {
  if (player.topPlaystyles?.[category] && Array.isArray(player.topPlaystyles[category])) {
    return player.topPlaystyles[category].slice(0, 3);
  }

  if (player.playstyleRatings?.[category]) {
    return Object.entries(player.playstyleRatings[category])
      .map(([name, rating]) => ({ name, rating }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
  }

  return [];
}

function getBatStyle(player) {
  const topBatting = getTopPlaystyle(player, "batting");
  if (!topBatting) return "-";
  const code = BATTING_STYLE_CODES[topBatting.name] || topBatting.name;
  return `${code} (${roundRating(topBatting.rating)})`;
}

function getBowlStyle(player) {
  const topBowling = getTopPlaystyle(player, "bowling");
  if (!topBowling) return "-";
  const code = BOWLING_STYLE_CODES[topBowling.name] || topBowling.name;
  return `${code} (${roundRating(topBowling.rating)})`;
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
  if (!topBowling) return "";
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
  if (!topBowling) return "ps-none";
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
    bowlingType: getField(player, FIELD_NAMES.bowlingType),
    style: getField(player, FIELD_NAMES.style),
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
  return String(value)
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
      <h2>${escapeHTML(display.name)}</h2>
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
  if (event.key === "Escape") closePlayerModal();
});

loadPlayers();
