let PLAYER_DATA = [];
let DATA_SOURCE_LABEL = "No data loaded";

const DEFAULT_JSON_FILES = ["./data/players.json"];

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function averageNumbers(values) {
  const nums = values.map(Number).filter(n => Number.isFinite(n));

  if (!nums.length) return 0;

  return Math.round(nums.reduce((total, n) => total + n, 0) / nums.length);
}

function looksLikePlayersArray(arr) {
  return Array.isArray(arr) && arr.some(
    p =>
      p &&
      typeof p === "object" &&
      ("name" in p || "fullName" in p) &&
      ("nationality" in p || "country" in p || "role" in p)
  );
}

function findPlayersArray(value, depth = 0) {
  if (!value || depth > 4) return null;

  if (looksLikePlayersArray(value)) return value;
  if (Array.isArray(value)) return null;

  if (typeof value === "object") {
    const preferred = [
      "players",
      "PLAYER_DATA",
      "playerData",
      "player_data",
      "data",
      "items",
      "records"
    ];

    for (const key of preferred) {
      if (key in value) {
        const found = findPlayersArray(value[key], depth + 1);
        if (found) return found;
      }
    }

    for (const key of Object.keys(value)) {
      const found = findPlayersArray(value[key], depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase().replaceAll("_", "-");

  if (r.includes("keeper") || r === "wk") return "wicket-keeper";
  if (r.includes("round")) return "all-rounder";
  if (r.includes("bowl")) return "bowler";
  if (r.includes("bat")) return "batsman";

  return r || "batsman";
}

function normalizePlayer(p, index) {
  const attributes = p.attributes || {};
  const fieldingAttrs = attributes.fielding || {};
  const physicalAttrs = attributes.physical || {};

  const battingOverall = toNumber(
    p.battingOverall ??
      p.bat ??
      p.batting ??
      p.battingRating ??
      p.batting_rating ??
      attributes.overall?.batting_overall
  );

  const bowlingOverall = toNumber(
    p.bowlingOverall ??
      p.bowl ??
      p.bowling ??
      p.bowlingRating ??
      p.bowling_rating ??
      attributes.overall?.bowling_overall
  );

  const fieldingOverall = toNumber(
    p.fieldingOverall ??
      p.field ??
      p.fielding ??
      p.fieldingRating ??
      p.fielding_rating ??
      averageNumbers([
        fieldingAttrs.catching,
        fieldingAttrs.reflexes,
        fieldingAttrs.groundFielding,
        fieldingAttrs.throwPower,
        fieldingAttrs.throwAccuracy
      ])
  );

  const stamina = toNumber(
    p.stamina ??
      p.endurance ??
      physicalAttrs.stamina ??
      physicalAttrs.endurance
  );

  const fitness = toNumber(
    p.fitness ??
      p.fitnessOverall ??
      p.condition?.fitness,
    100
  );

  const batStyle =
    p.primaryPlaystyle?.batting ||
    p.topPlaystyles?.batting?.[0]?.name ||
    p.batStyle ||
    p.battingStyleName ||
    p.battingPlaystyle ||
    p.playstyle?.batting ||
    "None";

  const bowlStyle =
    p.primaryPlaystyle?.bowling ||
    p.topPlaystyles?.bowling?.[0]?.name ||
    p.bowlStyle ||
    p.bowlingStyleName ||
    p.bowlingPlaystyle ||
    p.playstyle?.bowling ||
    "None";

  return {
    ...p,
    id: String(p.id ?? p.playerId ?? p.player_id ?? p.slug ?? `player_${index}`),
    name: p.name ?? p.fullName ?? p.playerName ?? p.player_name ?? `Player ${index + 1}`,
    fullName: p.fullName ?? p.name ?? p.playerName ?? p.player_name ?? `Player ${index + 1}`,
    nationality: p.nationality ?? p.country ?? p.team ?? p.nation ?? "Unknown",
    role: normalizeRole(p.role ?? p.playerRole ?? p.player_role),
    battingHand: p.battingHand ?? p.batHand ?? p.batting_hand ?? p.hand ?? "",
    bowlingType: p.bowlingType ?? p.bowlType ?? p.bowling_type ?? "",
    bowlingStyle:
      p.bowlingStyle ??
      p.bowlStyleFull ??
      p.bowling_style ??
      p.bowlingType ??
      p.bowlStyle ??
      "None",
    battingOverall,
    bowlingOverall,
    fieldingOverall,
    stamina,
    fitness,
    primaryPlaystyle: {
      ...(p.primaryPlaystyle || {}),
      batting: batStyle,
      bowling: bowlStyle,
      fielding: p.primaryPlaystyle?.fielding || p.fieldingStyle || "Wicketkeeper"
    }
  };
}

function loadPlayersFromData(rawData, sourceLabel = "JSON file") {
  const arr = findPlayersArray(rawData);

  if (!arr) {
    throw new Error("No player array found. Use an array of player objects or an object with a players array.");
  }

  PLAYER_DATA = arr.map(normalizePlayer).filter(p => p.name && p.nationality);

  if (!PLAYER_DATA.length) {
    throw new Error("The JSON loaded, but no valid players were found.");
  }

  DATA_SOURCE_LABEL = sourceLabel;

  state.userTeam = "";
  state.computerTeam = "";
  state.series = [];
  state.userSquad = [];
  state.computerSquad = [];

  fillTeamDropdowns();
  hideMsg("setupMsg");
  $("dataSource").textContent = `Loaded from ${sourceLabel}`;
}

async function tryFetchDefaultData() {
  for (const file of DEFAULT_JSON_FILES) {
    try {
      const response = await fetch(file, { cache: "no-store" });

      if (!response.ok) continue;

      const data = await response.json();

      loadPlayersFromData(data, file.replace("./", ""));
      return true;
    } catch (err) {
      console.error(`Could not load ${file}:`, err);
    }
  }

  return false;
}

async function initData() {
  $("databaseCount").textContent = "Looking for JSON...";
  $("dataSource").textContent = "Put data/players.json inside the frontend folder, or click Load JSON.";

  const loaded = await tryFetchDefaultData();

  if (!loaded) {
    PLAYER_DATA = [];
    fillTeamDropdowns();
    $("databaseCount").textContent = "No JSON loaded";
    showMsg(
      "setupMsg",
      "No player JSON loaded yet. Make sure the file is at data/players.json inside this frontend folder, or click Load JSON."
    );
  }
}

function handleJsonUpload(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      loadPlayersFromData(data, file.name);
      showMsg("setupMsg", `Loaded ${PLAYER_DATA.length} players from ${file.name}.`, false);
    } catch (err) {
      showMsg("setupMsg", `Could not load JSON: ${err.message}`);
    }
  };

  reader.onerror = () => showMsg("setupMsg", "Could not read that JSON file.");
  reader.readAsText(file);
}

const TEAM_LOGOS = {
  Afghanistan: "assets/team-logos/afghanistan.png",
  Australia: "assets/team-logos/australia.png",
  Bangladesh: "assets/team-logos/bangladesh.png",
  Canada: "assets/team-logos/canada.png",
  England: "assets/team-logos/england.png",
  India: "assets/team-logos/india.png",
  Ireland: "assets/team-logos/ireland.png",
  Namibia: "assets/team-logos/namibia.png",
  Nepal: "assets/team-logos/nepal.png",
  Netherlands: "assets/team-logos/netherlands.png",
  "New Zealand": "assets/team-logos/new-zealand.png",
  Oman: "assets/team-logos/oman.png",
  Pakistan: "assets/team-logos/pakistan.png",
  Scotland: "assets/team-logos/scotland.png",
  "South Africa": "assets/team-logos/south-africa.png",
  "Sri Lanka": "assets/team-logos/sri-lanka.png",
  "United Arab Emirates": "assets/team-logos/united-arab-emirates.png",
  "United States of America": "assets/team-logos/united-states-of-america.png",
  "West Indies": "assets/team-logos/west-indies.png",
  Zimbabwe: "assets/team-logos/zimbabwe.png"
};

const state = {
  userTeam: "",
  computerTeam: "",
  series: [],
  userSquad: [],
  computerSquad: []
};

let squadSort = {
  key: "overall",
  direction: "desc"
};

let lastUserTeam = "";
let lastComputerTeam = "";
let teamCardsReady = false;

const $ = id => document.getElementById(id);

const uniqueTeams = () =>
  [...new Set(PLAYER_DATA.map(p => p.nationality).filter(Boolean))].sort();

const teamPlayers = team => PLAYER_DATA.filter(p => p.nationality === team);

const esc = v =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const cssSafe = v => String(v ?? "").replace(/[^a-zA-Z0-9_-]/g, "_");

const overallScore = p =>
  Number(p.battingOverall || 0) +
  Number(p.bowlingOverall || 0) +
  Number(p.fieldingOverall || 0) / 2 +
  Number(p.stamina || 0) / 3;

function initials(team) {
  return String(team || "TM")
    .split(/\s+/)
    .filter(Boolean)
    .map(x => x[0])
    .slice(0, 3)
    .join("")
    .toUpperCase();
}

function showLogo(imgId, fallbackId, team) {
  const img = $(imgId);
  const fallback = $(fallbackId);

  fallback.textContent = initials(team);

  const logoPath = TEAM_LOGOS[team];

  if (!team || !logoPath) {
    img.removeAttribute("src");
    img.style.display = "none";
    fallback.style.display = "flex";
    return;
  }

  img.onerror = () => {
    img.style.display = "none";
    fallback.style.display = "flex";
  };

  img.onload = () => {
    img.style.display = "block";
    fallback.style.display = "none";
  };

  fallback.style.display = "none";
  img.style.display = "block";
  img.src = logoPath;
}

function fillTeamDropdowns() {
  const teams = uniqueTeams();

  if (!teams.length) {
    $("userTeamSelect").innerHTML = `<option value="">Load JSON first</option>`;
    $("computerTeamSelect").innerHTML = `<option value="">Load JSON first</option>`;
    $("databaseCount").textContent = "No JSON loaded";
    updateTeamCards();
    return;
  }

  const html = teams.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");

  $("userTeamSelect").innerHTML = html;
  $("computerTeamSelect").innerHTML = html;

  $("userTeamSelect").value = teams.includes("England") ? "England" : teams[0];

  $("computerTeamSelect").value =
    teams.includes("Australia") && $("userTeamSelect").value !== "Australia"
      ? "Australia"
      : teams.find(t => t !== $("userTeamSelect").value) || teams[0];

  $("userTeamSelect").onchange = updateTeamCards;
  $("computerTeamSelect").onchange = updateTeamCards;

  $("databaseCount").textContent = `${PLAYER_DATA.length} players • ${teams.length} teams`;

  updateTeamCards();
}

function teamStatsHtml(team) {
  const list = teamPlayers(team);
  const bats = list.filter(p => p.role === "batsman").length;
  const bowlers = list.filter(p => p.role === "bowler").length;
  const ars = list.filter(p => p.role === "all-rounder").length;
  const keepers = list.filter(p => p.role === "wicket-keeper").length;

  return `
    <span class="mini-stat">${list.length} players</span>
    <span class="mini-stat">${bats} bat</span>
    <span class="mini-stat">${bowlers} bowl</span>
    <span class="mini-stat">${ars} AR</span>
    <span class="mini-stat">${keepers} WK</span>
  `;
}

function animateTeamChange(cardId, logoId, statsId) {
  const card = $(cardId);
  const logo = $(logoId);
  const stats = $(statsId);

  if (!card) return;

  card.classList.remove("team-changed");
  void card.offsetWidth;
  card.classList.add("team-changed");

  if (logo) {
    logo.classList.remove("logo-fade-in");
    void logo.offsetWidth;
    logo.classList.add("logo-fade-in");
  }

  if (stats) {
    stats.classList.remove("stats-smooth");
    void stats.offsetWidth;
    stats.classList.add("stats-smooth");
  }
}


function updateTeamCards() {
  const user = $("userTeamSelect").value;
  const computer = $("computerTeamSelect").value;

  const userChanged = teamCardsReady && user !== lastUserTeam;
  const computerChanged = teamCardsReady && computer !== lastComputerTeam;

  $("userTeamName").textContent = user || "Load JSON";
  $("computerTeamName").textContent = computer || "Load JSON";

  $("userTeamDetails").textContent = user
    ? `${teamPlayers(user).length} available players for the tour.`
    : "Load a player JSON file to start.";

  $("computerTeamDetails").textContent = computer
    ? `${teamPlayers(computer).length} available computer players.`
    : "Opponent teams appear after JSON loads.";

  $("userTeamStats").innerHTML = user ? teamStatsHtml(user) : "";
  $("computerTeamStats").innerHTML = computer ? teamStatsHtml(computer) : "";

  showLogo("userLogo", "userFallback", user);
  showLogo("computerLogo", "computerFallback", computer);

  if (userChanged) {
    animateTeamChange("userTeamCard", "userLogo", "userTeamStats");
  }

  if (computerChanged) {
    animateTeamChange("computerTeamCard", "computerLogo", "computerTeamStats");
  }

  lastUserTeam = user;
  lastComputerTeam = computer;
  teamCardsReady = true;
}

function showScreen(name) {
  $("setupScreen").classList.toggle("active", name === "setup");
  $("squadScreen").classList.toggle("active", name === "squad");
  $("summaryScreen").classList.toggle("active", name === "summary");

  $("stepSetup").classList.toggle("active", name === "setup");
  $("stepSquad").classList.toggle("active", name === "squad");
  $("stepSummary").classList.toggle("active", name === "summary");

  document.body.classList.toggle("main-page", name === "setup");
  document.body.classList.toggle("sub-page", name !== "setup");
  document.body.classList.toggle("squad-page", name === "squad");
  document.body.classList.toggle("summary-page", name === "summary");

  if (name === "summary") renderSummary();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showMsg(id, text, error = true) {
  const el = $(id);

  el.textContent = text;
  el.classList.toggle("error", error);
  el.classList.add("show");
}

function hideMsg(id) {
  $(id).classList.remove("show");
}

function makeMatches(testCount, odiCount, t20Count) {
  const matches = [];
  let n = 1;

  for (let i = 1; i <= testCount; i++) {
    matches.push({ matchNo: n++, format: "Test", label: `Test ${i}` });
  }

  for (let i = 1; i <= odiCount; i++) {
    matches.push({ matchNo: n++, format: "ODI", label: `ODI ${i}` });
  }

  for (let i = 1; i <= t20Count; i++) {
    matches.push({ matchNo: n++, format: "T20", label: `T20 ${i}` });
  }

  return matches;
}

function createSeries() {
  hideMsg("setupMsg");

  const user = $("userTeamSelect").value;
  const computer = $("computerTeamSelect").value;
  const tests = Number($("tests").value);
  const odis = Number($("odis").value);
  const t20s = Number($("t20s").value);

  if (!PLAYER_DATA.length) return showMsg("setupMsg", "Load your player JSON first.");
  if (!user || !computer) return showMsg("setupMsg", "Choose two teams after loading JSON.");
  if (user === computer) return showMsg("setupMsg", "Choose two different national teams.");
  if (tests + odis + t20s === 0) return showMsg("setupMsg", "Choose at least one match. All formats cannot be None.");
  if (teamPlayers(user).length < 12) return showMsg("setupMsg", `${user} has fewer than 12 available players.`);
  if (teamPlayers(computer).length < 12) return showMsg("setupMsg", `${computer} has fewer than 12 available players.`);

  state.userTeam = user;
  state.computerTeam = computer;
  state.series = makeMatches(tests, odis, t20s);
  state.userSquad = [];
  state.computerSquad = autoPickComputerSquad(computer);

  $("searchBox").value = "";
  $("roleFilter").value = "all";
  $("sortBy").value = "overall";

  squadSort = {
    key: "overall",
    direction: "desc"
  };

  renderPlayerTable();
  showScreen("squad");
}

function autoPickComputerSquad(team) {
  return teamPlayers(team)
    .slice()
    .sort((a, b) => overallScore(b) - overallScore(a))
    .slice(0, 18);
}

function selectedSet() {
  return new Set(state.userSquad.map(p => p.id));
}

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

function getPlaystyleCode(name) {
  return BATTING_STYLE_CODES[name] || BOWLING_STYLE_CODES[name] || name || "None";
}

function playstyleClass(name) {
  const s = String(name || "").toLowerCase();

  if (s.includes("slogger")) return "ps-slogger";
  if (s.includes("balanced")) return "ps-balanced";
  if (s.includes("anchor")) return "ps-anchor";
  if (s.includes("finisher")) return "ps-finisher";
  if (s.includes("runner")) return "ps-runner";
  if (s.includes("pinch")) return "ps-pinch";
  if (s.includes("wall")) return "ps-wall";
  if (s.includes("swing")) return "ps-swing";
  if (s.includes("hit")) return "ps-hitdeck";
  if (s.includes("short")) return "ps-shortball";
  if (s.includes("death")) return "ps-death";
  if (s.includes("classical")) return "ps-classical";
  if (s.includes("flat")) return "ps-flat";
  if (s.includes("mystery")) return "ps-mystery";
  if (s.includes("containment")) return "ps-containment";
  if (s.includes("wicket")) return "ps-wicketkeeper";

  return "ps-none";
}

function pill(name) {
  if (!name || name === "None") {
    return `<span class="playstyle-pill ps-none">None</span>`;
  }

  const code = getPlaystyleCode(name);

  return `
    <span
      class="playstyle-pill ${playstyleClass(name)}"
      title="${esc(code)} = ${esc(name)}"
    >
      ${esc(code)}
    </span>
  `;
}

function ratingLevel(value, maxValue) {
  const num = Number(value) || 0;
  const pct = maxValue ? (num / maxValue) * 100 : num;

  if (pct >= 90) return "elite";
  if (pct >= 75) return "high";
  if (pct >= 50) return "mid";

  return "low";
}

function statCard(value, maxValue = 20) {
  if (value === null || value === undefined || value === "") {
    return `<span class="rating-card low" title="No rating"><span class="rating-number">—</span></span>`;
  }

  const num = Number(value);
  const clean = Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, "");
  const label = maxValue === 100 ? `${clean} / 100` : `${clean} / ${maxValue}`;

  return `<span class="rating-card ${ratingLevel(num, maxValue)}" title="${label}"><span class="rating-number">${clean}</span></span>`;
}

function getSquadSortValue(player, key) {
  const batStyle = player.primaryPlaystyle?.batting || "None";
  const bowlStyle = player.primaryPlaystyle?.bowling || "None";

  if (key === "name") return player.name || "";
  if (key === "role") return player.role || "";
  if (key === "batting") return Number(player.battingOverall) || 0;
  if (key === "bowling") return Number(player.bowlingOverall) || 0;
  if (key === "fielding") return Number(player.fieldingOverall) || 0;
  if (key === "stamina") return Number(player.stamina) || 0;
  if (key === "fitness") return Number(player.fitness) || 0;
  if (key === "batStyle") return getPlaystyleCode(batStyle);
  if (key === "bowlStyle") return getPlaystyleCode(bowlStyle);

  return overallScore(player);
}

function compareSquadPlayers(a, b) {
  let valueA = getSquadSortValue(a, squadSort.key);
  let valueB = getSquadSortValue(b, squadSort.key);

  const numericKeys = [
    "overall",
    "batting",
    "bowling",
    "fielding",
    "stamina",
    "fitness"
  ];

  if (numericKeys.includes(squadSort.key)) {
    valueA = Number(valueA) || 0;
    valueB = Number(valueB) || 0;
  } else {
    valueA = String(valueA).toLowerCase();
    valueB = String(valueB).toLowerCase();
  }

  if (valueA < valueB) {
    return squadSort.direction === "asc" ? -1 : 1;
  }

  if (valueA > valueB) {
    return squadSort.direction === "asc" ? 1 : -1;
  }

  return 0;
}

function updateSquadSortButtons() {
  document.querySelectorAll(".squad-sort-btn").forEach((button) => {
    const sortKey = button.dataset.squadSort;
    const icon = button.querySelector(".squad-sort-icon");

    button.classList.remove("active");

    if (sortKey === squadSort.key) {
      button.classList.add("active");
      icon.textContent = squadSort.direction === "asc" ? "↑" : "↓";
    } else {
      icon.textContent = "↕";
    }
  });
}

function setupSquadSortButtons() {
  document.querySelectorAll(".squad-sort-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedSortKey = button.dataset.squadSort;

      if (squadSort.key === selectedSortKey) {
        squadSort.direction = squadSort.direction === "asc" ? "desc" : "asc";
      } else {
        squadSort.key = selectedSortKey;

        const numericKeys = [
          "batting",
          "bowling",
          "fielding",
          "stamina",
          "fitness"
        ];

        squadSort.direction = numericKeys.includes(selectedSortKey)
          ? "desc"
          : "asc";
      }

      renderPlayerTable();
    });
  });
}

function setSquadSortFromDropdown() {
  const selectedSort = $("sortBy").value;

  squadSort.key = selectedSort;

  if (selectedSort === "name") {
    squadSort.direction = "asc";
  } else {
    squadSort.direction = "desc";
  }

  renderPlayerTable();
}

function renderPlayerTable() {
  hideMsg("squadMsg");

  const q = $("searchBox").value.trim().toLowerCase();
  const role = $("roleFilter").value;
  const ids = selectedSet();

  let list = teamPlayers(state.userTeam);

  if (role !== "all") {
    list = list.filter(p => p.role === role);
  }

  if (q) {
    list = list.filter(p =>
      `${p.name} ${p.role} ${p.bowlingStyle}`.toLowerCase().includes(q)
    );
  }

  list.sort(compareSquadPlayers);
  updateSquadSortButtons();

  $("selectedChip").innerHTML = `<span>Selected</span><b>${state.userSquad.length}</b>`;

  $("selectedChip").className =
    state.userSquad.length < 12
      ? "chip warn"
      : state.userSquad.length > 18
        ? "chip bad"
        : "chip good";

  $("availableChip").innerHTML = `<span>Available</span><b>${teamPlayers(state.userTeam).length}</b>`;
  $("summaryBtn").disabled = state.userSquad.length < 12 || state.userSquad.length > 18;

  if (!list.length) {
    $("playersTbody").innerHTML = `<tr><td colspan="10">No players match this filter.</td></tr>`;
    return;
  }

  $("playersTbody").innerHTML = list.map(p => {
    const checked = ids.has(p.id);
    const disabled = !checked && state.userSquad.length >= 18;
    const batStyle = p.primaryPlaystyle?.batting || "None";
    const bowlStyle = p.primaryPlaystyle?.bowling || "None";
    const bowlingText = p.bowlingStyle || p.bowlingType || "None";

    return `
      <tr class="${checked ? "selected-row" : ""}">
        <td class="select-cell">
          <input
            type="checkbox"
            id="player_${cssSafe(p.id)}"
            ${checked ? "checked" : ""}
            ${disabled ? "disabled" : ""}
            onchange="togglePlayer('${p.id}')"
          >
        </td>

        <td>
          <label class="player-name" for="player_${cssSafe(p.id)}">${esc(p.name)}</label>
          <div class="tiny">${esc(p.battingHand || "")} hand bat • ${esc(bowlingText)}</div>
        </td>

        <td>
          <span class="badge green role-badge">${esc(p.role)}</span>
        </td>

        <td class="stat-cell" data-label="Bat">${statCard(p.battingOverall, 20)}</td>
        <td class="stat-cell" data-label="Bowl">${statCard(p.bowlingOverall, 20)}</td>
        <td class="stat-cell" data-label="Field">${statCard(p.fieldingOverall, 20)}</td>
        <td class="stat-cell" data-label="Stamina">${statCard(p.stamina, 20)}</td>
        <td class="stat-cell" data-label="Fitness">${statCard(p.fitness, 100)}</td>

        <td>${pill(batStyle)}</td>
        <td>${pill(bowlStyle)}</td>
      </tr>
    `;
  }).join("");
}

function togglePlayer(id) {
  hideMsg("squadMsg");

  const existing = state.userSquad.findIndex(p => p.id === id);

  if (existing >= 0) {
    state.userSquad.splice(existing, 1);
  } else {
    if (state.userSquad.length >= 18) {
      showMsg("squadMsg", "Maximum 18 players. Uncheck one player first.");
      renderPlayerTable();
      return;
    }

    const player = PLAYER_DATA.find(p => p.id === id);

    if (player) {
      state.userSquad.push(player);
    }
  }

  renderPlayerTable();
}

function clearSquad() {
  state.userSquad = [];
  renderPlayerTable();
}

function finishSquad() {
  hideMsg("squadMsg");

  if (state.userSquad.length < 12) {
    return showMsg(
      "squadMsg",
      `Pick at least 12 players. You currently have ${state.userSquad.length}.`
    );
  }

  if (state.userSquad.length > 18) {
    return showMsg("squadMsg", "Maximum 18 players allowed.");
  }

  showScreen("summary");
}

function countFormat(format) {
  return state.series.filter(m => m.format === format).length;
}

function countText(n, label) {
  return n === 0
    ? `No ${label}`
    : n === 1
      ? `Only 1 ${label}`
      : `${n} ${label}${label === "T20" ? "s" : "s"}`;
}

function summaryRow(left, right) {
  return `<div class="summary-row"><strong>${esc(left)}</strong><span>${right}</span></div>`;
}

function rosterRow(p, i) {
  return summaryRow(
    `${i + 1}. ${p.name}`,
    `${esc(p.role)} • Bat ${p.battingOverall} • Bowl ${p.bowlingOverall}`
  );
}

function renderSummary() {
  const tests = countFormat("Test");
  const odis = countFormat("ODI");
  const t20s = countFormat("T20");

  $("teamSummary").innerHTML =
    summaryRow("User", esc(state.userTeam)) +
    summaryRow("Computer", esc(state.computerTeam));

  $("seriesSummary").innerHTML =
    summaryRow("Tests", esc(countText(tests, "Test"))) +
    summaryRow("ODIs", esc(countText(odis, "ODI"))) +
    summaryRow("T20s", esc(countText(t20s, "T20"))) +
    state.series.map(m =>
      summaryRow(m.label, `${esc(state.userTeam)} vs ${esc(state.computerTeam)}`)
    ).join("");

  $("userSquadSummary").innerHTML = state.userSquad.map(rosterRow).join("");
  $("computerSquadSummary").innerHTML = state.computerSquad.map(rosterRow).join("");
  $("jsonOut").textContent = JSON.stringify(getTourPayload(), null, 2);
}

function getTourPayload() {
  return {
    createdAt: new Date().toISOString(),
    userTeam: state.userTeam,
    computerTeam: state.computerTeam,
    series: {
      tests: countFormat("Test"),
      odis: countFormat("ODI"),
      t20s: countFormat("T20"),
      matches: state.series
    },
    userSquad: state.userSquad,
    computerSquad: state.computerSquad
  };
}

function copyJson() {
  navigator.clipboard?.writeText($("jsonOut").textContent);
  showMsg("copyMsg", "Copied tour JSON.", false);
}

function resetAll() {
  state.userTeam = "";
  state.computerTeam = "";
  state.series = [];
  state.userSquad = [];
  state.computerSquad = [];

  fillTeamDropdowns();
  showScreen("setup");
}

document.body.classList.add("main-page");

setupSquadSortButtons();
initData();