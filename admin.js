function markAdminDraftDirty() {
  hasUnsavedAdminChanges = true;
  const banner = document.getElementById("admin-unsaved-banner");
  if (banner) banner.classList.remove("hidden");
}

function clearAdminDraftDirty() {
  hasUnsavedAdminChanges = false;
  const banner = document.getElementById("admin-unsaved-banner");
  if (banner) banner.classList.add("hidden");
}

function switchAdminTab(tabId) {
  activeAdminTab = tabId;
  if (tabId === "settings" && !settingsSubTab) {
    settingsSubTab = "depots";
  }
  buildNavigationForRole();
  renderActiveRoleView();
}

function setSettingsSubTab(sub) {
  settingsSubTab = sub || "depots";
  const tabs = ["depots", "users", "calendars", "audit"];
  tabs.forEach(key => {
    const btn = document.getElementById("subtab-settings-" + key);
    const panel = document.getElementById("settings-panel-" + key);
    if (!btn || !panel) return;
    if (key === settingsSubTab) {
      btn.className = "px-3.5 py-2 rounded-xl text-xs font-extrabold bg-blue-600 text-white shadow flex items-center gap-1.5";
      panel.classList.remove("hidden");
    } else {
      btn.className = "px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center gap-1.5";
      panel.classList.add("hidden");
    }
  });

  if (settingsSubTab === "audit") renderAuditTab();
  else if (settingsSubTab === "calendars") renderCalendarsManager();
  else renderAdminSettingsMain();
}

function renderAdminSettingsMain() {
  if (!hasUnsavedAdminChanges || draftDepots.length === 0 || draftUsers.length === 0) {
    draftDepots = JSON.parse(JSON.stringify(appState.depots));
    draftUsers = JSON.parse(JSON.stringify(appState.users));
    clearAdminDraftDirty();
  }
  const apiInp = document.getElementById("settings-fb-apikey");
  if (apiInp) apiInp.value = getFirebaseApiKey();
  renderDepotsConfigGrid();
  renderDraftUsersTable();
}

function saveFirebaseApiKeyFromUI() {
  const inp = document.getElementById("settings-fb-apikey");
  if (!inp) return;
  setFirebaseApiKey(inp.value);
  showToast("Firebase Web API klíč uložen. Obnovuji spojení...", "success");
  ensureFirebaseAuth().then(() => pullFromFirebase(false));
}

function discardAdminDraftChanges() {
  draftDepots = JSON.parse(JSON.stringify(appState.depots));
  draftUsers = JSON.parse(JSON.stringify(appState.users));
  clearAdminDraftDirty();
  renderDepotsConfigGrid();
  renderDraftUsersTable();
  showToast("Dočasné změny byly vráceny zpět.", "info");
}

function saveAllAdminChanges() {
  if (draftDepots.length > 0) {
    draftDepots.forEach(d => {
      if (!d.hasDay && !d.hasNight) d.hasDay = true;
    });
    appState.depots = JSON.parse(JSON.stringify(draftDepots));
  }

  if (!appState.depots.some(d => d.id === activeDepotId)) {
    activeDepotId = appState.depots[0].id;
  }

  const validDepotIds = new Set(appState.depots.map(d => d.id));
  draftUsers.forEach(u => {
    u.role = normalizeUserRole(u);
    u.depots = (u.depots || []).filter(id => validDepotIds.has(id));
  });

  appState.users = JSON.parse(JSON.stringify(draftUsers));
  clearAdminDraftDirty();

  addAudit("Nastavení dep a uživatelů", "Uloženy změny v nastavení dep, uživatelů, směn 1/2 a oprávnění.");
  renderDepotsConfigGrid();
  renderDraftUsersTable();
  pushToFirebase();
  showToast("Všechny změny byly uloženy do databáze!", "success");
}

function createNewDepot() {
  const inp = document.getElementById("new-depot-name");
  const name = inp.value.trim();
  if (!name) return;
  const newId = "depo_" + Date.now();
  draftDepots.push({
    id: newId,
    name,
    calendarMode: "short_long",
    hasDay: true,
    dayStart: "03:00",
    dayEnd: "15:00",
    hasNight: true,
    nightStart: "18:30",
    nightEnd: "06:30",
    agStart: "19:00",
    agEnd: "07:00"
  });
  inp.value = "";
  markAdminDraftDirty();
  renderDepotsConfigGrid();
  showToast(`Depo "${name}" přidáno do návrhu. Klikněte na „Uložit změny“.`, "info");
}

function deleteDepot(depotId) {
  if (draftDepots.length <= 1) {
    showToast("V systému musí zůstat alespoň jedno depo.", "error");
    return;
  }
  const target = draftDepots.find(d => d.id === depotId);
  draftDepots = draftDepots.filter(d => d.id !== depotId);
  draftUsers.forEach(u => { u.depots = (u.depots || []).filter(id => id !== depotId); });
  markAdminDraftDirty();
  renderDepotsConfigGrid();
  renderDraftUsersTable();
  showToast(`Depo "${target?.name}" odebráno z návrhu. Klikněte na „Uložit změny“.`, "info");
}

function updateDepotField(idx, field, value) {
  if (!draftDepots[idx]) return;
  draftDepots[idx][field] = value;
  markAdminDraftDirty();
}

function getCalendarOptionsHtml(selectedMode) {
  const baseOpts = `
    <option value="short_long" ${selectedMode === "short_long" ? "selected" : ""}>Krátký / Dlouhý</option>
    <option value="mon_fri" ${selectedMode === "mon_fri" ? "selected" : ""}>Pondělí – Pátek</option>
  `;
  const extraOpts = (appState.calendars || [])
    .filter(c => !["short_long", "mon_fri"].includes(c.code))
    .map(c => `<option value="${escapeAttr(c.id)}" ${selectedMode === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
    .join("");
  return baseOpts + extraOpts;
}

function renderDepotsConfigGrid() {
  const grid = document.getElementById("depots-config-grid");
  if (!grid) return;
  grid.innerHTML = draftDepots.map((d, idx) => `
    <div class="p-4 rounded-2xl bg-slate-800/70 border border-slate-700 space-y-3">
      <div class="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-2.5">
        <div class="flex items-center gap-2 flex-1">
          <i class="fa-solid fa-warehouse text-blue-500"></i>
          <input type="text" value="${escapeAttr(d.name)}" oninput="updateDepotField(${idx}, 'name', this.value)"
            class="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-extrabold text-white w-full max-w-[220px]" />
        </div>
        ${idx === 0 ? "" : `
          <button type="button" onclick="deleteDepot('${escapeAttr(d.id)}')" class="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400" title="Smazat depo">
            <i class="fa-solid fa-trash"></i>
          </button>
        `}
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/70">
        <span class="font-bold text-sky-400"><i class="fa-solid fa-calendar-week mr-1"></i> Plánovací kalendář</span>
        <select onchange="updateDepotField(${idx}, 'calendarMode', this.value)" class="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white">
          ${getCalendarOptionsHtml(d.calendarMode)}
        </select>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
        <label class="inline-flex items-center gap-2 font-bold text-amber-500 cursor-pointer">
          <input type="checkbox" ${d.hasDay ? "checked" : ""} onchange="updateDepotField(${idx}, 'hasDay', this.checked)" class="w-4 h-4 accent-amber-500 rounded" />
          <span>Denní směna (D)</span>
        </label>
        <div class="flex items-center gap-1.5">
          <input type="time" value="${escapeAttr(d.dayStart)}" onchange="updateDepotField(${idx}, 'dayStart', this.value)" class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white" />
          <span class="text-slate-400">–</span>
          <input type="time" value="${escapeAttr(d.dayEnd)}" onchange="updateDepotField(${idx}, 'dayEnd', this.value)" class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white" />
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
        <label class="inline-flex items-center gap-2 font-bold text-blue-500 cursor-pointer">
          <input type="checkbox" ${d.hasNight ? "checked" : ""} onchange="updateDepotField(${idx}, 'hasNight', this.checked)" class="w-4 h-4 accent-blue-600 rounded" />
          <span>Noční směna (N)</span>
        </label>
        <div class="flex items-center gap-1.5">
          <input type="time" value="${escapeAttr(d.nightStart)}" onchange="updateDepotField(${idx}, 'nightStart', this.value)" class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white" />
          <span class="text-slate-400">–</span>
          <input type="time" value="${escapeAttr(d.nightEnd)}" onchange="updateDepotField(${idx}, 'nightEnd', this.value)" class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white" />
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-700/60">
        <span class="font-bold text-purple-400"><i class="fa-solid fa-people-arrows mr-1"></i> Výchozí čas AG</span>
        <div class="flex items-center gap-1.5">
          <input type="time" value="${escapeAttr(d.agStart)}" onchange="updateDepotField(${idx}, 'agStart', this.value)" class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white" />
          <span class="text-slate-400">–</span>
          <input type="time" value="${escapeAttr(d.agEnd)}" onchange="updateDepotField(${idx}, 'agEnd', this.value)" class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white" />
        </div>
      </div>
    </div>
  `).join("");
}

function updateDraftUserField(userIdx, field, value) {
  if (!draftUsers[userIdx]) return;
  draftUsers[userIdx][field] = value;
  markAdminDraftDirty();
  if (field === "calendarMode") {
    renderDraftUsersTable();
  }
}

function updateDraftUserPerm(userIdx, permKey, checked) {
  if (!draftUsers[userIdx]) return;
  if (!draftUsers[userIdx].perms) draftUsers[userIdx].perms = {};
  draftUsers[userIdx].perms[permKey] = checked;
  markAdminDraftDirty();
}

function toggleDraftUserDepot(userIdx, depotId, checked) {
  if (!Array.isArray(draftUsers[userIdx].depots)) draftUsers[userIdx].depots = [];
  if (checked) {
    if (!draftUsers[userIdx].depots.includes(depotId)) draftUsers[userIdx].depots.push(depotId);
  } else {
    draftUsers[userIdx].depots = draftUsers[userIdx].depots.filter(id => id !== depotId);
  }
  markAdminDraftDirty();
}

function toggleDraftPasswordVisibility(idx) {
  const inp = document.getElementById("draft-pass-inp-" + idx);
  const icon = document.getElementById("draft-pass-eye-" + idx);
  if (!inp) return;
  if (inp.type === "password") {
    inp.type = "text";
    if (icon) icon.className = "fa-solid fa-eye-slash";
  } else {
    inp.type = "password";
    if (icon) icon.className = "fa-solid fa-eye";
  }
}

function renderDraftUsersTable() {
  const tbody = document.getElementById("users-draft-tbody");
  if (!tbody) return;
  const depotsSource = draftDepots.length ? draftDepots : appState.depots;

  tbody.innerHTML = draftUsers.map((u, idx) => {
    const uRole = normalizeUserRole(u);
    const uCal = u.calendarMode || "short_long";
    const sGroup = String(u.shiftGroup || "1") === "2" ? "2" : "1";
    const uDepots = Array.isArray(u.depots) ? u.depots : [];
    const depotCheckboxes = depotsSource.map(d => {
      const isChecked = uDepots.includes(d.id);
      return `<label class="inline-flex items-center gap-1 mr-2 mb-1 cursor-pointer text-[11px] font-semibold text-slate-200">
        <input type="checkbox" ${isChecked ? "checked" : ""} onchange="toggleDraftUserDepot(${idx}, '${escapeAttr(d.id)}', this.checked)" class="w-3.5 h-3.5 accent-blue-600 rounded" />
        <span>${escapeHtml((d.name || "").replace("Depo ", ""))}</span>
      </label>`;
    }).join("");

    const shiftGroupSelectHtml = uCal === "short_long"
      ? `<select onchange="updateDraftUserField(${idx}, 'shiftGroup', this.value)" class="mt-1 w-full bg-slate-900 border border-sky-500/40 rounded-lg px-2 py-1 text-[11px] font-extrabold ${sGroup === "1" ? "text-amber-400" : "text-purple-400"}">
          <option value="1" ${sGroup === "1" ? "selected" : ""}>Směna 1 (2.11. dlouhý)</option>
          <option value="2" ${sGroup === "2" ? "selected" : ""}>Směna 2 (2.11. krátký)</option>
        </select>`
      : "";

    const p = u.perms || {};
    const permsBox = uRole === "admin"
      ? `<span class="text-[10px] font-bold text-emerald-400">Plná práva Admin</span>`
      : `<div class="space-y-0.5 text-[10px] text-slate-300">
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" ${p.requestAg ? "checked" : ""} onchange="updateDraftUserPerm(${idx}, 'requestAg', this.checked)" class="accent-purple-500" /><span>Požadavek AG</span></label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" ${p.approveRequests ? "checked" : ""} onchange="updateDraftUserPerm(${idx}, 'approveRequests', this.checked)" class="accent-emerald-500" /><span>Schválit žádosti</span></label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" ${p.editShifts ? "checked" : ""} onchange="updateDraftUserPerm(${idx}, 'editShifts', this.checked)" class="accent-blue-500" /><span>Měnit směny</span></label>
        </div>`;

    const termControls = u.id === "u_admin" ? `<span class="text-[10px] text-slate-500">Admin</span>` : `
      <div class="inline-flex items-center gap-1">
        ${u.terminatedFrom
          ? `<button type="button" onclick="restoreTerminatedUser(${idx})" class="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold" title="Ukončen od ${escapeAttr(u.terminatedFrom)}">Obnovit</button>`
          : `<button type="button" onclick="openTerminateModal(${idx})" class="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-[10px] font-bold">Ukončit</button>`
        }
        <button type="button" onclick="removeDraftUser(${idx})" class="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;

    return `<tr class="${u.terminatedFrom ? "opacity-65" : ""}">
      <td class="py-2 px-1.5">
        <input type="text" value="${escapeAttr(u.name)}" oninput="updateDraftUserField(${idx}, 'name', this.value)"
          class="w-full min-w-[130px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white" />
      </td>
      <td class="py-2 px-1.5">
        <input type="tel" value="${escapeAttr(u.phone || "")}" oninput="updateDraftUserField(${idx}, 'phone', this.value)" placeholder="+420..."
          class="w-28 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono" />
      </td>
      <td class="py-2 px-1.5">
        <select onchange="updateDraftUserRole(${idx}, this.value)" class="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
          <option value="admin" ${uRole === "admin" ? "selected" : ""}>Admin</option>
          <option value="coordinator" ${uRole === "coordinator" ? "selected" : ""}>Koordinátor</option>
          <option value="foreman" ${uRole === "foreman" ? "selected" : ""}>Předák</option>
          <option value="specialist" ${uRole === "specialist" ? "selected" : ""}>Specialista</option>
          <option value="warehouse" ${uRole === "warehouse" ? "selected" : ""}>Skladník</option>
        </select>
      </td>
      <td class="py-2 px-1.5 min-w-[155px]">
        <select onchange="updateDraftUserField(${idx}, 'calendarMode', this.value)" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-sky-400 font-bold">
          ${getCalendarOptionsHtml(uCal)}
        </select>
        ${shiftGroupSelectHtml}
      </td>
      <td class="py-2 px-1.5 min-w-[130px]">${permsBox}</td>
      <td class="py-2 px-1.5 min-w-[135px]">
        <div class="flex flex-wrap items-center">${depotCheckboxes}</div>
      </td>
      <td class="py-2 px-1.5">
        <input type="text" value="${escapeAttr(u.login)}" oninput="updateDraftUserField(${idx}, 'login', this.value.trim())"
          class="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white" />
      </td>
      <td class="py-2 px-1.5">
        <div class="inline-flex items-center gap-1">
          <input id="draft-pass-inp-${idx}" type="password" value="${escapeAttr(u.pass)}" oninput="updateDraftUserField(${idx}, 'pass', this.value)"
            class="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white" />
          <button type="button" onclick="toggleDraftPasswordVisibility(${idx})" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white" title="Zobrazit / skrýt heslo">
            <i id="draft-pass-eye-${idx}" class="fa-solid fa-eye"></i>
          </button>
        </div>
      </td>
      <td class="py-2 px-1.5 text-center">
        <input type="checkbox" ${u.isScheduleable !== false && uRole !== "admin" && uRole !== "coordinator" ? "checked" : ""}
          onchange="updateDraftUserField(${idx}, 'isScheduleable', this.checked)" class="w-4 h-4 accent-blue-600" />
      </td>
      <td class="py-2 px-1.5 text-center">
        <button type="button" onclick="openQrForUser('${escapeAttr(u.id)}')" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-500 border border-slate-700">
          <i class="fa-solid fa-qrcode"></i>
        </button>
      </td>
      <td class="py-2 px-1.5 text-right whitespace-nowrap">${termControls}</td>
    </tr>`;
  }).join("");
}

function updateDraftUserRole(idx, role) {
  const labels = { admin: "Admin", coordinator: "Koordinátor AG", foreman: "Předák", specialist: "Specialista", warehouse: "Skladník" };
  draftUsers[idx].role = role;
  draftUsers[idx].roleLabel = labels[role] || role;
  draftUsers[idx].isScheduleable = !["admin", "coordinator"].includes(role);
  markAdminDraftDirty();
  renderDraftUsersTable();
}

function removeDraftUser(idx) {
  draftUsers.splice(idx, 1);
  markAdminDraftDirty();
  renderDraftUsersTable();
}

function onNewUserCalendarChange() {
  const calVal = document.getElementById("new-user-calendar").value;
  const wrap = document.getElementById("new-user-shiftgroup-wrap");
  if (wrap) {
    wrap.classList.toggle("hidden", calVal !== "short_long");
  }
}

function openCreateUserModal() {
  document.getElementById("new-user-name").value = "";
  document.getElementById("new-user-phone").value = "";
  document.getElementById("new-user-role").value = "warehouse";
  document.getElementById("new-user-shiftgroup").value = "1";
  document.getElementById("new-perm-ag").checked = false;
  document.getElementById("new-perm-approve").checked = false;
  document.getElementById("new-perm-edit").checked = false;

  const activeDep = (draftDepots.find(d => d.id === activeDepotId) || draftDepots[0] || getDepotById(activeDepotId));
  const calSel = document.getElementById("new-user-calendar");
  calSel.innerHTML = getCalendarOptionsHtml(activeDep.calendarMode || "short_long");
  onNewUserCalendarChange();

  const depotsSource = draftDepots.length ? draftDepots : appState.depots;
  document.getElementById("new-user-depots-box").innerHTML = depotsSource.map(d => `
    <label class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-200 cursor-pointer">
      <input type="checkbox" value="${escapeAttr(d.id)}" ${d.id === activeDep.id ? "checked" : ""} class="new-user-depot-chk w-4 h-4 accent-blue-600 rounded" />
      <span>${escapeHtml(d.name)}</span>
    </label>
  `).join("");

  openModal("modal-create-user");
}

function submitCreateUserModal(e) {
  e.preventDefault();
  const name = document.getElementById("new-user-name").value.trim();
  if (!name) return;
  const phone = document.getElementById("new-user-phone").value.trim();
  const role = document.getElementById("new-user-role").value;
  const calendarMode = document.getElementById("new-user-calendar").value;
  const shiftGroup = document.getElementById("new-user-shiftgroup").value || "1";

  const perms = {
    requestAg: role === "admin" || document.getElementById("new-perm-ag").checked,
    approveRequests: role === "admin" || document.getElementById("new-perm-approve").checked,
    editShifts: role === "admin" || document.getElementById("new-perm-edit").checked
  };

  const selectedDepots = Array.from(document.querySelectorAll(".new-user-depot-chk:checked")).map(cb => cb.value);
  const labels = { admin: "Admin", coordinator: "Koordinátor AG", foreman: "Předák", specialist: "Specialista", warehouse: "Skladník" };

  const slugBase = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "user";
  const suffix = Math.floor(10 + Math.random() * 89);
  const login = `${slugBase}${suffix}`;
  const pass = `${slugBase}123`;
  const todayStr = new Date().toISOString().split("T")[0];

  draftUsers.push({
    id: "u_" + Date.now(),
    name,
    phone,
    role,
    roleLabel: labels[role] || role,
    calendarMode,
    shiftGroup,
    perms,
    login,
    pass,
    token: "tok_" + Math.random().toString(36).slice(2, 10),
    isScheduleable: !["admin", "coordinator"].includes(role),
    depots: selectedDepots.length ? selectedDepots : [activeDepotId],
    terminatedFrom: null,
    createdAt: todayStr
  });

  markAdminDraftDirty();
  closeModal("modal-create-user");
  renderDraftUsersTable();
  showToast(`Uživatel "${name}" vytvořen (login: ${login}). Potvrďte kliknutím na „Uložit změny“.`, "success");
}

function renderCalendarsManager() {
  const listEl = document.getElementById("calendars-list-box");
  if (!listEl) return;
  const cals = appState.calendars || DEFAULT_CALENDARS;
  listEl.innerHTML = cals.map(c => {
    const patternCount = Object.keys(c.pattern || {}).length;
    const isBuiltIn = ["cal_short_long", "cal_mon_fri"].includes(c.id);
    return `<div class="p-4 rounded-2xl bg-slate-800/70 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="font-extrabold text-sm text-white flex items-center gap-2">
          <i class="fa-solid fa-calendar-check text-sky-400"></i>
          <span>${escapeHtml(c.name)}</span>
          ${patternCount > 0 ? `<span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">${patternCount} vzorových dnů</span>` : ""}
        </div>
        <div class="text-xs text-slate-400 mt-0.5">${escapeHtml(c.description || "")}</div>
      </div>
      <div class="flex items-center gap-2">
        ${isBuiltIn ? `<span class="text-[11px] text-slate-500 font-semibold">Systémový režim</span>` : `
          <button type="button" onclick="deleteCustomCalendar('${escapeAttr(c.id)}')" class="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-bold">
            Smazat
          </button>
        `}
      </div>
    </div>`;
  }).join("");
}

function openCalendarBuilderModal() {
  document.getElementById("new-cal-name").value = "";
  document.getElementById("new-cal-desc").value = "";
  builderMonthDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  builderPattern = {};
  setBuilderShiftType("D");
  renderCalendarBuilderGrid();
  openModal("modal-calendar-builder");
}

function setBuilderShiftType(type) {
  builderSelectedShift = type;
  ["D", "N", ""].forEach(tKey => {
    const btn = document.getElementById("bshift-" + (tKey || "OFF"));
    if (!btn) return;
    btn.classList.toggle("ring-2", tKey === type);
    btn.classList.toggle("ring-white", tKey === type);
  });
}

function stepBuilderMonth(delta) {
  builderMonthDate = new Date(builderMonthDate.getFullYear(), builderMonthDate.getMonth() + delta, 1);
  renderCalendarBuilderGrid();
}

function renderCalendarBuilderGrid() {
  const y = builderMonthDate.getFullYear();
  const m = builderMonthDate.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;

  document.getElementById("builder-month-label").textContent = builderMonthDate.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });

  let html = "";
  for (let i = 0; i < firstDow; i++) html += `<div></div>`;

  for (let d = 1; d <= days; d++) {
    const dateStr = formatDateStr(y, m, d);
    const val = builderPattern[dateStr] || "";
    let cls = "bg-slate-800/80 border-slate-700 text-slate-300";
    if (val === "D") cls = "bg-amber-400 border-amber-300 text-slate-950 font-extrabold";
    if (val === "N") cls = "bg-blue-600 border-blue-400 text-white font-extrabold";

    html += `<button type="button" onclick="toggleBuilderDay('${dateStr}')" class="p-2 rounded-xl border text-center transition ${cls}">
      <div class="text-xs font-bold">${d}.</div>
      <div class="text-[10px]">${val || "—"}</div>
    </button>`;
  }
  document.getElementById("builder-calendar-grid").innerHTML = html;
}

function toggleBuilderDay(dateStr) {
  if (!builderSelectedShift) {
    delete builderPattern[dateStr];
  } else if (builderPattern[dateStr] === builderSelectedShift) {
    delete builderPattern[dateStr];
  } else {
    builderPattern[dateStr] = builderSelectedShift;
  }
  renderCalendarBuilderGrid();
}

function saveNewCalendarPattern() {
  const name = document.getElementById("new-cal-name").value.trim();
  if (!name) {
    showToast("Zadejte název nového kalendáře.", "warn");
    return;
  }
  const desc = document.getElementById("new-cal-desc").value.trim() || "Vlastní vzor směn vytvořený v měsíčním kalendáři.";
  const id = "cal_" + Date.now();

  appState.calendars.push({
    id,
    code: id,
    name,
    description: desc,
    pattern: { ...builderPattern }
  });

  addAudit("Nový kalendář směn", `Vytvořen kalendář "${name}" (${Object.keys(builderPattern).length} dnů).`);
  closeModal("modal-calendar-builder");
  renderCalendarsManager();
  pushToFirebase();
  showToast(`Kalendář "${name}" byl uložen.`, "success");
}

function deleteCustomCalendar(calId) {
  appState.calendars = (appState.calendars || []).filter(c => c.id !== calId);
  addAudit("Smazání kalendáře", `Odstraněn vlastní kalendář (${calId}).`);
  renderCalendarsManager();
  pushToFirebase();
  showToast("Kalendář byl odstraněn.", "info");
}
