"use strict";

(() => {
  const STORAGE_KEY = "stopwatch.world-clock.cities.v1";
  const TIME_API_URL =
    "https://timeapi.io/api/Time/current/zone?timeZone=Etc%2FUTC";
  const SYNC_INTERVAL_MS = 5 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 8000;

  const CITIES = [
    { id: "jakarta", name: "Jakarta", country: "Indonesia", timeZone: "Asia/Jakarta" },
    { id: "singapore", name: "Singapura", country: "Singapura", timeZone: "Asia/Singapore" },
    { id: "bangkok", name: "Bangkok", country: "Thailand", timeZone: "Asia/Bangkok" },
    { id: "mumbai", name: "Mumbai", country: "India", timeZone: "Asia/Kolkata" },
    { id: "dubai", name: "Dubai", country: "Uni Emirat Arab", timeZone: "Asia/Dubai" },
    { id: "beijing", name: "Beijing", country: "Tiongkok", timeZone: "Asia/Shanghai" },
    { id: "tokyo", name: "Tokyo", country: "Jepang", timeZone: "Asia/Tokyo" },
    { id: "seoul", name: "Seoul", country: "Korea Selatan", timeZone: "Asia/Seoul" },
    { id: "sydney", name: "Sydney", country: "Australia", timeZone: "Australia/Sydney" },
    { id: "auckland", name: "Auckland", country: "Selandia Baru", timeZone: "Pacific/Auckland" },
    { id: "johannesburg", name: "Johannesburg", country: "Afrika Selatan", timeZone: "Africa/Johannesburg" },
    { id: "london", name: "London", country: "Britania Raya", timeZone: "Europe/London" },
    { id: "paris", name: "Paris", country: "Prancis", timeZone: "Europe/Paris" },
    { id: "toronto", name: "Toronto", country: "Kanada", timeZone: "America/Toronto" },
    { id: "new-york", name: "New York", country: "Amerika Serikat", timeZone: "America/New_York" },
    { id: "chicago", name: "Chicago", country: "Amerika Serikat", timeZone: "America/Chicago" },
    { id: "los-angeles", name: "Los Angeles", country: "Amerika Serikat", timeZone: "America/Los_Angeles" },
    { id: "sao-paulo", name: "São Paulo", country: "Brasil", timeZone: "America/Sao_Paulo" }
  ];

  const cityById = new Map(CITIES.map((city) => [city.id, city]));
  const cityByName = new Map(
    CITIES.map((city) => [city.name.toLocaleLowerCase("id-ID"), city])
  );

  const cityList = document.getElementById("world-clock-list");
  const cityOptions = document.getElementById("world-clock-city-options");
  const cityForm = document.getElementById("world-clock-form");
  const citySearch = document.getElementById("world-clock-search");
  const emptyMessage = document.getElementById("world-clock-empty");
  const syncStatus = document.getElementById("world-clock-sync");
  const feedbackMessage = document.getElementById("world-clock-message");

  if (
    !(cityList instanceof HTMLOListElement) ||
    !(cityOptions instanceof HTMLDataListElement) ||
    !(cityForm instanceof HTMLFormElement) ||
    !(citySearch instanceof HTMLInputElement) ||
    !(emptyMessage instanceof HTMLElement) ||
    !(syncStatus instanceof HTMLElement) ||
    !(feedbackMessage instanceof HTMLElement)
  ) {
    console.error("Jam Dunia: elemen HTML yang dibutuhkan tidak ditemukan.");
    return;
  }

  const timeFormatters = new Map(
    CITIES.map((city) => [
      city.id,
      new Intl.DateTimeFormat("id-ID", {
        timeZone: city.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      })
    ])
  );

  const dateFormatters = new Map(
    CITIES.map((city) => [
      city.id,
      new Intl.DateTimeFormat("id-ID", {
        timeZone: city.timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    ])
  );

  const cardElements = new Map();

  let selectedCityIds = loadCitySelection();
  let synchronizedEpochMs = null;
  let synchronizedPerformanceMs = null;
  let syncInProgress = false;

  function setFeedback(message, isError = false) {
    feedbackMessage.textContent = message;
    feedbackMessage.classList.toggle("is-error", isError);
  }

  function loadCitySelection() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored === null) {
        return CITIES.map((city) => city.id);
      }

      const parsed = JSON.parse(stored);

      if (
        !Array.isArray(parsed) ||
        parsed.some((id) => typeof id !== "string" || !cityById.has(id))
      ) {
        throw new Error("Format daftar kota yang tersimpan tidak valid.");
      }

      return [...new Set(parsed)];
    } catch (error) {
      console.error("Daftar kota Jam Dunia gagal dimuat:", error);
      setFeedback(
        "Daftar kota tidak dapat dibaca. Daftar awal ditampilkan untuk sesi ini.",
        true
      );
      return CITIES.map((city) => city.id);
    }
  }

  function saveCitySelection() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedCityIds));
      return true;
    } catch (error) {
      console.error("Daftar kota Jam Dunia gagal disimpan:", error);
      setFeedback(
        "Daftar kota berubah untuk sesi ini, tetapi tidak dapat disimpan di browser.",
        true
      );
      return false;
    }
  }

  function renderCityOptions() {
    cityOptions.replaceChildren();

    for (const city of CITIES) {
      const option = document.createElement("option");
      option.value = city.name;
      option.label = `${city.name} — ${city.country}`;
      cityOptions.append(option);
    }
  }

  function renderCities() {
    cardElements.clear();
    cityList.replaceChildren();

    for (const city of CITIES) {
      if (!selectedCityIds.includes(city.id)) continue;

      const item = document.createElement("li");
      const details = document.createElement("div");
      const name = document.createElement("span");
      const country = document.createElement("span");
      const time = document.createElement("time");
      const date = document.createElement("span");
      const zone = document.createElement("span");
      const removeButton = document.createElement("button");

      item.className = "world-clock-card";

      details.className = "world-clock-details";
      name.className = "world-clock-city";
      name.textContent = city.name;
      country.className = "world-clock-country";
      country.textContent = city.country;

      time.className = "world-clock-time";
      time.setAttribute("aria-label", `Waktu di ${city.name}`);

      date.className = "world-clock-date";

      zone.className = "world-clock-zone";
      zone.textContent = city.timeZone;

      removeButton.className = "world-clock-remove";
      removeButton.type = "button";
      removeButton.textContent = "Hapus";
      removeButton.setAttribute("aria-label", `Hapus ${city.name}`);
      removeButton.addEventListener("click", () => removeCity(city.id));

      details.append(name, country);
      item.append(details, time, date, zone, removeButton);
      cityList.append(item);

      cardElements.set(city.id, { time, date });
    }

    emptyMessage.hidden = selectedCityIds.length > 0;
    updateClocks();
  }

  function getCurrentTimeMs() {
    if (
      synchronizedEpochMs !== null &&
      synchronizedPerformanceMs !== null &&
      navigator.onLine
    ) {
      return synchronizedEpochMs + performance.now() - synchronizedPerformanceMs;
    }

    return Date.now();
  }

  function updateClocks() {
    const nowMs = getCurrentTimeMs();
    const now = new Date(nowMs);
    const isoDateTime = now.toISOString();

    for (const [cityId, elements] of cardElements) {
      elements.time.textContent = timeFormatters.get(cityId).format(now);
      elements.time.dateTime = isoDateTime;
      elements.date.textContent = dateFormatters.get(cityId).format(now);
    }
  }

  function setUnsynchronizedStatus() {
    synchronizedEpochMs = null;
    synchronizedPerformanceMs = null;

    syncStatus.textContent = navigator.onLine
      ? "Tidak tersinkron · waktu mengikuti jam perangkat"
      : "Offline · waktu mengikuti jam perangkat";

    updateClocks();
  }

  async function synchronizeTime() {
    if (syncInProgress) return;

    if (!navigator.onLine) {
      setUnsynchronizedStatus();
      return;
    }

    syncInProgress = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );
    const requestStart = performance.now();

    try {
      const response = await fetch(TIME_API_URL, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Server waktu merespons dengan status ${response.status}.`);
      }

      const data = await response.json();
      const requestEnd = performance.now();

      if (
        !data ||
        data.timeZone !== "Etc/UTC" ||
        typeof data.dateTime !== "string"
      ) {
        throw new Error("Format waktu dari server tidak sesuai.");
      }

      const serverEpochMs = Date.parse(`${data.dateTime}Z`);

      if (!Number.isFinite(serverEpochMs)) {
        throw new Error("Waktu yang diterima dari server tidak valid.");
      }

      synchronizedEpochMs = serverEpochMs;
      synchronizedPerformanceMs = (requestStart + requestEnd) / 2;

      const syncedAt = new Date(serverEpochMs).toLocaleTimeString("id-ID", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      });

      syncStatus.textContent = `Tersinkron online · pembaruan ${syncedAt} UTC`;
      updateClocks();
    } catch (error) {
      console.warn("Sinkronisasi Jam Dunia gagal:", error);
      setUnsynchronizedStatus();
    } finally {
      window.clearTimeout(timeoutId);
      syncInProgress = false;
    }
  }

  function addCity(city) {
    if (selectedCityIds.includes(city.id)) {
      setFeedback(`${city.name} sudah ada di daftar.`);
      return;
    }

    selectedCityIds = [...selectedCityIds, city.id];
    renderCities();

    if (saveCitySelection()) {
      setFeedback(`${city.name} ditambahkan.`);
    }

    citySearch.value = "";
    citySearch.focus();
  }

  function removeCity(cityId) {
    const city = cityById.get(cityId);
    if (!city) return;

    selectedCityIds = selectedCityIds.filter((id) => id !== cityId);
    renderCities();

    if (saveCitySelection()) {
      setFeedback(`${city.name} dihapus dari daftar.`);
    }
  }

  cityForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const searchValue = citySearch.value.trim().toLocaleLowerCase("id-ID");
    const city = cityByName.get(searchValue);

    if (!city) {
      setFeedback("Pilih kota dari daftar kota yang tersedia.", true);
      citySearch.focus();
      return;
    }

    addCity(city);
  });

  window.addEventListener("online", synchronizeTime);

  window.addEventListener("offline", () => {
    setUnsynchronizedStatus();
  });

  renderCityOptions();
  renderCities();
  window.setInterval(updateClocks, 1000);
  synchronizeTime();
  window.setInterval(synchronizeTime, SYNC_INTERVAL_MS);
})();