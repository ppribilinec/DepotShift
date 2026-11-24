function getIsoMondayWeekIndex(y, m, day) {
  const dt = new Date(y, m, day);
  const jsDow = dt.getDay();
  const mondayOffset = (jsDow + 6) % 7;
  const mondayDate = new Date(y, m, day - mondayOffset);
  const epochMonday = new Date(1970, 0, 5);
  const diffDays = Math.round((mondayDate - epochMonday) / 86400000);
  return Math.floor(diffDays / 7);
}

function isWorkingDayForCalendar(calendarMode, y, m, day, isTurnusA = true) {
  const dow = new Date(y, m, day).getDay();
  if (calendarMode === "mon_fri") {
    return dow >= 1 && dow <= 5;
  }

  if (calendarMode && calendarMode !== "short_long") {
    const customCal = (appState.calendars || []).find(c => c.id === calendarMode || c.code === calendarMode);
    if (customCal && customCal.pattern) {
      const dStr = formatDateStr(y, m, day);
      if (customCal.pattern[dStr]) return true;
      const dowKey = "dow_" + dow;
      if (customCal.pattern[dowKey]) return true;
    }
  }

  const weekIdx = getIsoMondayWeekIndex(y, m, day);
  const isEvenWeek = (weekIdx % 2) === 0;
  const isLongWeek = isTurnusA ? isEvenWeek : !isEvenWeek;

  if (isLongWeek) {
    return [1, 2, 5, 6, 0].includes(dow);
  }
  return [3, 4].includes(dow);
}

function getUserShiftAcrossDepots(mKey, userId, day) {
  for (const dep of appState.depots) {
    const e = appState.schedules[mKey]?.[dep.id]?.[userId]?.[day];
    if (e && e.type) return e;
  }
  return null;
}

function violatesNightToDayByDateStr(userId, dateStr, newType) {
  const p = parseDateStr(dateStr);
  const prevDt = new Date(p.year, p.month, p.day - 1);
  const nextDt = new Date(p.year, p.month, p.day + 1);

  if (newType === "D" && getUserShiftAcrossDepots(getMonthKey(prevDt), userId, prevDt.getDate())?.type === "N") {
    return "Nelze naplánovat Denní směnu (D) hned po Noční směně (N) z předchozího dne!";
  }
  if (newType === "N" && getUserShiftAcrossDepots(getMonthKey(nextDt), userId, nextDt.getDate())?.type === "D") {
    return "Nelze naplánovat Noční směnu (N), protože následující den má pracovník Denní směnu (D)!";
  }
  return null;
}

function runAutoSchedule() {
  const mKey = getMonthKey(anchorDate);
  const days = getDaysInMonth(anchorDate);
  const y = anchorDate.getFullYear();
  const m = anchorDate.getMonth();
  const depot = getDepotById(activeDepotId);

  if (!depot.hasDay && !depot.hasNight) {
    showToast("Toto depo nemá povolenou ani denní ani noční směnu!", "error");
    return;
  }

  const depotSched = getDepotScheduleMap(mKey, activeDepotId);
  const coreUsers = appState.users.filter(u =>
    u.isScheduleable !== false &&
    u.role !== "admin" &&
    u.role !== "coordinator" &&
    Array.isArray(u.depots) && u.depots.includes(activeDepotId)
  );

  coreUsers.forEach(u => { depotSched[u.id] = {}; });

  const canWorkDay = (u, d, isTurnusA = true) => {
    const dStr = formatDateStr(y, m, d);
    if (u.terminatedFrom && dStr >= u.terminatedFrom) return false;
    if (getUserShiftAcrossDepots(mKey, u.id, d)) return false;

    const uCal = u.calendarMode || depot.calendarMode || "short_long";
    if (depot.calendarMode === "mon_fri" && uCal === "mon_fri") {
      const dow = new Date(y, m, d).getDay();
      if (dow === 0 || dow === 6) return false;
    }

    return isWorkingDayForCalendar(uCal, y, m, d, isTurnusA);
  };

  const resolveAllowedShift = (preferred) => {
    if (preferred === "D" && depot.hasDay) return "D";
    if (preferred === "N" && depot.hasNight) return "N";
    return depot.hasDay ? "D" : "N";
  };

  const foremen = coreUsers.filter(u => u.role === "foreman");
  foremen.forEach((u, idx) => {
    const turnusA = idx % 2 === 0;
    for (let d = 1; d <= days; d++) {
      if (canWorkDay(u, d, turnusA)) {
        depotSched[u.id][d] = { type: resolveAllowedShift("N") };
      }
    }
  });

  const pair1 = coreUsers.filter(u => u.name.includes("Doležal"));
  const pair2 = coreUsers.filter(u => u.name.includes("Hossen") || u.name.includes("Hossain"));
  const pair3 = coreUsers.filter(u => u.name.includes("Rahman") || u.name.includes("Islam"));
  const pairedIds = new Set([...pair1, ...pair2, ...pair3].map(u => u.id));
  const singles = coreUsers.filter(u => u.role !== "foreman" && !pairedIds.has(u.id));

  const assignUnit = (members, turnusA, preferDay) => {
    for (let d = 1; d <= days; d++) {
      members.forEach(member => {
        if (!canWorkDay(member, d, turnusA)) return;
        const prev = getUserShiftAcrossDepots(mKey, member.id, d - 1)?.type;
        let type = resolveAllowedShift(preferDay ? "D" : "N");
        if (type === "D" && prev === "N" && depot.hasNight) type = "N";
        depotSched[member.id][d] = { type };
      });
    }
  };

  assignUnit(pair1, true, false);
  assignUnit(pair2, false, false);
  assignUnit(pair3, true, true);

  singles.forEach((u, idx) => {
    assignUnit([u], idx % 2 === 0, true);
  });

  if (depot.hasDay) {
    for (let d = 1; d <= days; d++) {
      let dCount = coreUsers.filter(u => depotSched[u.id]?.[d]?.type === "D").length;
      if (dCount < 3) {
        for (let idx = 0; idx < singles.length; idx++) {
          const u = singles[idx];
          if (dCount >= 3) break;
          if (!canWorkDay(u, d, idx % 2 === 0)) continue;
          const prev = getUserShiftAcrossDepots(mKey, u.id, d - 1)?.type;
          const next = getUserShiftAcrossDepots(mKey, u.id, d + 1)?.type;
          if (prev !== "N" && next !== "D") {
            depotSched[u.id][d] = { type: "D" };
            dCount++;
          }
        }
      }
    }
  }

  addAudit("Autoplánování", `[${depot.name}] Vygenerován rozpis (${mKey}).`);
  renderAdminSchedule();
  pushToFirebase();
  showToast(`Rozpis pro ${depot.name} byl vygenerován.`, "success");
}

function clearCurrentMonth() {
  const mKey = getMonthKey(anchorDate);
  if (!appState.schedules[mKey]) appState.schedules[mKey] = {};
  appState.schedules[mKey][activeDepotId] = {};
  addAudit("Vyčištění depa", `[${getDepotName(activeDepotId)}] Vymazány směny pro ${mKey}.`);
  renderAdminSchedule();
  pushToFirebase();
}

function getUserRoleRank(role) {
  const r = (role || "").toLowerCase();
  if (r === "foreman" || r.includes("předák")) return 1;
  if (r === "specialist" || r.includes("specialista")) return 2;
  if (r === "warehouse" || r.includes("skladník")) return 3;
  return 4;
}

function compareUsersByRules(a, b) {
  const roleDiff = getUserRoleRank(a.role) - getUserRoleRank(b.role);
  if (roleDiff !== 0) return roleDiff;

  const dateA = a.createdAt || "9999-12-31";
  const dateB = b.createdAt || "9999-12-31";
  if (dateA !== dateB) return dateA.localeCompare(dateB);

  return (a.name || "").localeCompare(b.name || "", "cs");
}

function getVisibleRosterUsers() {
  const list = appState.users.filter(u =>
    u.isScheduleable !== false &&
    u.role !== "admin" &&
    u.role !== "coordinator" &&
    Array.isArray(u.depots) && u.depots.includes(activeDepotId) &&
    (showTerminatedWorkers || !u.terminatedFrom)
  );

  const customOrder = appState.depotUserOrder?.[activeDepotId];
  if (Array.isArray(customOrder) && customOrder.length > 0) {
    return list.sort((a, b) => {
      const idxA = customOrder.indexOf(a.id);
      const idxB = customOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return compareUsersByRules(a, b);
    });
  }

  return list.sort((a, b) => compareUsersByRules(a, b));
}

function applySmartSortToActiveDepot() {
  const list = appState.users.filter(u =>
    u.isScheduleable !== false &&
    u.role !== "admin" &&
    u.role !== "coordinator" &&
    Array.isArray(u.depots) && u.depots.includes(activeDepotId)
  );
  list.sort((a, b) => compareUsersByRules(a, b));
  if (!appState.depotUserOrder) appState.depotUserOrder = {};
  appState.depotUserOrder[activeDepotId] = list.map(u => u.id);
  addAudit("Seřazení zaměstnanců", `[${getDepotName(activeDepotId)}] Seřazeno: Předák → Specialista → Skladník.`);
  renderAdminSchedule();
  pushToFirebase();
  showToast("Zaměstnanci seřazeni: Předák → Specialista → Skladník.", "success");
}
