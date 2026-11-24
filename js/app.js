function updateSyncBadges(online, labelText) {
  const loginBadge = document.getElementById("login-sync-badge");
  const headerBadge = document.getElementById("header-sync-badge");
  if (online) {
    if (loginBadge) {
      loginBadge.className = "inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30";
      loginBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span> ${labelText || "Firebase Online"}`;
    }
    if (headerBadge) {
      headerBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30";
      headerBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ${labelText || "Online"}`;
    }
  } else {
    if (loginBadge) {
      loginBadge.className = "inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30";
      loginBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> ${labelText || "Lokální režim"}`;
    }
    if (headerBadge) {
      headerBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30";
      headerBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Lokální`;
    }
  }
}

function mergeRemoteState(remote) {
  if (!remote || typeof remote !== "object") return;
  if (Array.isArray(remote.depots) && remote.depots.length > 0) appState.depots = remote.depots;
  if (Array.isArray(remote.calendars) && remote.calendars.length > 0) appState.calendars = remote.calendars;
  if (Array.isArray(remote.users) && remote.users.length > 0) appState.users = remote.users;
  if (remote.shiftTimes) appState.shiftTimes = remote.shiftTimes;
  if (remote.schedules) appState.schedules = remote.schedules;
  if (Array.isArray(remote.agSlots)) appState.agSlots = remote.agSlots;
  if (Array.isArray(remote.requests)) appState.requests = remote.requests;
  if (remote.chats) appState.chats = remote.chats;
  if (remote.depotUserOrder) appState.depotUserOrder = remote.depotUserOrder;
  if (Array.isArray(remote.auditLog)) appState.auditLog = remote.auditLog;
  appState.version = APP_VERSION;
  ensureMultiDepotConsistency();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function pullFromFirebase(silent = true) {
  const curRole = normalizeUserRole(currentUser);
  if (silent && curRole === "admin" && activeAdminTab === "settings" && hasUnsavedAdminChanges) {
    return;
  }

  try {
    const res = await fetchWithTimeout(FIREBASE_DB_URL, {
      method: "GET",
      headers: { "Accept": "application/json" }
    }, 6000);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data && typeof data === "object") {
      mergeRemoteState(data);
      safeStorage.set("depotshift_cache", JSON.stringify(appState));
    } else {
      await pushToFirebase(true);
    }
    updateSyncBadges(true, "Firebase Online");
    if (currentUser) {
      const refreshed = appState.users.find(u => u.id === currentUser.id);
      if (refreshed) {
        refreshed.role = normalizeUserRole(refreshed);
        currentUser = refreshed;
      }
      if (!(normalizeUserRole(currentUser) === "admin" && activeAdminTab === "settings" && hasUnsavedAdminChanges)) {
        renderActiveRoleView();
      }
    }
    if (!silent) showToast("Synchronizováno s databází.", "success");
  } catch (err) {
    updateSyncBadges(false, "Lokální režim");
    if (!silent) showToast("Firebase nedostupná – běží lokální záloha.", "warn");
  }
}

async function pushToFirebase(silent = false) {
  appState.version = APP_VERSION;
  safeStorage.set("depotshift_cache", JSON.stringify(appState));
  try {
    const res = await fetchWithTimeout(FIREBASE_DB_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appState)
    }, 6000);
    if (!res.ok) throw new Error("HTTP " + res.status);
    updateSyncBadges(true, "Uloženo v cloudu");
  } catch (err) {
    updateSyncBadges(false, "Lokální režim");
    if (!silent) showToast("Uloženo lokálně (Firebase nedostupná).", "warn");
  }
}

function manualSyncNow() {
  if (hasUnsavedAdminChanges && activeAdminTab === "settings") {
    showToast("Nejprve uložte nebo zrušte rozpracované změny v Nastavení.", "warn");
    return;
  }
  pullFromFirebase(false);
}

function applyLanguage(lang) {
  currentLang = lang === "en" ? "en" : "cs";
  safeStorage.set("depotshift_lang", currentLang);

  document.querySelectorAll(".lang-toggle-btn").forEach(btn => {
    btn.innerHTML = `<i class="fa-solid fa-globe text-blue-400"></i> <span>${currentLang === "cs" ? "EN" : "CZ"}</span>`;
  });

  const setTxt = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = t(key); };
  setTxt("lbl-login-sub", "loginSub");
  setTxt("lbl-login-user", "loginUser");
  setTxt("lbl-login-pass", "loginPass");
  const loginSubSpan = document.querySelector("#btn-login-submit span");
  if (loginSubSpan) loginSubSpan.textContent = t("loginSubmit");
  setTxt("lbl-quick-access", "quickAccess");
  setTxt("lbl-btn-settings", "btnSettings");
  setTxt("lbl-bell-req", "bellReq");
  setTxt("lbl-logout", "logout");
  setTxt("lbl-active-depot", "activeDepot");
  setTxt("lbl-show-terminated", "showTerminated");
  setTxt("lbl-btn-auto", "btnAuto");
  setTxt("lbl-btn-sort", "btnSort");
  setTxt("lbl-btn-add-ag", "btnAddAg");
  setTxt("lbl-btn-export", "btnExport");
  setTxt("lbl-btn-clear", "btnClear");
  setTxt("vmode-month", "vmodeMonth");
  setTxt("vmode-biweek", "vmodeBiweek");
  setTxt("vmode-week", "vmodeWeek");
  setTxt("lbl-subtab-depots", "subtabDepots");
  setTxt("lbl-subtab-users", "subtabUsers");
  setTxt("lbl-subtab-calendars", "subtabCalendars");
  setTxt("lbl-subtab-audit", "subtabAudit");
  setTxt("lbl-back-roster", "backRoster");
  setTxt("lbl-depots-title", "depotsTitle");
  setTxt("lbl-depots-sub", "depotsSub");
  setTxt("lbl-btn-add-depot", "btnAddDepot");
  setTxt("lbl-btn-save-depots", "btnSaveDepots");
  setTxt("lbl-users-title", "usersTitle");
  setTxt("lbl-users-sub", "usersSub");
  setTxt("lbl-btn-add-user", "btnAddUser");
  setTxt("lbl-btn-save-users", "btnSaveUsers");
  setTxt("lbl-danger-title", "dangerTitle");
  setTxt("lbl-danger-sub", "dangerSub");
  setTxt("lbl-btn-reset-db", "btnResetDb");
  setTxt("lbl-emp-req-btn", "empReqBtn");
  setTxt("lbl-emp-chat-btn", "empChatBtn");
  setTxt("lbl-coord-title", "coordTitle");
  setTxt("lbl-coord-sub", "coordSub");
  setTxt("lbl-coord-save", "btnSaveUsers");
  setTxt("lbl-coord-sum-title", "coordSumTitle");
  setTxt("lbl-cal-title", "calTitle");
  setTxt("lbl-cal-sub", "calSub");
  setTxt("lbl-btn-add-cal", "btnAddCal");
  setTxt("lbl-chat-list", "chatList");
  setTxt("lbl-drag-hint", "dragHint");

  applyTheme(document.documentElement.getAttribute("data-theme") || "dark");
  if (currentUser) {
    buildNavigationForRole();
    renderActiveRoleView();
  }
}

function toggleLanguage() {
  applyLanguage(currentLang === "cs" ? "en" : "cs");
}

function applyTheme(theme) {
  const tMode = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", tMode);
  safeStorage.set("depotshift_theme", tMode);
  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    if (tMode === "light") {
      btn.innerHTML = `<i class="fa-solid fa-moon text-indigo-600"></i> <span class="hidden md:inline">${t("darkTheme")}</span>`;
    } else {
      btn.innerHTML = `<i class="fa-solid fa-sun text-amber-400"></i> <span class="hidden md:inline">${t("lightTheme")}</span>`;
    }
  });
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const loginVal = document.getElementById("login-username").value.trim().toLowerCase();
  const passVal = document.getElementById("login-password").value;
  attemptLogin(loginVal, passVal);
}

function quickLogin(login, pass) {
  document.getElementById("login-username").value = login;
  document.getElementById("login-password").value = pass;
  attemptLogin(login, pass);
}

function attemptLogin(loginVal, passVal) {
  const errBox = document.getElementById("login-error");
  const user = appState.users.find(u => u.login.toLowerCase() === loginVal && u.pass === passVal);
  if (!user) {
    errBox.textContent = currentLang === "en" ? "Invalid username or password." : "Neplatné uživatelské jméno nebo heslo.";
    errBox.classList.remove("hidden");
    return;
  }
  errBox.classList.add("hidden");
  completeLogin(user);
}

function completeLogin(user) {
  user.role = normalizeUserRole(user);
  currentUser = user;
  safeStorage.set("depotshift_session_uid", user.id);
  document.getElementById("login-screen").classList.add("hidden");
  const mainApp = document.getElementById("main-app");
  mainApp.classList.remove("hidden");
  mainApp.classList.add("flex");

  document.getElementById("current-user-name").textContent = user.name;
  document.getElementById("current-user-role").textContent = user.roleLabel || user.role;

  const settingsBtn = document.getElementById("btn-header-settings");
  if (user.role === "admin") {
    settingsBtn.classList.remove("hidden");
    settingsBtn.classList.add("inline-flex");
  } else {
    settingsBtn.classList.add("hidden");
    settingsBtn.classList.remove("inline-flex");
  }

  if (user.role === "coordinator") {
    coordSelectedDepotId = "ALL";
    activeCoordTab = "requests";
  }

  buildNavigationForRole();
  renderActiveRoleView();

  if (canUserApproveRequests(user)) {
    const pending = appState.requests.filter(r => r.status === "pending");
    if (pending.length > 0) openAdminRequestsModal();
  }
}

function logout() {
  currentUser = null;
  clearAdminDraftDirty();
  safeStorage.set("depotshift_session_uid", "");
  document.getElementById("main-app").classList.add("hidden");
  document.getElementById("main-app").classList.remove("flex");
  document.getElementById("login-screen").classList.remove("hidden");
}

function buildNavigationForRole() {
  const nav = document.getElementById("nav-tabs");
  nav.innerHTML = "";
  const bell = document.getElementById("admin-req-bell");
  const role = normalizeUserRole(currentUser);

  if (role === "admin") {
    bell.classList.remove("hidden");
    bell.classList.add("inline-flex");
    const tabs = [
      { id: "schedule", icon: "fa-calendar-days", label: t("tabSchedule") },
      { id: "chat", icon: "fa-comments", label: t("tabChat") }
    ];
    tabs.forEach(tItem => {
      const btn = document.createElement("button");
      const active = activeAdminTab === tItem.id;
      btn.className = `px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${active ? "bg-blue-600 text-white shadow" : "bg-slate-800/70 text-slate-300 hover:bg-slate-800"}`;
      btn.innerHTML = `<i class="fa-solid ${tItem.icon}"></i> ${tItem.label}`;
      btn.onclick = () => switchAdminTab(tItem.id);
      nav.appendChild(btn);
    });
  } else if (role === "coordinator") {
    bell.classList.add("hidden");
    const tabs = [
      { id: "requests", icon: "fa-clipboard-list", label: t("tabCoordReq") },
      { id: "summary", icon: "fa-chart-column", label: t("tabCoordSum") }
    ];
    tabs.forEach(tItem => {
      const btn = document.createElement("button");
      const active = activeCoordTab === tItem.id;
      btn.className = `px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${active ? "bg-purple-600 text-white shadow" : "bg-slate-800/70 text-slate-300 hover:bg-slate-800"}`;
      btn.innerHTML = `<i class="fa-solid ${tItem.icon}"></i> ${tItem.label}`;
      btn.onclick = () => { activeCoordTab = tItem.id; buildNavigationForRole(); renderActiveRoleView(); };
      nav.appendChild(btn);
    });
  } else {
    if (canUserApproveRequests(currentUser)) {
      bell.classList.remove("hidden");
      bell.classList.add("inline-flex");
    } else {
      bell.classList.add("hidden");
    }
    const info = document.createElement("div");
    info.className = "text-xs text-slate-400 font-semibold py-1";
    info.innerHTML = `<i class="fa-solid fa-user-check text-emerald-500 mr-1.5"></i>${currentLang === "en" ? "Personal shift schedule across assigned depots" : "Osobní přehled směn napříč přiřazenými depy"}`;
    nav.appendChild(info);
  }
}

function hideAllSections() {
  [
    "view-admin-schedule", "view-admin-settings", "view-admin-chat",
    "view-coord-requests", "view-coord-summary", "view-employee-home"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
}

function renderActiveRoleView() {
  if (!currentUser) return;
  hideAllSections();
  const role = normalizeUserRole(currentUser);

  if (role === "admin") {
    updateAdminBadges();
    if (activeAdminTab === "schedule") {
      document.getElementById("view-admin-schedule").classList.remove("hidden");
      renderAdminSchedule();
    } else if (activeAdminTab === "settings") {
      document.getElementById("view-admin-settings").classList.remove("hidden");
      setSettingsSubTab(settingsSubTab);
    } else if (activeAdminTab === "chat") {
      document.getElementById("view-admin-chat").classList.remove("hidden");
      renderAdminChatTab();
    }
  } else if (role === "coordinator") {
    if (activeCoordTab === "requests") {
      document.getElementById("view-coord-requests").classList.remove("hidden");
      renderCoordinatorRequests();
    } else {
      document.getElementById("view-coord-summary").classList.remove("hidden");
      renderCoordinatorSummary();
    }
  } else {
    updateAdminBadges();
    document.getElementById("view-employee-home").classList.remove("hidden");
    renderEmployeeHome();
  }
}

function getMondayOfWeek(dateObj) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function getVisibleDatesList() {
  const res = [];
  if (rosterViewMode === "month") {
    const y = anchorDate.getFullYear();
    const m = anchorDate.getMonth();
    const days = getDaysInMonth(anchorDate);
    for (let d = 1; d <= days; d++) {
      const dt = new Date(y, m, d);
      res.push({ dateObj: dt, year: y, month: m, day: d, mKey: getMonthKey(dt), dateStr: formatDateStr(y, m, d), dow: dt.getDay() });
    }
  } else {
    const count = rosterViewMode === "week" ? 7 : 14;
    const start = getMondayOfWeek(anchorDate);
    for (let i = 0; i < count; i++) {
      const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      res.push({ dateObj: dt, year: dt.getFullYear(), month: dt.getMonth(), day: dt.getDate(), mKey: getMonthKey(dt), dateStr: formatDateStr(dt.getFullYear(), dt.getMonth(), dt.getDate()), dow: dt.getDay() });
    }
  }
  return res;
}

function setRosterViewMode(mode) {
  rosterViewMode = mode;
  ["month", "biweek", "week"].forEach(m => {
    const btn = document.getElementById("vmode-" + m);
    if (!btn) return;
    btn.className = m === mode
      ? "px-2.5 py-1 rounded-lg transition bg-blue-600 text-white"
      : "px-2.5 py-1 rounded-lg transition text-slate-400 hover:text-white";
  });
  renderAdminSchedule();
}

function stepRosterPeriod(delta) {
  if (activeAdminTab === "schedule" && normalizeUserRole(currentUser) === "admin") {
    if (rosterViewMode === "week") anchorDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() + delta * 7);
    else if (rosterViewMode === "biweek") anchorDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() + delta * 14);
    else anchorDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + delta, 1);
  } else {
    anchorDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + delta, 1);
  }
  renderActiveRoleView();
}

function selectAdminDepot(depotId) {
  activeDepotId = depotId;
  renderAdminSchedule();
}

function toggleShowTerminated(checked) {
  showTerminatedWorkers = checked;
  renderAdminSchedule();
}

function getShiftBadgeHtml(entry, otherDepotConflictName = null, isTerminatedDay = false) {
  const compact = rosterViewMode === "month";
  if (!entry || !entry.type) {
    if (isTerminatedDay) return `<span class="text-[8px] text-red-400/70 font-semibold">${compact ? "UK" : "UKONČEN"}</span>`;
    if (otherDepotConflictName) return `<div class="px-0.5 py-0.5 rounded bg-slate-700/60 text-slate-300 text-[8px] font-bold leading-none truncate" title="${otherDepotConflictName}">${compact ? otherDepotConflictName.split(":")[1]?.trim() || "•" : otherDepotConflictName}</div>`;
    return `<span class="text-slate-600 font-bold">—</span>`;
  }
  const map = {
    D: "bg-amber-400 text-slate-950",
    N: "bg-blue-600 text-white",
    DOV: "bg-emerald-500 text-slate-950",
    NV: "bg-teal-500 text-slate-950",
    PN: "bg-red-500 text-white",
    A: "bg-purple-600 text-white"
  };
  const cls = map[entry.type] || "bg-slate-700 text-white";
  const showTime = !compact && entry.start && entry.end;
  const timeTag = showTime ? `<div class="text-[9px] leading-none mt-0.5 opacity-90">${entry.start}-${entry.end}</div>` : "";
  return `<div class="${compact ? "py-1 px-0.5 text-[10px]" : "px-1.5 py-1 text-[11px]"} rounded font-extrabold leading-tight ${cls}">${entry.type}${timeTag}</div>`;
}

function renderAdminSchedule() {
  ensureMultiDepotConsistency();
  const visibleDates = getVisibleDatesList();
  const depot = getDepotById(activeDepotId);
  const locale = currentLang === "en" ? "en-US" : "cs-CZ";
  const canEdit = canUserEditShifts();

  const tableEl = document.getElementById("admin-matrix-table");
  tableEl.className = `w-full border-collapse text-xs mode-${rosterViewMode}`;

  document.getElementById("chk-show-terminated").checked = showTerminatedWorkers;

  const pillsBox = document.getElementById("admin-depot-pills");
  pillsBox.innerHTML = appState.depots.map(d => {
    const isAct = d.id === activeDepotId;
    const shiftBadge = d.hasDay && d.hasNight ? "D+N" : (d.hasDay ? "D" : "N");
    const calShort = d.calendarMode === "mon_fri" ? "Po–Pá" : "K/D";
    return `<button onclick="selectAdminDepot('${d.id}')"
      class="px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${isAct ? "bg-blue-600 text-white shadow" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"}">
      <span>${d.name}</span>
      <span class="text-[9px] px-1.5 py-0.2 rounded ${isAct ? "bg-blue-800 text-blue-100" : "bg-slate-700 text-slate-300"}">${calShort} • ${shiftBadge}</span>
    </button>`;
  }).join("");

  document.getElementById("auto-depot-name").textContent = depot.name;
  document.getElementById("admin-period-label").textContent = rosterViewMode === "month"
    ? anchorDate.toLocaleDateString(locale, { month: "long", year: "numeric" })
    : `${visibleDates[0].day}.${visibleDates[0].month + 1}. – ${visibleDates[visibleDates.length - 1].day}.${visibleDates[visibleDates.length - 1].month + 1}.${visibleDates[visibleDates.length - 1].year}`;

  let legendHtml = `<span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-400 font-bold mr-1"><i class="fa-solid fa-calendar-week mr-1"></i>${getCalendarModeLabel(depot.calendarMode)}</span>`;
  if (depot.hasDay) legendHtml += `<span class="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold">D</span> <span class="text-slate-300 mr-2">(${depot.dayStart}–${depot.dayEnd})</span>`;
  if (depot.hasNight) legendHtml += `<span class="px-2 py-0.5 rounded bg-blue-600 text-white font-extrabold">N</span> <span class="text-slate-300 mr-2">(${depot.nightStart}–${depot.nightEnd})</span>`;
  legendHtml += `
    <span class="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-extrabold">DOV</span> <span class="text-slate-300 mr-2">${currentLang === "en" ? "Vacation" : "Dovolená"}</span>
    <span class="px-2 py-0.5 rounded bg-teal-500 text-slate-950 font-extrabold">NV</span> <span class="text-slate-300 mr-2">${currentLang === "en" ? "Comp." : "Náhr. volno"}</span>
    <span class="px-2 py-0.5 rounded bg-red-500 text-white font-extrabold">PN</span> <span class="text-slate-300 mr-2">PN</span>
    <span class="px-2 py-0.5 rounded bg-purple-600 text-white font-extrabold">A</span> <span class="text-slate-300">Absence</span>
  `;
  document.getElementById("admin-legend-items").innerHTML = legendHtml;

  const dayNames = currentLang === "en" ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] : ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
  const nameColClass = rosterViewMode === "month" ? "min-w-[165px] max-w-[180px]" : "min-w-[195px]";
  let headHtml = `<tr><th class="sticky-corner py-2 px-2.5 text-left ${nameColClass} text-slate-300">${depot.name}</th>`;
  visibleDates.forEach(dt => {
    const isWknd = dt.dow === 0 || dt.dow === 6;
    const dateLbl = rosterViewMode === "month" ? `${dt.day}.` : `${dt.day}.${dt.month + 1}.`;
    headHtml += `<th class="sticky-header py-1.5 px-0.5 text-center border-l border-slate-800 ${isWknd ? "bg-slate-950 text-amber-500" : "text-slate-300"}">
      <div class="text-[10px] font-extrabold leading-tight">${dateLbl}</div>
      <div class="text-[9px] font-normal opacity-75 leading-tight">${dayNames[dt.dow]}</div>
    </th>`;
  });
  headHtml += `<th class="sticky-header py-1.5 px-1.5 text-center border-l border-slate-700 text-emerald-500 min-w-[64px] text-[10px]">Sm / Hod</th></tr>`;
  document.getElementById("admin-matrix-head").innerHTML = headHtml;

  const scheduleableUsers = getVisibleRosterUsers();
  let bodyHtml = "";
  const dailyDCounts = Array(visibleDates.length).fill(0);
  const dailyNCounts = Array(visibleDates.length).fill(0);

  scheduleableUsers.forEach(user => {
    let shiftCount = 0;
    let totalHours = 0;
    const calBadge = user.calendarMode === "mon_fri"
      ? `<span class="ml-1 px-1 rounded bg-teal-500/20 text-teal-400 text-[8px]">Po–Pá</span>`
      : `<span class="ml-1 px-1 rounded bg-slate-700/80 text-slate-300 text-[8px]">K/D</span>`;
    const termTag = user.terminatedFrom ? `<span class="ml-1 px-1 rounded bg-red-500/20 text-red-400 text-[8px]">Ukončen</span>` : "";

    bodyHtml += `<tr class="hover:bg-slate-800/40 ${user.terminatedFrom ? "opacity-75" : ""}"
      ondragover="onRowDragOver(event)"
      ondragleave="onRowDragLeave(event)"
      ondrop="onRowDrop(event, '${user.id}')">
      <td class="sticky-col py-1.5 px-2 ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${nameColClass}"
        draggable="${canEdit ? "true" : "false"}"
        ondragstart="onRowDragStart(event, '${user.id}')"
        title="${user.phone ? "Tel: " + user.phone : ""}">
        <div class="flex items-center gap-1.5">
          <i class="fa-solid fa-grip-vertical text-slate-500 text-[10px]"></i>
          <div class="min-w-0">
            <div class="font-bold text-white text-[11px] truncate">${user.name}</div>
            <div class="text-[9px] text-slate-400 truncate">${user.roleLabel || user.role}${calBadge}${termTag}</div>
          </div>
        </div>
      </td>`;

    visibleDates.forEach((dt, colIdx) => {
      const entry = appState.schedules[dt.mKey]?.[activeDepotId]?.[user.id]?.[dt.day];
      const isWknd = dt.dow === 0 || dt.dow === 6;
      const isTermDay = user.terminatedFrom && dt.dateStr >= user.terminatedFrom;

      let otherDepotConflict = null;
      if (!entry || !entry.type) {
        for (const dep of appState.depots) {
          if (dep.id === activeDepotId) continue;
          const otherEntry = appState.schedules[dt.mKey]?.[dep.id]?.[user.id]?.[dt.day];
          if (otherEntry && otherEntry.type) {
            otherDepotConflict = `${dep.name.replace("Depo ", "")}: ${otherEntry.type}`;
            break;
          }
        }
      }

      if (entry && entry.type) {
        if (entry.type === "D") { dailyDCounts[colIdx]++; shiftCount++; }
        if (entry.type === "N") { dailyNCounts[colIdx]++; shiftCount++; }
        totalHours += getShiftHours(entry, activeDepotId);
      }

      bodyHtml += `<td
        class="shift-cell text-center border-l border-slate-800/90 ${canEdit ? "cursor-pointer" : ""} ${isTermDay ? "bg-red-950/20" : (isWknd ? "bg-slate-950/50" : "bg-slate-900/40")}"
        draggable="${canEdit && entry && entry.type ? "true" : "false"}"
        ondragstart="onShiftDragStart(event, '${user.id}', '${dt.dateStr}')"
        ondragover="onShiftDragOver(event)"
        ondragleave="onShiftDragLeave(event)"
        ondrop="onShiftDrop(event, '${user.id}', '${dt.dateStr}')"
        onclick="openUserCellModal('${user.id}', '${dt.dateStr}')">
        ${getShiftBadgeHtml(entry, otherDepotConflict, isTermDay)}
      </td>`;
    });

    bodyHtml += `<td class="py-1.5 px-1.5 text-center border-l border-slate-800 font-bold text-slate-200 whitespace-nowrap text-[10px]">
      ${shiftCount}<span class="text-slate-500">/</span><span class="text-emerald-500">${totalHours}h</span>
    </td></tr>`;
  });

  const visibleDateSet = new Set(visibleDates.map(d => d.dateStr));
  const visibleAgSlots = appState.agSlots.filter(s => s.depotId === activeDepotId && visibleDateSet.has(s.date));
  if (visibleAgSlots.length > 0) {
    bodyHtml += `<tr><td colspan="${visibleDates.length + 2}" class="bg-purple-950/40 border-y border-purple-500/30 py-1 px-2.5 text-[10px] font-extrabold text-purple-400 uppercase tracking-wider">
      <i class="fa-solid fa-people-arrows mr-1"></i> AG – ${depot.name} (${visibleAgSlots.length})
    </td></tr>`;

    visibleAgSlots.forEach(slot => {
      const displayName = slot.assignedName ? `${slot.assignedName} (AG)` : slot.label;
      const hrs = calcDurationHours(slot.start, slot.end);

      bodyHtml += `<tr class="bg-purple-950/10 hover:bg-purple-950/20">
        <td class="sticky-col py-1.5 px-2.5 ${nameColClass}">
          <div class="font-bold ${slot.assignedName ? "text-purple-400" : "text-amber-500"} text-[11px] truncate">${displayName}</div>
          <div class="text-[9px] text-purple-400">AG • ${slot.start}–${slot.end}</div>
        </td>`;

      visibleDates.forEach((dt, colIdx) => {
        if (dt.dateStr === slot.date) {
          if (slot.shift === "D") dailyDCounts[colIdx]++;
          else dailyNCounts[colIdx]++;
          bodyHtml += `<td onclick="openAgCellModal('${slot.id}')" class="shift-cell text-center border-l border-slate-800 ${canEdit ? "cursor-pointer" : ""}">
            ${getShiftBadgeHtml({ type: slot.shift, start: slot.start, end: slot.end })}
          </td>`;
        } else {
          bodyHtml += `<td class="shift-cell text-center border-l border-slate-800/60 text-slate-600">—</td>`;
        }
      });

      bodyHtml += `<td class="py-1.5 px-1.5 text-center border-l border-slate-800 font-bold text-purple-400 text-[10px]">1/${hrs}h</td></tr>`;
    });
  }

  document.getElementById("admin-matrix-body").innerHTML = bodyHtml;

  let footHtml = `<tr><td class="sticky-col py-1.5 px-2.5 text-[10px] text-slate-300">D / N</td>`;
  visibleDates.forEach((dt, colIdx) => {
    const dOk = dailyDCounts[colIdx] >= 3;
    footHtml += `<td class="py-1 px-0.5 text-center border-l border-slate-800 text-[9px] leading-tight">
      ${depot.hasDay ? `<div class="${dOk ? "text-amber-500" : "text-red-500"}">${dailyDCounts[colIdx]}</div>` : ""}
      ${depot.hasNight ? `<div class="text-blue-500">${dailyNCounts[colIdx]}</div>` : ""}
    </td>`;
  });
  footHtml += `<td class="py-1.5 px-1.5 text-center border-l border-slate-700 text-[9px] text-slate-400">${depot.hasDay && depot.hasNight ? "D+N" : (depot.hasDay ? "D" : "N")}</td></tr>`;
  document.getElementById("admin-matrix-foot").innerHTML = footHtml;
}

function onRowDragStart(e, userId) {
  if (!canUserEditShifts()) return;
  rowDragUserId = userId;
  dragPayload = null;
  e.dataTransfer.effectAllowed = "move";
}
function onRowDragOver(e) {
  if (!rowDragUserId) return;
  e.preventDefault();
  e.currentTarget.classList.add("row-drag-over");
}
function onRowDragLeave(e) {
  e.currentTarget.classList.remove("row-drag-over");
}
function onRowDrop(e, targetUserId) {
  e.currentTarget.classList.remove("row-drag-over");
  if (!rowDragUserId || rowDragUserId === targetUserId) { rowDragUserId = null; return; }
  e.preventDefault();

  const ids = getVisibleRosterUsers().map(u => u.id);
  const fromIdx = ids.indexOf(rowDragUserId);
  const toIdx = ids.indexOf(targetUserId);
  if (fromIdx === -1 || toIdx === -1) { rowDragUserId = null; return; }

  ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, rowDragUserId);
  if (!appState.depotUserOrder) appState.depotUserOrder = {};
  appState.depotUserOrder[activeDepotId] = ids;

  const movedUser = appState.users.find(u => u.id === rowDragUserId);
  addAudit("Změna pořadí zaměstnanců", `[${getDepotName(activeDepotId)}] Přesunut řádek: ${movedUser?.name}`);
  rowDragUserId = null;
  renderAdminSchedule();
  pushToFirebase();
}

function onShiftDragStart(e, userId, fromDateStr) {
  if (!canUserEditShifts()) return;
  e.stopPropagation();
  rowDragUserId = null;
  dragPayload = { userId, fromDateStr };
  e.dataTransfer.effectAllowed = "move";
}
function onShiftDragOver(e) {
  if (!dragPayload) return;
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}
function onShiftDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}
function onShiftDrop(e, targetUserId, targetDateStr) {
  e.currentTarget.classList.remove("drag-over");
  if (!dragPayload) return;
  e.stopPropagation();

  if (dragPayload.userId !== targetUserId) {
    showToast("Přesun směny je povolen pouze v rámci stejného zaměstnance.", "error");
    dragPayload = null;
    return;
  }
  if (dragPayload.fromDateStr === targetDateStr) return;

  const fromP = parseDateStr(dragPayload.fromDateStr);
  const toP = parseDateStr(targetDateStr);
  const fromSched = getDepotScheduleMap(fromP.mKey, activeDepotId);
  const toSched = getDepotScheduleMap(toP.mKey, activeDepotId);
  if (!fromSched[targetUserId]) fromSched[targetUserId] = {};
  if (!toSched[targetUserId]) toSched[targetUserId] = {};

  const movingEntry = fromSched[targetUserId][fromP.day];
  if (!movingEntry || !movingEntry.type) return;

  delete fromSched[targetUserId][fromP.day];
  const restErr = violatesNightToDayByDateStr(targetUserId, targetDateStr, movingEntry.type);
  if (restErr) {
    fromSched[targetUserId][fromP.day] = movingEntry;
    showToast(restErr, "error");
    dragPayload = null;
    return;
  }

  toSched[targetUserId][toP.day] = movingEntry;
  const emp = appState.users.find(u => u.id === targetUserId);
  addAudit("Přesun směny (D&D)", `[${getDepotName(activeDepotId)}] ${emp?.name}: ${movingEntry.type} z ${dragPayload.fromDateStr} na ${targetDateStr}`);
  dragPayload = null;
  renderAdminSchedule();
  pushToFirebase();
}

function openUserCellModal(userId, dateStr) {
  if (!canUserEditShifts()) {
    showToast("Nemáte oprávnění měnit směny zaměstnanců.", "warn");
    return;
  }
  const user = appState.users.find(u => u.id === userId);
  const p = parseDateStr(dateStr);
  const depot = getDepotById(activeDepotId);
  const entry = getDepotScheduleMap(p.mKey, activeDepotId)[userId]?.[p.day] || {};
  editingCell = { kind: "user", userId, dateStr };

  document.getElementById("cell-modal-title").textContent = `${user.name} – ${p.day}.${p.month + 1}.${p.year}`;
  document.getElementById("cell-modal-sub").textContent = `Depo: ${depot.name} • ${user.roleLabel || user.role}`;
  document.getElementById("btn-delete-ag-slot").classList.add("hidden");
  document.getElementById("btn-cell-shift-D").classList.toggle("hidden", !depot.hasDay);
  document.getElementById("btn-cell-shift-N").classList.toggle("hidden", !depot.hasNight);
  document.getElementById("cell-time-start").value = entry.start || (entry.type === "N" ? depot.nightStart : depot.dayStart);
  document.getElementById("cell-time-end").value = entry.end || (entry.type === "N" ? depot.nightEnd : depot.dayEnd);
  openModal("modal-cell-edit");
}

function openAgCellModal(slotId) {
  if (!canUserEditShifts()) return;
  const slot = appState.agSlots.find(s => s.id === slotId);
  if (!slot) return;
  const depot = getDepotById(slot.depotId);
  editingCell = { kind: "ag", slotId };

  document.getElementById("cell-modal-title").textContent = `${slot.assignedName || slot.label} (${slot.date})`;
  document.getElementById("cell-modal-sub").textContent = `Depo: ${depot.name} • AG`;
  document.getElementById("btn-delete-ag-slot").classList.remove("hidden");
  document.getElementById("btn-cell-shift-D").classList.toggle("hidden", !depot.hasDay);
  document.getElementById("btn-cell-shift-N").classList.toggle("hidden", !depot.hasNight);
  document.getElementById("cell-time-start").value = slot.start || depot.agStart;
  document.getElementById("cell-time-end").value = slot.end || depot.agEnd;
  openModal("modal-cell-edit");
}

function applyCellShift(newType) {
  if (!editingCell) return;
  if (editingCell.kind === "user") {
    const { userId, dateStr } = editingCell;
    if (newType) {
      const restErr = violatesNightToDayByDateStr(userId, dateStr, newType);
      if (restErr) { showToast(restErr, "error"); return; }
    }
    const p = parseDateStr(dateStr);
    const depotSched = getDepotScheduleMap(p.mKey, activeDepotId);
    if (!depotSched[userId]) depotSched[userId] = {};
    if (!newType) delete depotSched[userId][p.day];
    else depotSched[userId][p.day] = { type: newType };
    const emp = appState.users.find(u => u.id === userId);
    addAudit("Úprava směny", `[${getDepotName(activeDepotId)}] ${emp?.name} (${dateStr}): "${newType || "Volno"}"`);
  } else if (editingCell.kind === "ag") {
    const slot = appState.agSlots.find(s => s.id === editingCell.slotId);
    if (slot) {
      if (!newType) {
        appState.agSlots = appState.agSlots.filter(s => s.id !== slot.id);
        addAudit("Smazání AG slotu", `[${getDepotName(slot.depotId)}] ${slot.assignedName || slot.label} (${slot.date})`);
      } else {
        slot.shift = newType;
        addAudit("Úprava AG směny", `[${getDepotName(slot.depotId)}] ${slot.assignedName || slot.label} (${slot.date}): ${newType}`);
      }
    }
  }
  closeModal("modal-cell-edit");
  renderAdminSchedule();
  pushToFirebase();
}

function saveCellCustomTime() {
  if (!editingCell) return;
  const start = document.getElementById("cell-time-start").value;
  const end = document.getElementById("cell-time-end").value;
  if (!start || !end) return;

  if (editingCell.kind === "ag") {
    const slot = appState.agSlots.find(s => s.id === editingCell.slotId);
    if (slot) { slot.start = start; slot.end = end; addAudit("Čas AG směny", `${slot.date}: ${start}–${end}`); }
  } else if (editingCell.kind === "user") {
    const { userId, dateStr } = editingCell;
    const p = parseDateStr(dateStr);
    const depotSched = getDepotScheduleMap(p.mKey, activeDepotId);
    if (!depotSched[userId]?.[p.day]) { showToast("Nejprve vyberte typ směny.", "warn"); return; }
    depotSched[userId][p.day].start = start;
    depotSched[userId][p.day].end = end;
    addAudit("Vlastní čas směny", `${dateStr}: ${start}–${end}`);
  }
  closeModal("modal-cell-edit");
  renderAdminSchedule();
  pushToFirebase();
}

function deleteAgSlotFromCell() {
  if (!editingCell || editingCell.kind !== "ag") return;
  appState.agSlots = appState.agSlots.filter(s => s.id !== editingCell.slotId);
  closeModal("modal-cell-edit");
  renderAdminSchedule();
  pushToFirebase();
}

function openAgRequestModal() {
  if (!canUserRequestAg()) { showToast("Nemáte oprávnění poslat požadavek AG.", "warn"); return; }
  const sel = document.getElementById("ag-req-depot");
  sel.innerHTML = appState.depots.map(d => `<option value="${d.id}" ${d.id === activeDepotId ? "selected" : ""}>${d.name}</option>`).join("");
  document.getElementById("ag-req-date").value = formatDateStr(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  onAgModalDepotChange();
  openModal("modal-ag-request");
}

function onAgModalDepotChange() {
  const depotId = document.getElementById("ag-req-depot").value || activeDepotId;
  const depot = getDepotById(depotId);
  const shiftSel = document.getElementById("ag-req-shift");
  let opts = "";
  if (depot.hasNight) opts += `<option value="N">Noční směna (N)</option>`;
  if (depot.hasDay) opts += `<option value="D">Denní směna (D)</option>`;
  shiftSel.innerHTML = opts || `<option value="N">Noční směna (N)</option>`;
  document.getElementById("ag-req-start").value = depot.agStart || "19:00";
  document.getElementById("ag-req-end").value = depot.agEnd || "07:00";
}

function createAgRequests() {
  const depotId = document.getElementById("ag-req-depot").value || activeDepotId;
  const dateVal = document.getElementById("ag-req-date").value;
  const count = Math.max(1, parseInt(document.getElementById("ag-req-count").value || "1", 10));
  const shift = document.getElementById("ag-req-shift").value;
  const start = document.getElementById("ag-req-start").value || "19:00";
  const end = document.getElementById("ag-req-end").value || "07:00";
  if (!dateVal) return;

  const existingForDate = appState.agSlots.filter(s => s.date === dateVal && s.depotId === depotId).length;
  for (let i = 1; i <= count; i++) {
    appState.agSlots.push({
      id: "ag_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      depotId, date: dateVal, label: `Požadavek AG ${existingForDate + i}`, assignedName: "", shift, start, end
    });
  }
  addAudit("Požadavek AG", `[${getDepotName(depotId)}] ${count}× AG na ${dateVal}.`);
  closeModal("modal-ag-request");
  renderAdminSchedule();
  pushToFirebase();
  showToast(`Přidáno ${count} požadavků AG.`, "success");
}

function exportRosterAsImage() {
  closeModal("modal-export-roster");
  const visibleDates = getVisibleDatesList();
  const users = getVisibleRosterUsers();
  const visibleDateSet = new Set(visibleDates.map(d => d.dateStr));
  const visibleAgSlots = appState.agSlots.filter(s => s.depotId === activeDepotId && visibleDateSet.has(s.date));

  const rows = [];
  users.forEach(u => {
    const map = {};
    visibleDates.forEach(dt => {
      const e = appState.schedules[dt.mKey]?.[activeDepotId]?.[u.id]?.[dt.day];
      if (e) map[dt.dateStr] = e;
    });
    rows.push({ name: u.name, role: u.roleLabel || u.role, map, isAg: false });
  });
  visibleAgSlots.forEach(s => {
    rows.push({ name: s.assignedName ? `${s.assignedName} (AG)` : s.label, role: `${s.start}-${s.end}`, map: { [s.date]: { type: s.shift } }, isAg: true });
  });

  const nameColW = 210, dayColW = 36, sumColW = 72, headerH = 68, rowH = 32, pad = 16;
  const canvas = document.createElement("canvas");
  canvas.width = pad * 2 + nameColW + visibleDates.length * dayColW + sumColW;
  canvas.height = pad * 2 + headerH + Math.max(1, rows.length) * rowH + 24;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const periodTitle = document.getElementById("admin-period-label").textContent.toUpperCase();
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`DepotShift v${APP_VERSION} • ${getDepotName(activeDepotId)} • ${periodTitle}`, pad, pad + 20);

  const tableTop = pad + 34;
  const dayNames = currentLang === "en" ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] : ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(pad, tableTop, canvas.width - pad * 2, 34);
  ctx.strokeStyle = "#334155";
  ctx.strokeRect(pad, tableTop, canvas.width - pad * 2, 34);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(currentLang === "en" ? "Employee" : "Jméno pracovníka", pad + 8, tableTop + 21);

  visibleDates.forEach((dt, i) => {
    const x = pad + nameColW + i * dayColW;
    const isWknd = dt.dow === 0 || dt.dow === 6;
    if (isWknd) { ctx.fillStyle = "#090d16"; ctx.fillRect(x, tableTop, dayColW, 34); }
    ctx.strokeRect(x, tableTop, dayColW, 34);
    ctx.fillStyle = isWknd ? "#fbbf24" : "#f8fafc";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${dt.day}.`, x + dayColW / 2, tableTop + 14);
    ctx.font = "10px sans-serif";
    ctx.fillText(dayNames[dt.dow], x + dayColW / 2, tableTop + 28);
  });

  const sumX = pad + nameColW + visibleDates.length * dayColW;
  ctx.strokeRect(sumX, tableTop, sumColW, 34);
  ctx.fillStyle = "#34d399";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(currentLang === "en" ? "Total" : "Celkem", sumX + sumColW / 2, tableTop + 21);

  const badgeColors = {
    D: { bg: "#fbbf24", fg: "#0f172a" },
    N: { bg: "#2563eb", fg: "#ffffff" },
    DOV: { bg: "#10b981", fg: "#0f172a" },
    NV: { bg: "#14b8a6", fg: "#0f172a" },
    PN: { bg: "#ef4444", fg: "#ffffff" },
    A: { bg: "#9333ea", fg: "#ffffff" }
  };

  rows.forEach((r, idx) => {
    const ry = tableTop + 34 + idx * rowH;
    ctx.fillStyle = r.isAg ? "#1e1b4b" : (idx % 2 === 0 ? "#0f172a" : "#162033");
    ctx.fillRect(pad, ry, canvas.width - pad * 2, rowH);
    ctx.strokeStyle = "#334155";
    ctx.strokeRect(pad, ry, canvas.width - pad * 2, rowH);
    ctx.textAlign = "left";
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(r.name.slice(0, 26), pad + 8, ry + 14);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.fillText(r.role, pad + 8, ry + 26);

    let cnt = 0, hrs = 0;
    visibleDates.forEach((dt, i) => {
      const cx = pad + nameColW + i * dayColW;
      ctx.strokeRect(cx, ry, dayColW, rowH);
      const entry = r.map[dt.dateStr];
      if (entry && entry.type) {
        if (entry.type === "D" || entry.type === "N") cnt++;
        hrs += getShiftHours(entry, activeDepotId);
        const col = badgeColors[entry.type] || { bg: "#475569", fg: "#ffffff" };
        ctx.fillStyle = col.bg;
        ctx.fillRect(cx + 3, ry + 4, dayColW - 6, rowH - 8);
        ctx.fillStyle = col.fg;
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(entry.type, cx + dayColW / 2, ry + 20);
      }
    });

    ctx.strokeRect(sumX, ry, sumColW, rowH);
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${cnt} / ${hrs}h`, sumX + sumColW / 2, ry + 20);
  });

  const link = document.createElement("a");
  link.download = `DepotShift_v${APP_VERSION}_${getDepotName(activeDepotId).replace(/\s+/g, "_")}_${getMonthKey()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("Obrázek docházky (.PNG) byl stažen.", "success");
}

function exportRosterAsExcel() {
  closeModal("modal-export-roster");
  const visibleDates = getVisibleDatesList();
  const users = getVisibleRosterUsers();
  const visibleDateSet = new Set(visibleDates.map(d => d.dateStr));
  const visibleAgSlots = appState.agSlots.filter(s => s.depotId === activeDepotId && visibleDateSet.has(s.date));

  const header = ["Jméno / Name", "Pozice / Role", "Telefon"];
  visibleDates.forEach(dt => header.push(`${dt.day}.${dt.month + 1}.`));
  header.push("Směn / Shifts", "Hodin / Hours");
  const aoa = [header];

  users.forEach(u => {
    const row = [u.name, u.roleLabel || u.role, u.phone || ""];
    let cnt = 0, hrs = 0;
    visibleDates.forEach(dt => {
      const e = appState.schedules[dt.mKey]?.[activeDepotId]?.[u.id]?.[dt.day];
      row.push(e && e.type ? e.type : "");
      if (e && (e.type === "D" || e.type === "N")) cnt++;
      hrs += getShiftHours(e, activeDepotId);
    });
    row.push(cnt, hrs);
    aoa.push(row);
  });

  visibleAgSlots.forEach(s => {
    const row = [s.assignedName ? `${s.assignedName} (AG)` : s.label, `AG (${s.start}-${s.end})`, ""];
    visibleDates.forEach(dt => row.push(dt.dateStr === s.date ? s.shift : ""));
    row.push(1, calcDurationHours(s.start, s.end));
    aoa.push(row);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, getDepotName(activeDepotId).slice(0, 30));
  XLSX.writeFile(wb, `DepotShift_v${APP_VERSION}_${getDepotName(activeDepotId).replace(/\s+/g, "_")}_${getMonthKey()}.xlsx`);
  showToast("Excel soubor (.xlsx) byl stažen.", "success");
}

function openTerminateModal(draftIdx) {
  terminatingUserIdx = draftIdx;
  const u = draftUsers[draftIdx];
  document.getElementById("term-emp-info").innerHTML = `Zaměstnanec: <strong class="text-white">${u.name}</strong> (${u.roleLabel || u.role})`;
  document.getElementById("term-emp-date").value = new Date().toISOString().split("T")[0];
  openModal("modal-terminate-emp");
}

function confirmTerminateEmployee() {
  if (terminatingUserIdx === null) return;
  const dateVal = document.getElementById("term-emp-date").value;
  if (!dateVal) { showToast("Vyberte datum ukončení.", "warn"); return; }
  const u = draftUsers[terminatingUserIdx];
  u.terminatedFrom = dateVal;
  markAdminDraftDirty();

  Object.keys(appState.schedules || {}).forEach(mKey => {
    const [yStr, mStr] = mKey.split("-");
    const yNum = parseInt(yStr, 10), mNum = parseInt(mStr, 10) - 1;
    Object.keys(appState.schedules[mKey] || {}).forEach(depId => {
      const uSched = appState.schedules[mKey][depId]?.[u.id];
      if (!uSched) return;
      Object.keys(uSched).forEach(dayKey => {
        if (formatDateStr(yNum, mNum, parseInt(dayKey, 10)) >= dateVal) delete uSched[dayKey];
      });
    });
  });

  closeModal("modal-terminate-emp");
  renderDraftUsersTable();
  showToast(`Ukončení pro ${u.name} od ${dateVal} nastaveno. Potvrďte kliknutím na „Uložit změny“.`, "info");
}

function restoreTerminatedUser(draftIdx) {
  draftUsers[draftIdx].terminatedFrom = null;
  markAdminDraftDirty();
  renderDraftUsersTable();
}

function openResetDbModal() {
  document.getElementById("reset-db-pass").value = "";
  openModal("modal-reset-db");
}

function confirmResetDatabase() {
  const entered = document.getElementById("reset-db-pass").value;
  if (!currentUser || entered !== currentUser.pass) {
    showToast("Nesprávné heslo administrátora!", "error");
    return;
  }
  appState.schedules = {};
  appState.agSlots = [];
  appState.requests = [];
  appState.chats = {};
  appState.depotUserOrder = {};
  appState.auditLog = [];
  addAudit("Vymazání databáze", "Vymazána zapsaná data z databáze.");
  closeModal("modal-reset-db");
  pushToFirebase();
  renderActiveRoleView();
  showToast("Databáze byla vymazána.", "success");
}

function getAllowedCoordinatorDepots() {
  const allowedIds = Array.isArray(currentUser.depots) ? currentUser.depots : [];
  return appState.depots.filter(d => allowedIds.includes(d.id));
}

function selectCoordDepot(depotId) {
  coordSelectedDepotId = depotId;
  renderCoordinatorRequests();
}

function renderCoordinatorRequests() {
  const allowedDepots = getAllowedCoordinatorDepots();
  const allowedIds = allowedDepots.map(d => d.id);
  const pillsBox = document.getElementById("coord-depot-pills");
  if (allowedDepots.length === 0) {
    pillsBox.innerHTML = `<span class="text-xs text-red-400">Nemáte přiřazeno žádné depo.</span>`;
    document.getElementById("coord-requests-list").innerHTML = "";
    return;
  }
  pillsBox.innerHTML = `<button onclick="selectCoordDepot('ALL')" class="px-3 py-1 rounded-xl text-xs font-bold ${coordSelectedDepotId === "ALL" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 border border-slate-700"}">All (${allowedDepots.length})</button>` +
    allowedDepots.map(d => `<button onclick="selectCoordDepot('${d.id}')" class="px-3 py-1 rounded-xl text-xs font-bold ${coordSelectedDepotId === d.id ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 border border-slate-700"}">${d.name}</button>`).join("");

  const filtered = appState.agSlots.filter(s => allowedIds.includes(s.depotId) && (coordSelectedDepotId === "ALL" || s.depotId === coordSelectedDepotId)).sort((a, b) => a.date.localeCompare(b.date));
  const container = document.getElementById("coord-requests-list");
  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800">Žádné požadavky na AG pracovníky.</div>`;
    return;
  }
  container.innerHTML = filtered.map(slot => `
    <div class="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-extrabold">${getDepotName(slot.depotId)}</span>
        <span class="px-2 py-0.5 rounded bg-purple-600 text-white text-[11px] font-extrabold">${slot.date}</span>
        <span class="font-bold text-white text-xs">${slot.label}</span>
        <span class="text-[11px] text-slate-400">(${slot.shift} • ${slot.start}–${slot.end})</span>
      </div>
      <div class="flex items-center gap-2 flex-1 sm:flex-initial">
        <input type="text" data-ag-id="${slot.id}" value="${slot.assignedName || ""}" placeholder="Jméno pracovníka..." class="coord-ag-input flex-1 sm:w-64 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-xs text-white" />
        <button onclick="deleteAgSlotByCoord('${slot.id}')" class="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/30 text-red-400 border border-red-500/30"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join("");
}

function deleteAgSlotByCoord(slotId) {
  appState.agSlots = appState.agSlots.filter(s => s.id !== slotId);
  renderCoordinatorRequests();
  pushToFirebase();
}

function saveCoordinatorAgAssignments() {
  document.querySelectorAll(".coord-ag-input").forEach(inp => {
    const slot = appState.agSlots.find(s => s.id === inp.getAttribute("data-ag-id"));
    if (slot) slot.assignedName = inp.value.trim();
  });
  addAudit("Potvrzení AG jmen", "Koordinátor uložil jména agenturních pracovníků.");
  pushToFirebase();
  showToast("Jména agenturních pracovníků byla uložena!", "success");
}

function renderCoordinatorSummary() {
  const mKey = getMonthKey(anchorDate);
  const allowedIds = getAllowedCoordinatorDepots().map(d => d.id);
  const locale = currentLang === "en" ? "en-US" : "cs-CZ";
  document.getElementById("coord-month-label").textContent = anchorDate.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const slots = appState.agSlots.filter(s => s.date.startsWith(mKey) && allowedIds.includes(s.depotId));
  if (slots.length === 0) {
    document.getElementById("coord-summary-content").innerHTML = `<p class="text-xs text-slate-400 py-4">V tomto měsíci nejsou žádné agenturní směny.</p>`;
    return;
  }
  let totalHours = 0;
  const rows = slots.sort((a, b) => a.date.localeCompare(b.date)).map(s => {
    const h = calcDurationHours(s.start, s.end);
    totalHours += h;
    return `<tr class="border-b border-slate-800">
      <td class="py-2.5 px-3 font-bold text-blue-500">${getDepotName(s.depotId)}</td>
      <td class="py-2.5 px-3 font-bold text-white">${s.date}</td>
      <td class="py-2.5 px-3">${s.assignedName || s.label}</td>
      <td class="py-2.5 px-3">${s.shift}</td>
      <td class="py-2.5 px-3 font-mono">${s.start} – ${s.end}</td>
      <td class="py-2.5 px-3 text-right font-bold text-purple-500">${h} h</td>
    </tr>`;
  }).join("");
  document.getElementById("coord-summary-content").innerHTML = `<table class="w-full text-left border-collapse text-xs"><thead><tr class="border-b border-slate-700 text-slate-400 uppercase text-[10px]"><th class="py-2 px-3">Depo</th><th class="py-2 px-3">Datum</th><th class="py-2 px-3">Pracovník</th><th class="py-2 px-3">Směna</th><th class="py-2 px-3">Čas</th><th class="py-2 px-3 text-right">Hodin</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="bg-slate-950 font-extrabold text-white"><td colspan="5" class="py-2.5 px-3">Celkem</td><td class="py-2.5 px-3 text-right text-emerald-500">${totalHours} h</td></tr></tfoot></table>`;
}

function getEmployeeMergedDayEntry(mKey, userId, day) {
  for (const dep of appState.depots) {
    const e = appState.schedules[mKey]?.[dep.id]?.[userId]?.[day];
    if (e && e.type) return { ...e, depotId: dep.id, depotName: dep.name, depotObj: dep };
  }
  return null;
}

function renderEmployeeHome() {
  const mKey = getMonthKey(anchorDate), days = getDaysInMonth(anchorDate), y = anchorDate.getFullYear(), m = anchorDate.getMonth();
  const locale = currentLang === "en" ? "en-US" : "cs-CZ";
  document.getElementById("emp-month-label").textContent = anchorDate.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const myDepotNames = (currentUser.depots || []).map(id => getDepotName(id)).join(", ") || "—";
  document.getElementById("emp-assigned-depots-bar").innerHTML = `<i class="fa-solid fa-warehouse text-blue-500 mr-1"></i> Depa: <strong class="text-white">${myDepotNames}</strong> • Kalendář: <strong class="text-white">${getCalendarModeLabel(currentUser.calendarMode)}</strong>`;

  const rejected = appState.requests.find(r => r.userId === currentUser.id && r.status === "rejected" && !r.seenByUser);
  const rejBanner = document.getElementById("emp-rejected-banner");
  if (rejected) {
    rejBanner.classList.remove("hidden");
    document.getElementById("emp-rejected-text").textContent = `Požadavek (${rejected.type}) na ${rejected.dates.join(", ")} byl zamítnut.`;
  } else rejBanner.classList.add("hidden");

  const thread = appState.chats[currentUser.id] || [];
  document.getElementById("emp-unread-badge").classList.toggle("hidden", !thread.some(msg => msg.senderRole === "admin" && !msg.readByEmp));

  let cntD = 0, cntN = 0, cntOff = 0, totalHours = 0;
  for (let d = 1; d <= days; d++) {
    const entry = getEmployeeMergedDayEntry(mKey, currentUser.id, d);
    if (!entry || !entry.type) continue;
    if (entry.type === "D") cntD++; else if (entry.type === "N") cntN++; else cntOff++;
    totalHours += getShiftHours(entry, entry.depotId);
  }

  document.getElementById("emp-stats-grid").innerHTML = `
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-3"><div class="text-[10px] uppercase text-slate-400 font-bold">Denní (D)</div><div class="text-xl font-extrabold text-amber-500 mt-0.5">${cntD}</div></div>
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-3"><div class="text-[10px] uppercase text-slate-400 font-bold">Noční (N)</div><div class="text-xl font-extrabold text-blue-500 mt-0.5">${cntN}</div></div>
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-3"><div class="text-[10px] uppercase text-slate-400 font-bold">Celkem směn</div><div class="text-xl font-extrabold text-white mt-0.5">${cntD + cntN}</div></div>
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-3"><div class="text-[10px] uppercase text-slate-400 font-bold">DOV / NV / PN</div><div class="text-xl font-extrabold text-emerald-500 mt-0.5">${cntOff}</div></div>
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 col-span-2 sm:col-span-1"><div class="text-[10px] uppercase text-slate-400 font-bold">Hodin</div><div class="text-xl font-extrabold text-sky-500 mt-0.5">${totalHours} h</div></div>
  `;

  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
  let calHtml = "";
  for (let i = 0; i < firstDow; i++) calHtml += `<div class="h-24 rounded-xl bg-slate-950/40 border border-slate-800/40"></div>`;

  for (let d = 1; d <= days; d++) {
    const entry = getEmployeeMergedDayEntry(mKey, currentUser.id, d);
    const dep = entry?.depotObj || getDepotById(activeDepotId);
    const typeMeta = {
      D: { label: "DENNÍ", cls: "bg-amber-400 text-slate-950", time: `${dep.dayStart}–${dep.dayEnd}` },
      N: { label: "NOČNÍ", cls: "bg-blue-600 text-white", time: `${dep.nightStart}–${dep.nightEnd}` },
      DOV: { label: "DOVOLENÁ", cls: "bg-emerald-500 text-slate-950", time: "Celý den" },
      NV: { label: "NÁHR. VOLNO", cls: "bg-teal-500 text-slate-950", time: "Celý den" },
      PN: { label: "NEMOC / PN", cls: "bg-red-500 text-white", time: "Celý den" },
      A: { label: "ABSENCE", cls: "bg-purple-600 text-white", time: "—" }
    };
    const meta = entry?.type ? typeMeta[entry.type] : null;
    const customTime = (entry?.start && entry?.end) ? `${entry.start}–${entry.end}` : meta?.time;
    const shortDepot = entry?.depotName ? entry.depotName.replace("Depo ", "") : "";

    calHtml += `<div class="min-h-[92px] rounded-xl p-1.5 border flex flex-col justify-between ${meta ? "bg-slate-800/90 border-slate-700" : "bg-slate-950/60 border-slate-800/70"}">
      <div class="flex items-center justify-between"><span class="text-xs font-extrabold ${meta ? "text-white" : "text-slate-500"}">${d}.</span>${shortDepot ? `<span class="text-[9px] font-bold px-1 rounded bg-slate-900/80 text-slate-300">${shortDepot}</span>` : ""}</div>
      ${meta ? `<div class="rounded-lg px-1.5 py-1 text-center ${meta.cls}"><div class="text-[10px] font-extrabold leading-tight">${meta.label}</div><div class="text-[9px] opacity-90 leading-tight mt-0.5">${customTime}</div></div>` : `<div class="text-center text-slate-600 text-xs pb-2">—</div>`}
    </div>`;
  }
  document.getElementById("emp-calendar-grid").innerHTML = calHtml;
}

function dismissRejectedNotice() {
  appState.requests.forEach(r => { if (r.userId === currentUser.id && r.status === "rejected") r.seenByUser = true; });
  renderEmployeeHome();
  pushToFirebase();
}

function openEmployeeRequestModal() {
  empReqType = "DOV"; empReqDates = [];
  document.getElementById("emp-req-note").value = "";
  selectEmpReqType("DOV");
  renderEmpRequestCalendar();
  openModal("modal-emp-request");
}

function selectEmpReqType(type) {
  empReqType = type;
  ["DOV", "NV", "PN"].forEach(tKey => {
    const btn = document.getElementById("req-type-" + tKey);
    btn.className = tKey === type
      ? "req-type-btn p-3 rounded-xl border text-xs font-extrabold text-left transition bg-amber-500/20 border-amber-400 text-amber-500"
      : "req-type-btn p-3 rounded-xl border text-xs font-extrabold text-left transition bg-slate-800 border-slate-700 text-slate-300";
  });
}

function renderEmpRequestCalendar() {
  const mKey = getMonthKey(anchorDate), days = getDaysInMonth(anchorDate), y = anchorDate.getFullYear(), m = anchorDate.getMonth();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
  document.getElementById("emp-req-selected-count").textContent = `Vybráno: ${empReqDates.length}`;

  let html = "";
  for (let i = 0; i < firstDow; i++) html += `<div></div>`;
  for (let d = 1; d <= days; d++) {
    const dateStr = formatDateStr(y, m, d);
    const shiftType = getEmployeeMergedDayEntry(mKey, currentUser.id, d)?.type || "";
    const isSelected = empReqDates.includes(dateStr);
    let baseCls = "bg-slate-800/70 border-slate-700 text-slate-400";
    if (shiftType === "D") baseCls = "bg-amber-500/15 border-amber-500/40 text-amber-500";
    if (shiftType === "N") baseCls = "bg-blue-500/15 border-blue-500/40 text-blue-500";
    if (isSelected) baseCls = "bg-emerald-500 border-emerald-300 text-slate-950 font-extrabold ring-2 ring-emerald-300";
    html += `<button type="button" onclick="toggleEmpReqDate('${dateStr}')" class="p-2 rounded-xl border text-center transition flex flex-col items-center justify-center ${baseCls}"><span class="text-xs font-bold">${d}.</span><span class="text-[9px] uppercase">${shiftType || "—"}</span></button>`;
  }
  document.getElementById("emp-req-calendar").innerHTML = html;
}

function toggleEmpReqDate(dateStr) {
  const idx = empReqDates.indexOf(dateStr);
  if (idx >= 0) empReqDates.splice(idx, 1); else empReqDates.push(dateStr);
  empReqDates.sort();
  renderEmpRequestCalendar();
}

function submitEmployeeRequest() {
  if (empReqDates.length === 0) { showToast("Vyberte alespoň jeden den.", "warn"); return; }
  const note = document.getElementById("emp-req-note").value.trim();
  const typeNames = { DOV: "Žádost o Dovolenou", NV: "Žádost o Náhradní volno", PN: "Nahlášení PN / Lékař" };
  appState.requests.unshift({ id: "req_" + Date.now(), userId: currentUser.id, userName: currentUser.name, type: empReqType, typeLabel: typeNames[empReqType], dates: [...empReqDates], note, status: "pending", seenByUser: false, createdAt: new Date().toLocaleString("cs-CZ") });
  if (!appState.chats[currentUser.id]) appState.chats[currentUser.id] = [];
  appState.chats[currentUser.id].push({ id: "m_" + Date.now(), senderRole: "employee", senderName: currentUser.name, text: `📋 Požadavek: ${typeNames[empReqType]} (${empReqDates.join(", ")})${note ? " – " + note : ""}`, time: new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }), readByAdmin: false, readByEmp: true });
  addAudit("Nový požadavek zaměstnance", `${currentUser.name}: ${typeNames[empReqType]} (${empReqDates.join(", ")})`);
  closeModal("modal-emp-request");
  pushToFirebase();
  showToast("Požadavek odeslán.", "success");
}

function updateAdminBadges() {
  const pendingCount = appState.requests.filter(r => r.status === "pending").length;
  const bellCount = document.getElementById("admin-req-count");
  const tabCount = document.getElementById("chat-tab-req-count");
  if (bellCount) bellCount.textContent = pendingCount;
  if (tabCount) tabCount.textContent = pendingCount;
}

function openAdminRequestsModal() {
  if (!canUserApproveRequests()) { showToast("Nemáte oprávnění schvalovat žádosti.", "warn"); return; }
  renderAdminRequestsList();
  openModal("modal-admin-requests");
}

function renderAdminRequestsList() {
  const container = document.getElementById("admin-requests-list");
  const pending = appState.requests.filter(r => r.status === "pending");
  if (pending.length === 0) { container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Žádné nevyřízené požadavky.</div>`; return; }
  container.innerHTML = pending.map(r => `
    <div class="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5">
      <div class="flex items-start justify-between gap-2">
        <div><div class="font-extrabold text-sm text-white">${r.userName}</div><div class="text-xs font-bold text-amber-500">${r.typeLabel} (${r.type})</div></div>
        <span class="text-[10px] text-slate-400">${r.createdAt}</span>
      </div>
      <div class="text-xs text-slate-200 bg-slate-900/90 p-2.5 rounded-lg border border-slate-700/70"><strong>Dny:</strong> ${r.dates.join(", ")}${r.note ? `<div class="text-slate-400 mt-1">Poznámka: ${r.note}</div>` : ""}</div>
      <div class="flex justify-end gap-2">
        <button onclick="resolveEmployeeRequest('${r.id}', 'rejected')" class="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 text-xs font-bold">Zamítnout</button>
        <button onclick="resolveEmployeeRequest('${r.id}', 'approved')" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold">Potvrdit</button>
      </div>
    </div>
  `).join("");
}

function resolveEmployeeRequest(reqId, decision) {
  const req = appState.requests.find(r => r.id === reqId);
  if (!req) return;
  req.status = decision;
  if (!appState.chats[req.userId]) appState.chats[req.userId] = [];

  if (decision === "approved") {
    const empObj = appState.users.find(u => u.id === req.userId);
    const fallbackDepot = (empObj && empObj.depots && empObj.depots[0]) ? empObj.depots[0] : activeDepotId;
    req.dates.forEach(dateStr => {
      const p = parseDateStr(dateStr);
      let targetDepot = fallbackDepot;
      for (const dep of appState.depots) {
        if (appState.schedules[p.mKey]?.[dep.id]?.[req.userId]?.[p.day]) { targetDepot = dep.id; break; }
      }
      const depotSched = getDepotScheduleMap(p.mKey, targetDepot);
      if (!depotSched[req.userId]) depotSched[req.userId] = {};
      depotSched[req.userId][p.day] = { type: req.type };
    });
    appState.chats[req.userId].push({ id: "m_" + Date.now(), senderRole: "admin", senderName: currentUser.name, text: `✅ Požadavek (${req.typeLabel}) na ${req.dates.join(", ")} byl POTVRZEN.`, time: new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }), readByAdmin: true, readByEmp: false });
    addAudit("Schválení požadavku", `${req.userName}: ${req.typeLabel} (${req.dates.join(", ")})`);
  } else {
    appState.chats[req.userId].push({ id: "m_" + Date.now(), senderRole: "admin", senderName: currentUser.name, text: `❌ Požadavek (${req.typeLabel}) na ${req.dates.join(", ")} byl ZAMÍTNUT.`, time: new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }), readByAdmin: true, readByEmp: false });
    addAudit("Zamítnutí požadavku", `${req.userName}: ${req.typeLabel} (${req.dates.join(", ")})`);
  }
  updateAdminBadges();
  renderAdminRequestsList();
  if (activeAdminTab === "schedule") renderAdminSchedule();
  pushToFirebase();
}

function openEmployeeChatModal() {
  const thread = appState.chats[currentUser.id] || [];
  thread.forEach(m => { if (m.senderRole === "admin") m.readByEmp = true; });
  renderEmployeeChatMessages();
  openModal("modal-emp-chat");
  pushToFirebase(true);
}

function renderEmployeeChatMessages() {
  const box = document.getElementById("emp-chat-messages");
  const thread = appState.chats[currentUser.id] || [];
  box.innerHTML = thread.length === 0
    ? `<div class="text-center text-xs text-slate-500 py-8">Zatím žádné zprávy.</div>`
    : thread.map(m => `<div class="flex flex-col ${m.senderRole === "employee" ? "items-end" : "items-start"}"><div class="max-w-[82%] px-3.5 py-2 rounded-2xl text-xs ${m.senderRole === "employee" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-200 border border-slate-700"}"><div class="text-[10px] opacity-75 font-bold mb-0.5">${m.senderName} • ${m.time}</div><div>${m.text}</div></div></div>`).join("");
  box.scrollTop = box.scrollHeight;
}

function sendEmployeeChatMessage(e) {
  e.preventDefault();
  const inp = document.getElementById("emp-chat-input");
  const text = inp.value.trim();
  if (!text) return;
  if (!appState.chats[currentUser.id]) appState.chats[currentUser.id] = [];
  appState.chats[currentUser.id].push({ id: "m_" + Date.now(), senderRole: "employee", senderName: currentUser.name, text, time: new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }), readByAdmin: false, readByEmp: true });
  inp.value = "";
  renderEmployeeChatMessages();
  pushToFirebase();
}

function renderAdminChatTab() {
  const employees = appState.users.filter(u => {
    const r = normalizeUserRole(u);
    return r !== "admin" && r !== "coordinator";
  });
  if (!selectedChatUserId && employees.length > 0) selectedChatUserId = employees[0].id;
  document.getElementById("admin-chat-threads").innerHTML = employees.map(u => {
    const thread = appState.chats[u.id] || [];
    const unread = thread.filter(m => m.senderRole === "employee" && !m.readByAdmin).length;
    return `<button onclick="selectAdminChatThread('${u.id}')" class="w-full p-2.5 rounded-xl text-left flex items-center justify-between transition ${selectedChatUserId === u.id ? "bg-blue-600 text-white" : "bg-slate-800/60 hover:bg-slate-800 text-slate-200"}"><div><div class="text-xs font-bold">${u.name}</div><div class="text-[10px] opacity-75">${thread.length} zpráv</div></div>${unread > 0 ? `<span class="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold">${unread}</span>` : ""}</button>`;
  }).join("");
  renderAdminActiveConversation();
}

function selectAdminChatThread(userId) {
  selectedChatUserId = userId;
  (appState.chats[userId] || []).forEach(m => { if (m.senderRole === "employee") m.readByAdmin = true; });
  renderAdminChatTab();
  pushToFirebase(true);
}

function renderAdminActiveConversation() {
  const emp = appState.users.find(u => u.id === selectedChatUserId);
  const hdr = document.getElementById("admin-chat-header");
  const box = document.getElementById("admin-chat-messages");
  if (!emp) return;
  hdr.textContent = `${emp.name} (${emp.roleLabel || emp.role}) ${emp.phone ? "• " + emp.phone : ""}`;
  const thread = appState.chats[emp.id] || [];
  box.innerHTML = thread.length === 0
    ? `<div class="text-center text-xs text-slate-500 py-8">Žádné zprávy.</div>`
    : thread.map(m => `<div class="flex flex-col ${m.senderRole === "admin" ? "items-end" : "items-start"}"><div class="max-w-[80%] px-3.5 py-2 rounded-2xl text-xs ${m.senderRole === "admin" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-200 border border-slate-700"}"><div class="text-[10px] opacity-75 font-bold mb-0.5">${m.senderName} • ${m.time}</div><div>${m.text}</div></div></div>`).join("");
  box.scrollTop = box.scrollHeight;
}

function sendAdminChatReply(e) {
  e.preventDefault();
  if (!selectedChatUserId) return;
  const inp = document.getElementById("admin-chat-input");
  const text = inp.value.trim();
  if (!text) return;
  if (!appState.chats[selectedChatUserId]) appState.chats[selectedChatUserId] = [];
  appState.chats[selectedChatUserId].push({ id: "m_" + Date.now(), senderRole: "admin", senderName: currentUser.name, text, time: new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }), readByAdmin: true, readByEmp: false });
  inp.value = "";
  renderAdminActiveConversation();
  pushToFirebase();
}

function renderAuditTab() {
  const tbody = document.getElementById("audit-log-tbody");
  if (appState.auditLog.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-500">Zatím žádné záznamy.</td></tr>`; return; }
  tbody.innerHTML = appState.auditLog.map(item => `<tr><td class="py-2 px-3 font-mono text-slate-400 whitespace-nowrap">${item.time}</td><td class="py-2 px-3 font-bold text-white">${item.actor}</td><td class="py-2 px-3"><span class="px-2 py-0.5 rounded bg-slate-800 text-blue-500 font-semibold">${item.type}</span></td><td class="py-2 px-3 text-slate-300">${item.detail}</td></tr>`).join("");
}

function exportAuditCSV() {
  const NL = String.fromCharCode(10);
  let csv = "\uFEFFCas;Uzivatel;Typ;Detail" + NL;
  appState.auditLog.forEach(a => { csv += `"${a.time}";"${a.actor}";"${a.type}";"${a.detail}"` + NL; });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `DepotShift_v${APP_VERSION}_AuditLog.csv`;
  a.click();
}

function showMyQrModal() { if (currentUser) openQrForUser(currentUser.id); }

function openQrForUser(userId) {
  const u = (draftUsers.length ? draftUsers : appState.users).find(x => x.id === userId);
  if (!u) return;
  const qrUrl = `${window.location.href.split("?")[0]}?token=${encodeURIComponent(u.token)}`;
  document.getElementById("qr-modal-name").textContent = `QR: ${u.name}`;
  document.getElementById("qr-link-text").textContent = qrUrl;
  const box = document.getElementById("qr-code-box");
  box.innerHTML = "";
  new QRCode(box, { text: qrUrl, width: 180, height: 180 });
  openModal("modal-qr");
}

function copyQrLink() {
  navigator.clipboard?.writeText(document.getElementById("qr-link-text").textContent);
  showToast("Odkaz zkopírován.", "success");
}

async function initApp() {
  applyLanguage(safeStorage.get("depotshift_lang") || "cs");
  applyTheme(safeStorage.get("depotshift_theme") || "dark");

  const cached = safeStorage.get("depotshift_cache");
  if (cached) { try { mergeRemoteState(JSON.parse(cached)); } catch (e) {} }
  ensureMultiDepotConsistency();

  await pullFromFirebase(true);

  const token = new URLSearchParams(window.location.search).get("token");
  if (token) {
    const tokenUser = appState.users.find(u => u.token === token);
    if (tokenUser) { completeLogin(tokenUser); return; }
  }

  const savedUid = safeStorage.get("depotshift_session_uid");
  if (savedUid) {
    const savedUser = appState.users.find(u => u.id === savedUid);
    if (savedUser) completeLogin(savedUser);
  }

  setInterval(() => pullFromFirebase(true), 15000);
}

window.addEventListener("DOMContentLoaded", initApp);
