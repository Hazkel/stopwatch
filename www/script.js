"use strict";

const HISTORY_KEY = "stopwatch.history.v1";
const THEME_KEY = "stopwatch.theme";
const MAX_HISTORY = 50;

const display = document.getElementById("time-display");
const startButton = document.getElementById("start-button");
const lapButton = document.getElementById("lap-button");
const saveButton = document.getElementById("save-button");
const resetButton = document.getElementById("reset-button");
const status = document.getElementById("status");
const lapCount = document.getElementById("lap-count");
const lapList = document.getElementById("lap-list");
const lapEmpty = document.getElementById("lap-empty");
const historyCount = document.getElementById("history-count");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const themeToggle = document.getElementById("theme-toggle");
const themeLabel = document.getElementById("theme-label");
const themeIcon = document.getElementById("theme-icon");

let elapsedMs = 0;
let startedAt = null;
let intervalId = null;
let laps = [];
let previousLapMs = 0;
let history = [];
let isSaved = false;

function getElapsedMs() {
  return startedAt === null
    ? elapsedMs
    : elapsedMs + performance.now() - startedAt;
}

function formatTime(milliseconds) {
  const totalCentiseconds = Math.floor(Math.max(0, milliseconds) / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0")
  ].join(":") + "." + String(centiseconds).padStart(2, "0");
}

function setStatus(message, { running = false, error = false } = {}) {
  status.textContent = message;
  status.classList.toggle("is-running", running);
  status.classList.toggle("is-error", error);
}

function updateControls() {
  const running = startedAt !== null;
  const hasElapsedTime = getElapsedMs() > 0;

  startButton.textContent = running
    ? "Jeda"
    : hasElapsedTime
      ? "Lanjutkan"
      : "Mulai";

  lapButton.disabled = !hasElapsedTime;
  saveButton.disabled = running || !hasElapsedTime || isSaved;
  resetButton.disabled = !running && !hasElapsedTime && laps.length === 0;
}

function updateDisplay() {
  display.textContent = formatTime(getElapsedMs());
  updateControls();
}

function startStopwatch() {
  if (startedAt !== null) return;

  isSaved = false;
  startedAt = performance.now();
  intervalId = window.setInterval(updateDisplay, 10);
  setStatus("Stopwatch sedang berjalan", { running: true });
  updateDisplay();
}

function pauseStopwatch() {
  if (startedAt === null) return;

  elapsedMs = getElapsedMs();
  startedAt = null;
  window.clearInterval(intervalId);
  intervalId = null;

  setStatus("Stopwatch dijeda");
  updateDisplay();
}

function resetStopwatch() {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
  }

  elapsedMs = 0;
  startedAt = null;
  intervalId = null;
  laps = [];
  previousLapMs = 0;
  isSaved = false;

  display.textContent = formatTime(0);
  lapList.replaceChildren();
  lapCount.textContent = "0 putaran";
  lapEmpty.hidden = false;
  setStatus("Siap dimulai");
  updateControls();
}

function recordLap() {
  const currentMs = Math.floor(getElapsedMs());

  if (currentMs <= 0) return;

  laps.push({
    splitMs: currentMs - previousLapMs,
    totalMs: currentMs
  });

  previousLapMs = currentMs;
  isSaved = false;
  renderLaps();
  updateControls();
}

function renderLaps() {
  lapList.replaceChildren();
  lapCount.textContent = `${laps.length} putaran`;
  lapEmpty.hidden = laps.length > 0;

  for (let index = laps.length - 1; index >= 0; index -= 1) {
    const lap = laps[index];
    const item = document.createElement("li");
    const details = document.createElement("div");
    const label = document.createElement("span");
    const split = document.createElement("span");
    const total = document.createElement("span");

    item.className = "list-item";

    label.className = "item-label";
    label.textContent = `Putaran ${index + 1}`;

    split.className = "item-value";
    split.textContent = formatTime(lap.splitMs);

    total.className = "item-total";
    total.textContent = formatTime(lap.totalMs);
    total.setAttribute("aria-label", `Total waktu ${formatTime(lap.totalMs)}`);

    details.append(label, split);
    item.append(details, total);
    lapList.append(item);
  }
}

function isValidSession(session) {
  if (
    !session ||
    typeof session !== "object" ||
    !Number.isSafeInteger(session.durationMs) ||
    session.durationMs < 0 ||
    typeof session.createdAt !== "string" ||
    !Array.isArray(session.laps)
  ) {
    return false;
  }

  let previousTotal = 0;

  return session.laps.every((lap) => {
    const valid =
      lap &&
      Number.isSafeInteger(lap.splitMs) &&
      Number.isSafeInteger(lap.totalMs) &&
      lap.splitMs >= 0 &&
      lap.totalMs >= previousTotal &&
      lap.totalMs <= session.durationMs;

    if (valid) previousTotal = lap.totalMs;
    return valid;
  });
}

function loadHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);

    if (stored === null) {
      history = [];
    } else {
      const parsed = JSON.parse(stored);

      if (!Array.isArray(parsed) || !parsed.every(isValidSession)) {
        throw new Error("Format riwayat yang tersimpan tidak valid.");
      }

      history = parsed.slice(0, MAX_HISTORY);
    }

    renderHistory();
  } catch (error) {
    history = [];
    renderHistory();
    console.error("Riwayat stopwatch gagal dimuat:", error);
    setStatus("Riwayat lokal tidak dapat dibaca", { error: true });
  }
}

function renderHistory() {
  historyList.replaceChildren();
  historyCount.textContent = `${history.length} hasil`;
  historyEmpty.hidden = history.length > 0;

  for (const session of history) {
    const item = document.createElement("li");
    const details = document.createElement("div");
    const date = document.createElement("span");
    const lapSummary = document.createElement("span");
    const duration = document.createElement("span");
    const createdAt = new Date(session.createdAt);

    item.className = "list-item";

    date.className = "item-label";
    date.textContent = Number.isNaN(createdAt.getTime())
      ? "Waktu tidak tersedia"
      : createdAt.toLocaleString("id-ID", {
          dateStyle: "medium",
          timeStyle: "short"
        });

    lapSummary.className = "item-value";
    lapSummary.textContent = `${session.laps.length} putaran`;

    duration.className = "item-total";
    duration.textContent = formatTime(session.durationMs);

    details.append(date, lapSummary);
    item.append(details, duration);
    historyList.append(item);
  }
}

function saveResult() {
  if (startedAt !== null || getElapsedMs() <= 0) return;

  const session = {
    createdAt: new Date().toISOString(),
    durationMs: Math.floor(elapsedMs),
    laps: laps.map((lap) => ({
      splitMs: lap.splitMs,
      totalMs: lap.totalMs
    }))
  };

  try {
    const updatedHistory = [session, ...history].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));

    history = updatedHistory;
    isSaved = true;
    renderHistory();
    setStatus("Hasil berhasil disimpan di browser");
    updateControls();
  } catch (error) {
    console.error("Gagal menyimpan riwayat stopwatch:", error);
    setStatus("Gagal menyimpan. Penyimpanan browser tidak tersedia.", {
      error: true
    });
  }
}

function setTheme(theme, persist = true) {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selectedTheme;

  const isDark = selectedTheme === "dark";
  const nextLabel = isDark ? "Mode terang" : "Mode gelap";
  themeLabel.textContent = nextLabel;
  themeToggle.setAttribute("aria-label", `Aktifkan ${nextLabel.toLowerCase()}`);
  themeToggle.title = `Aktifkan ${nextLabel.toLowerCase()}`;
  themeIcon.textContent = isDark ? "☼" : "◐";

  const themeColor = isDark ? "#080808" : "#ffffff";
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute("content", themeColor);

  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, selectedTheme);
    } catch (error) {
      console.error("Preferensi tema gagal disimpan:", error);
      setStatus("Tema berubah, tetapi preferensi tidak dapat disimpan.", {
        error: true
      });
    }
  }
}

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme;
  setTheme(currentTheme === "dark" ? "light" : "dark");
});

startButton.addEventListener("click", () => {
  if (startedAt === null) startStopwatch();
  else pauseStopwatch();
});

lapButton.addEventListener("click", recordLap);
saveButton.addEventListener("click", saveResult);
resetButton.addEventListener("click", resetStopwatch);

setTheme(document.documentElement.dataset.theme || "light", false);
loadHistory();
updateControls();