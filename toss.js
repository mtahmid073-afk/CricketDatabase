function getStoredTourMatch() {
      const raw = localStorage.getItem("currentTourMatch");
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (error) { console.error("Could not read currentTourMatch:", error); return null; }
    }

    function getTeamShortName(teamName) {
      const special = {
        Bangladesh: "BAN", India: "IND", Pakistan: "PAK", Australia: "AUS", England: "ENG", "New Zealand": "NZ", "South Africa": "SA", "Sri Lanka": "SL", "West Indies": "WI", Afghanistan: "AFG", Zimbabwe: "ZIM", Ireland: "IRE", Scotland: "SCO", Netherlands: "NED", Nepal: "NEP", Oman: "OMA", Canada: "CAN", Namibia: "NAM", "United Arab Emirates": "UAE", "United States of America": "USA"
      };
      if (special[teamName]) return special[teamName];
      return String(teamName || "TEAM").split(/\s+/).map(word => word[0]).join("").slice(0, 3).toUpperCase();
    }

    function getPlayerName(player) { return player?.name || player?.fullName || "Captain"; }

    function getPlayerOverall(player) {
      const batting = Number(player?.attributes?.overall?.batting_overall) || 0;
      const bowling = Number(player?.attributes?.overall?.bowling_overall) || 0;
      const role = String(player?.role || "").toLowerCase();
      if (role.includes("all-rounder") || role.includes("all rounder")) {
        const high = Math.max(batting, bowling);
        const low = Math.min(batting, bowling);
        return (high + low * 1.3) / 2;
      }
      if (role.includes("bowler")) return bowling;
      return Math.max(batting, bowling);
    }

    function getCaptain(squad) {
      if (!Array.isArray(squad) || squad.length === 0) return "Captain";
      const sorted = [...squad].sort((a, b) => {
        const leadershipA = Number(a?.attributes?.mental?.leadership) || 0;
        const leadershipB = Number(b?.attributes?.mental?.leadership) || 0;
        if (leadershipB !== leadershipA) return leadershipB - leadershipA;
        return getPlayerOverall(b) - getPlayerOverall(a);
      });
      return getPlayerName(sorted[0]);
    }

    function average(numbers) {
      const valid = numbers.filter(number => Number.isFinite(number));
      if (!valid.length) return 0;
      return valid.reduce((sum, number) => sum + number, 0) / valid.length;
    }

    function getTeamRatings(squad) {
      const players = Array.isArray(squad) ? squad : [];
      const bat = average(players.map(player => Number(player?.attributes?.overall?.batting_overall) || 0));
      const bowl = average(players.map(player => Number(player?.attributes?.overall?.bowling_overall) || 0));
      const field = average(players.map(player => {
        const f = player?.attributes?.fielding || {};
        return average([Number(f.catching) || 0, Number(f.reflexes) || 0, Number(f.groundFielding) || 0, Number(f.throwPower) || 0, Number(f.throwAccuracy) || 0]);
      }));
      return { bat: Math.round(bat * 5), bowl: Math.round(bowl * 5), field: Math.round(field * 5) };
    }

    function getVenueData(match, userTeam) {
      const venue = match?.venue || "National Cricket Stadium";
      const format = String(match?.format || "T20");
      if (format === "Test") {
        return {
          weather: { title: "Clear Skies • 27°C", text: "Good long-format conditions. The pitch may change slowly across the match.", wind: "Wind 10 km/h", humidity: "Humidity 48%" },
          pitch: { title: "Balanced Test Surface", text: "Batting should be easier early, but bowlers may find help as the pitch wears.", bounce: "Bounce: True", assist: "Assist: Late Spin" },
          stadium: { name: venue, text: `${userTeam} home venue. Long match conditions expected.`, capacity: "Capacity 25,000+", crowd: "Crowd: Building" }
        };
      }
      if (format === "ODI") {
        return {
          weather: { title: "Partly Cloudy • 28°C", text: "Good one-day conditions. The ball should come onto the bat early.", wind: "Wind 12 km/h", humidity: "Humidity 54%" },
          pitch: { title: "Dry Batting Surface", text: "Good for batting first. Spin may become stronger later in the match.", bounce: "Bounce: Medium", assist: "Assist: Spin Late" },
          stadium: { name: venue, text: `${userTeam} home venue. Chasing may depend on dew and pitch pace.`, capacity: "Capacity 25,000+", crowd: "Crowd: Loud" }
        };
      }
      return {
        weather: { title: "Night Match • 26°C", text: "Fast-paced T20 conditions. Dew may make bowling second harder.", wind: "Wind 8 km/h", humidity: "Humidity 60%" },
        pitch: { title: "Hard T20 Surface", text: "Good for aggressive batting. Bowlers need variations and death control.", bounce: "Bounce: Good", assist: "Assist: Dew Later" },
        stadium: { name: venue, text: `${userTeam} home venue. Short-format energy expected from the crowd.`, capacity: "Capacity 25,000+", crowd: "Crowd: Electric" }
      };
    }

    function buildMatchDataFromStorage() {
      const stored = getStoredTourMatch();
      if (!stored) {
        return {
          matchType: "T20 • Match",
          teamA: { name: "Bangladesh", short: "BAN", sub: "User Team", captain: "Captain", bat: 84, bowl: 79, field: 82 },
          teamB: { name: "Zimbabwe", short: "ZIM", sub: "Computer Team", captain: "Captain", bat: 76, bowl: 74, field: 78 },
          weather: { title: "Partly Cloudy • 28°C", text: "Default toss conditions loaded.", wind: "Wind 12 km/h", humidity: "Humidity 54%" },
          pitch: { title: "Dry Surface", text: "Good for batting first. Spin may matter later.", bounce: "Bounce: Medium", assist: "Assist: Spin Late" },
          stadium: { name: "National Cricket Stadium", text: "Default venue.", capacity: "Capacity 25,000", crowd: "Crowd: Loud" }
        };
      }
      const userRatings = getTeamRatings(stored.userSquad);
      const computerRatings = getTeamRatings(stored.computerSquad);
      const venueData = getVenueData(stored.match, stored.userTeam);
      return {
        matchType: `${stored.match?.format || "Match"} • ${stored.match?.title || "Tour Match"}`,
        teamA: { name: stored.userTeam, short: getTeamShortName(stored.userTeam), sub: "User Team", captain: getCaptain(stored.userSquad), bat: userRatings.bat, bowl: userRatings.bowl, field: userRatings.field },
        teamB: { name: stored.computerTeam, short: getTeamShortName(stored.computerTeam), sub: "Computer Team", captain: getCaptain(stored.computerSquad), bat: computerRatings.bat, bowl: computerRatings.bowl, field: computerRatings.field },
        weather: venueData.weather,
        pitch: venueData.pitch,
        stadium: venueData.stadium
      };
    }

    const currentTourMatch = getStoredTourMatch();
    const matchData = buildMatchDataFromStorage();
    let userCall = "Heads";
    let tossWinner = "";
    let isFlipping = false;
    let tossCompleted = false;

    const canvas = document.getElementById("coinCanvas");
    const ctx = canvas.getContext("2d");
    let coinAngle = 0;
    let currentFace = "Heads";

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }

    function setupCanvas() {
      const cssSize = canvas.getBoundingClientRect().width || 260;
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.round(cssSize * dpr);
      canvas.height = Math.round(cssSize * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCoin(coinAngle, 0, 0, false);
    }

    function drawEllipseCircle(x, y, radius, scaleX, fillStyle, strokeStyle, lineWidth) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scaleX, 1);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = fillStyle;
      ctx.fill();
      if (strokeStyle) {
        ctx.lineWidth = lineWidth / Math.max(scaleX, 0.12);
        ctx.strokeStyle = strokeStyle;
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawRidges(cx, cy, r, scaleX) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scaleX, 1);
      for (let i = 0; i < 72; i++) {
        const a = (Math.PI * 2 * i) / 72;
        const next = a + Math.PI * 2 / 110;
        ctx.beginPath();
        ctx.arc(0, 0, r + 4, a, next);
        ctx.lineWidth = 5;
        ctx.strokeStyle = i % 2 === 0 ? "rgba(255,236,151,0.92)" : "rgba(112,77,16,0.88)";
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFaceText(cx, cy, face, scaleX, showText) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scaleX, 1);
      const badge = ctx.createRadialGradient(-18, -22, 5, 0, 0, 45);
      badge.addColorStop(0, "rgba(255,255,255,0.58)");
      badge.addColorStop(0.35, "rgba(246,196,83,0.95)");
      badge.addColorStop(1, "rgba(148,98,18,0.98)");
      ctx.beginPath();
      ctx.arc(0, 0, 43, 0, Math.PI * 2);
      ctx.fillStyle = badge;
      ctx.fill();
      ctx.lineWidth = 2.5 / Math.max(scaleX, 0.18);
      ctx.strokeStyle = "rgba(255,240,174,0.75)";
      ctx.stroke();
      if (showText) {
        ctx.fillStyle = "#071018";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(255,255,255,0.18)";
        ctx.shadowBlur = 10;
        ctx.font = "950 54px Arial";
        ctx.fillText(face === "Heads" ? "H" : "T", 0, -4);
        ctx.shadowBlur = 0;
        ctx.font = "950 9px Arial";
        ctx.fillStyle = "rgba(7,16,24,0.86)";
        ctx.fillText(face.toUpperCase(), 0, 29);
      }
      ctx.restore();
    }

    function drawCoin(angle, lift, progress, spinning) {
      const cssSize = canvas.getBoundingClientRect().width || 260;
      ctx.clearRect(0, 0, cssSize, cssSize);
      const cx = cssSize / 2;
      const groundY = cssSize * 0.80;
      const cy = cssSize * 0.50 + lift;
      const radius = cssSize * 0.285;
      const rawScale = Math.abs(Math.cos(angle));
      const scaleX = Math.max(0.09, rawScale);
      const face = Math.cos(angle) >= 0 ? "Heads" : "Tails";
      currentFace = face;
      const isEdgeOn = rawScale < 0.22;
      const showText = !spinning || (progress > 0.78 && rawScale > 0.42);

      const height = Math.max(0, -lift);
      const shadowScale = Math.max(0.45, 1 - height / 180);
      ctx.save();
      ctx.translate(cx, groundY);
      ctx.scale(1.05 * shadowScale, 0.18 * shadowScale);
      const shadow = ctx.createRadialGradient(0, 0, 10, 0, 0, radius * 1.45);
      shadow.addColorStop(0, "rgba(0,0,0,0.56)");
      shadow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawRidges(cx, cy, radius, scaleX);
      const outer = ctx.createRadialGradient(cx - radius * 0.45 * scaleX, cy - radius * 0.5, 5, cx, cy, radius * 1.25);
      outer.addColorStop(0, "#fff3b0");
      outer.addColorStop(0.24, "#f6d96b");
      outer.addColorStop(0.58, "#bb8420");
      outer.addColorStop(1, "#5b3908");
      drawEllipseCircle(cx, cy, radius, scaleX, outer, "rgba(255,240,174,0.75)", 3);
      const centerGrad = ctx.createRadialGradient(cx - radius * 0.25 * scaleX, cy - radius * 0.32, 4, cx, cy, radius * 0.9);
      centerGrad.addColorStop(0, "rgba(255,255,255,0.35)");
      centerGrad.addColorStop(0.18, "#1d3550");
      centerGrad.addColorStop(0.62, "#071827");
      centerGrad.addColorStop(1, "#02080d");
      drawEllipseCircle(cx, cy, radius * 0.82, scaleX, centerGrad, "rgba(248,250,252,0.24)", 2);
      if (!isEdgeOn) {
        drawFaceText(cx, cy, face, scaleX, showText);
      } else {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scaleX, 1);
        ctx.fillStyle = "rgba(246,196,83,0.95)";
        ctx.fillRect(-radius * 0.55, -radius * 0.78, radius * 1.1, radius * 1.56);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scaleX, 1);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.96, 0, Math.PI * 2);
      ctx.clip();
      const shine = ctx.createRadialGradient(-radius * 0.35, -radius * 0.42, radius * 0.05, -radius * 0.12, -radius * 0.20, radius * 1.15);
      shine.addColorStop(0, "rgba(255,255,255,0.46)");
      shine.addColorStop(0.22, "rgba(255,255,255,0.22)");
      shine.addColorStop(0.55, "rgba(255,255,255,0.06)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shine;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.96, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function setFinalFace(outcome) {
      coinAngle = outcome === "Heads" ? 0 : Math.PI;
      currentFace = outcome;
      drawCoin(coinAngle, 0, 1, false);
    }

    function pctWidth(value) {
      return `${Math.max(5, Math.min(100, Number(value) || 0))}%`;
    }

    function loadMatchData() {
      document.getElementById("matchType").textContent = matchData.matchType;
      document.getElementById("tickerText").textContent = `${matchData.teamA.name} vs ${matchData.teamB.name} • Toss window open • Captains at the middle • Winner decides bat or bowl`;
      document.getElementById("teamAName").textContent = matchData.teamA.name;
      document.getElementById("teamASub").textContent = matchData.teamA.sub;
      document.getElementById("teamABadge").textContent = matchData.teamA.short;
      document.getElementById("teamACaptain").textContent = matchData.teamA.captain;
      document.getElementById("teamABat").textContent = matchData.teamA.bat;
      document.getElementById("teamABowl").textContent = matchData.teamA.bowl;
      document.getElementById("teamAField").textContent = matchData.teamA.field;
      document.getElementById("teamAPower").style.width = pctWidth(average([matchData.teamA.bat, matchData.teamA.bowl, matchData.teamA.field]));
      document.getElementById("teamBName").textContent = matchData.teamB.name;
      document.getElementById("teamBSub").textContent = matchData.teamB.sub;
      document.getElementById("teamBBadge").textContent = matchData.teamB.short;
      document.getElementById("teamBCaptain").textContent = matchData.teamB.captain;
      document.getElementById("teamBBat").textContent = matchData.teamB.bat;
      document.getElementById("teamBBowl").textContent = matchData.teamB.bowl;
      document.getElementById("teamBField").textContent = matchData.teamB.field;
      document.getElementById("teamBPower").style.width = pctWidth(average([matchData.teamB.bat, matchData.teamB.bowl, matchData.teamB.field]));
      document.getElementById("weatherTitle").textContent = matchData.weather.title;
      document.getElementById("weatherText").textContent = matchData.weather.text;
      document.getElementById("weatherWind").textContent = matchData.weather.wind;
      document.getElementById("weatherHumidity").textContent = matchData.weather.humidity;
      document.getElementById("pitchTitle").textContent = matchData.pitch.title;
      document.getElementById("pitchText").textContent = matchData.pitch.text;
      document.getElementById("pitchBounce").textContent = matchData.pitch.bounce;
      document.getElementById("pitchAssist").textContent = matchData.pitch.assist;
      document.getElementById("stadiumName").textContent = matchData.stadium.name;
      document.getElementById("stadiumText").textContent = matchData.stadium.text;
      document.getElementById("stadiumCapacity").textContent = matchData.stadium.capacity;
      document.getElementById("stadiumCrowd").textContent = matchData.stadium.crowd;
    }

    function selectCall(call) {
      if (isFlipping) return;
      userCall = call;
      document.getElementById("headsBtn").classList.toggle("active", call === "Heads");
      document.getElementById("tailsBtn").classList.toggle("active", call === "Tails");
      document.getElementById("resultTitle").textContent = `${matchData.teamA.name} calls ${call}`;
      document.getElementById("resultText").textContent = "Now press Flip Toss. The coin will rotate physically and reveal the result when it lands.";
      document.getElementById("continueBtn").style.display = "none";
      flashResult();
    }

    function flashResult() {
      const resultBox = document.getElementById("resultBox");
      resultBox.classList.remove("flash-result");
      void resultBox.offsetWidth;
      resultBox.classList.add("flash-result");
    }

    function createSparkBurst() {
      const coinArea = document.getElementById("coinArea");
      const colors = ["gold", "blue", "green"];
      for (let i = 0; i < 30; i++) {
        const spark = document.createElement("span");
        spark.className = "spark";
        const color = colors[i % colors.length];
        if (color !== "gold") spark.classList.add(color);
        const angle = (Math.PI * 2 * i) / 30;
        const distance = 76 + Math.random() * 68;
        spark.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
        spark.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
        coinArea.appendChild(spark);
        setTimeout(() => spark.remove(), 820);
      }
    }

    function animateCoinTo(outcome, done) {
      const startAngle = coinAngle;
      const finalBase = outcome === "Heads" ? 0 : Math.PI;
      let rotations = 7 + Math.floor(Math.random() * 2);
      let targetAngle = finalBase + rotations * Math.PI * 2;
      while (targetAngle <= startAngle + Math.PI * 6) targetAngle += Math.PI * 2;
      const startTime = performance.now();
      const duration = 1850;
      function frame(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const easedSpin = easeOutCubic(t);
        const jump = -82 * Math.sin(Math.PI * easeInOutSine(t));
        const wobble = Math.sin(t * Math.PI * 9) * (1 - t) * 0.20;
        coinAngle = startAngle + (targetAngle - startAngle) * easedSpin + wobble;
        drawCoin(coinAngle, jump, t, true);
        if (t < 1) requestAnimationFrame(frame);
        else {
          coinAngle = finalBase;
          drawCoin(coinAngle, 0, 1, false);
          done();
        }
      }
      requestAnimationFrame(frame);
    }

    function doToss() {
    if (isFlipping || tossCompleted) return;

    if (!userCall) {
        document.getElementById("resultTitle").textContent = "Choose Heads or Tails first";
        document.getElementById("resultText").textContent = "Click one toss call before flipping the coin.";
        flashResult();
        return;
    }

    isFlipping = true;
    tossCompleted = true;

    const coinArea = document.getElementById("coinArea");
    const flipBtn = document.getElementById("flipBtn");
    const headsBtn = document.getElementById("headsBtn");
    const tailsBtn = document.getElementById("tailsBtn");
    const decisionRow = document.getElementById("decisionRow");

    decisionRow.classList.remove("show");

    const outcome = Math.random() < 0.5 ? "Heads" : "Tails";

    coinArea.classList.add("flipping");

    flipBtn.disabled = true;
    flipBtn.classList.add("locked");
    flipBtn.textContent = "Toss Completed";

    headsBtn.disabled = true;
    tailsBtn.disabled = true;

    document.getElementById("resultTitle").textContent = "Coin flipping...";
    document.getElementById("resultText").textContent =
        "The coin is rotating, turning edge-on, and slowing into the final result.";

    setTimeout(createSparkBurst, 1260);

    animateCoinTo(outcome, () => {
        coinArea.classList.remove("flipping");
        setFinalFace(outcome);
        flashResult();

        const userWon = outcome === userCall;
        tossWinner = userWon ? matchData.teamA.name : matchData.teamB.name;

        document.getElementById("resultTitle").textContent = `${outcome}! ${tossWinner} won the toss`;

        if (userWon) {
        document.getElementById("resultText").textContent =
            `${matchData.teamA.name} called ${userCall} correctly. Choose whether to bat or bowl first.`;

        decisionRow.classList.add("show");
        } else {
        const computerDecision = getComputerDecision();

        saveTossData(computerDecision, matchData.teamB.name);

        document.getElementById("resultText").textContent =
            `${matchData.teamA.name} called ${userCall}, but it landed ${outcome}. ${matchData.teamB.name} chooses to ${computerDecision.toLowerCase()} first.`;

        const continueBtn = document.getElementById("continueBtn");
        if (continueBtn) continueBtn.style.display = "block";
        }

        isFlipping = false;
        tossCompleted = false;
    });
    }

    function getComputerDecision() {
      const pitch = matchData.pitch.title.toLowerCase();
      if (pitch.includes("dry") || pitch.includes("batting")) return "Bat";
      if (pitch.includes("dew")) return "Bowl";
      return Math.random() < 0.5 ? "Bat" : "Bowl";
    }

    function saveTossData(decision, winnerName) {
      const tossData = {
        matchIndex: currentTourMatch?.matchIndex ?? null,
        winner: winnerName,
        decision,
        userCall,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem("currentTossResult", JSON.stringify(tossData));
      if (currentTourMatch) {
        currentTourMatch.toss = tossData;
        localStorage.setItem("currentTourMatch", JSON.stringify(currentTourMatch));
      }
    }

    function chooseDecision(decision) {
      if (!tossWinner) return;
      saveTossData(decision, tossWinner);
      document.getElementById("resultTitle").textContent = `${tossWinner} chooses to ${decision}`;
      document.getElementById("resultText").textContent = `${decision === "Bat" ? "Batting first selected." : "Bowling first selected."} Continue to Match Center.`;
      document.getElementById("continueBtn").style.display = "block";
      document.querySelectorAll("#decisionRow button").forEach((button) => {
        button.disabled = true;
        });
      flashResult();
    }

    function goToMatchCenter() {
      window.location.href = "match-center.html";
    }

    window.addEventListener("resize", setupCanvas);
    loadMatchData();
    setupCanvas();
    setFinalFace("Heads");