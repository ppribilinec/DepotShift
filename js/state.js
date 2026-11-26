const APP_VERSION = "0.9b";
const FIREBASE_PROJECT_ID = "planovani-dochazky";
const FIREBASE_DB_BASE = "https://planovani-dochazky-default-rtdb.europe-west1.firebasedatabase.app/depotshift_v1.json";

// Optional Firebase Web API Key for `auth != null` Realtime Database rules (can also be configured in Settings -> Depa/Security)
const DEFAULT_FIREBASE_API_KEY = "";

const memStore = {};
const safeStorage = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return memStore[k] || null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { memStore[k] = v; } }
};

function getFirebaseApiKey() {
  return (safeStorage.get("depotshift_fb_apikey") || DEFAULT_FIREBASE_API_KEY || "").trim();
}

function setFirebaseApiKey(key) {
  safeStorage.set("depotshift_fb_apikey", (key || "").trim());
}

// Strict HTML escaping to prevent XSS across all user-supplied fields
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}

let currentLang = "cs";

const I18N = {
  cs: {
    loginSub: "Warehouse Roster & Agency Planner • Více dep",
    loginUser: "Uživatelské jméno",
    loginPass: "Heslo",
    loginSubmit: "Přihlásit se do systému",
    lightTheme: "Světlý motiv",
    darkTheme: "Tmavý motiv",
    btnSettings: "Nastavení",
    btnChangePass: "Heslo",
    bellReq: "Žádosti",
    logout: "Odhlásit",
    tabSchedule: "Plánování směn",
    tabChat: "Zprávy & Požadavky",
    tabCoordReq: "Požadavky na AG pracovníky",
    tabCoordSum: "Odpracované směny AG",
    activeDepot: "Aktivní depo:",
    showTerminated: "Zobrazit ukončené pracovníky",
    btnAuto: "Autoplánování",
    btnSort: "Seřadit dle pozic",
    btnAddAg: "Požadavek AG",
    btnExport: "Export docházky",
    btnClear: "Vyčistit",
    vmodeMonth: "Měsíční",
    vmodeBiweek: "Dvoutýdenní",
    vmodeWeek: "Týdenní",
    subtabDepots: "Depa",
    subtabUsers: "Uživatelé",
    subtabCalendars: "Kalendáře směn",
    subtabAudit: "Audit Log",
    backRoster: "Zpět na plánování směn",
    depotsTitle: "Správa dep, plánovacího kalendáře a směn",
    depotsSub: "U každého depa nastavte plánovací kalendář (Krátký / Dlouhý: Po, Út, Pá, So, Ne vs. St, Čt, nebo Pondělí – Pátek), směny a časy.",
    btnAddDepot: "Přidat depo",
    btnSaveDepots: "Uložit změny",
    usersTitle: "Administrace uživatelů, rolí, oprávnění a dep",
    usersSub: "Hesla uživatelů jsou chráněna a viditelná pouze administrátorovi a samotnému uživateli.",
    btnAddUser: "Vytvořit uživatele",
    btnSaveUsers: "Uložit změny",
    dangerTitle: "Nebezpečná zóna – Vymazání databáze",
    dangerSub: "Trvale vymaže všechny naplánované směny, požadavky AG, žádosti zaměstnanců i historii zpráv.",
    btnResetDb: "Vymazat databázi",
    empReqBtn: "Požadavek",
    empChatBtn: "Zpráva pro Admina",
    coordTitle: "Požadavky na agenturní zaměstnance",
    coordSub: "Doplňte jména agenturních pracovníků a potvrďte tlačítkem Uložit změny.",
    coordSumTitle: "Přehled odpracovaných směn agenturních zaměstnanců",
    calTitle: "Administrace kalendářů směn",
    calSub: "Režimy Krátký / Dlouhý a Pondělí – Pátek nebo vlastní vzor vytvořený v měsíčním kalendáři.",
    btnAddCal: "Přidat Kalendář",
    chatList: "Konverzace",
    dragHint: "Přetažením jména změníte pořadí • Kliknutím upravíte směnu"
  },
  en: {
    loginSub: "Warehouse Roster & Agency Planner • Multi-Depot",
    loginUser: "Username",
    loginPass: "Password",
    loginSubmit: "Sign In",
    lightTheme: "Light Mode",
    darkTheme: "Dark Mode",
    btnSettings: "Settings",
    btnChangePass: "Password",
    bellReq: "Requests",
    logout: "Sign Out",
    tabSchedule: "Shift Roster",
    tabChat: "Messages & Requests",
    tabCoordReq: "Agency Worker Requests",
    tabCoordSum: "Agency Worked Shifts",
    activeDepot: "Active Depot:",
    showTerminated: "Show terminated employees",
    btnAuto: "Auto-Schedule",
    btnSort: "Sort by Role",
    btnAddAg: "Agency Request",
    btnExport: "Export Roster",
    btnClear: "Clear",
    vmodeMonth: "Monthly",
    vmodeBiweek: "Bi-weekly",
    vmodeWeek: "Weekly",
    subtabDepots: "Depots",
    subtabUsers: "Users",
    subtabCalendars: "Shift Calendars",
    subtabAudit: "Audit Log",
    backRoster: "Back to Shift Roster",
    depotsTitle: "Depot, Schedule Calendar & Shift Configuration",
    depotsSub: "Configure each depot's calendar (Short / Long or Monday – Friday), shifts and hours.",
    btnAddDepot: "Add Depot",
    btnSaveDepots: "Save Changes",
    usersTitle: "User Administration, Roles, Permissions & Depots",
    usersSub: "User passwords are protected and visible only to the Administrator and the user themselves.",
    btnAddUser: "Create User",
    btnSaveUsers: "Save Changes",
    dangerTitle: "Danger Zone – Wipe Database",
    dangerSub: "Permanently deletes all scheduled shifts, agency requests, employee requests and chat history.",
    btnResetDb: "Wipe Database",
    empReqBtn: "Request",
    empChatBtn: "Message Admin",
    coordTitle: "Agency Worker Requests",
    coordSub: "Assign agency worker names and confirm with Save Changes.",
    coordSumTitle: "Agency Worked Shifts Summary",
    calTitle: "Shift Calendars Administration",
    calSub: "Short / Long and Monday – Friday schedules or custom monthly roster templates.",
    btnAddCal: "Add Calendar",
    chatList: "Conversations",
    dragHint: "Drag employee name to reorder • Click cell to edit shift"
  }
};

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || I18N.cs[key] || key;
}

function normalizeUserRole(u) {
  if (!u) return "warehouse";
  const r = (u.role || "").toString().trim().toLowerCase();
  const lbl = (u.roleLabel || "").toString().trim().toLowerCase();
  if (r === "admin" || r === "administrátor") return "admin";
  if (r === "coordinator" || r === "koordinator" || r === "koordinátor" || lbl.includes("koordin") || u.id === "u_roy") return "coordinator";
  if (r === "foreman" || r === "predak" || r === "předák" || lbl.includes("předák")) return "foreman";
  if (r === "specialist" || r === "specialista" || lbl.includes("specialista")) return "specialist";
  return "warehouse";
}

const DEFAULT_DEPOTS = [
  {
    id: "depo_plzen",
    name: "Depo Plzeň",
    calendarMode: "short_long",
    hasDay: true,
    dayStart: "03:00",
    dayEnd: "15:00",
    hasNight: true,
    nightStart: "18:30",
    nightEnd: "06:30",
    agStart: "19:00",
    agEnd: "07:00"
  },
  {
    id: "depo_teplice",
    name: "Depo Teplice",
    calendarMode: "short_long",
    hasDay: true,
    dayStart: "03:00",
    dayEnd: "15:00",
    hasNight: true,
    nightStart: "21:00",
    nightEnd: "09:00",
    agStart: "21:00",
    agEnd: "09:00"
  }
];

const DEFAULT_CALENDARS = [
  { id: "cal_short_long", code: "short_long", name: "Krátký / Dlouhý", description: "Střídání po týdnu (Po–Ne): krátký týden St–Čt, dlouhý týden Po, Út, Pá, So, Ne.", pattern: {} },
  { id: "cal_mon_fri", code: "mon_fri", name: "Pondělí – Pátek", description: "Pracovní dny Pondělí až Pátek, víkendy volné.", pattern: {} }
];

const DEFAULT_USERS = [
  { id: "u_admin", name: "Peter Pribilinec", phone: "+420 777 100 001", role: "admin", roleLabel: "Admin", calendarMode: "mon_fri", login: "admin", pass: "admin123", token: "tok_admin_peter", isScheduleable: false, depots: ["depo_plzen", "depo_teplice"], perms: { requestAg: true, approveRequests: true, editShifts: true }, terminatedFrom: null, createdAt: "2026-09-01" },
  { id: "u_roy", name: "Roy (Koordinátor)", phone: "+420 777 100 002", role: "coordinator", roleLabel: "Koordinátor AG", calendarMode: "short_long", login: "roy", pass: "roy123", token: "tok_coord_roy", isScheduleable: false, depots: ["depo_plzen", "depo_teplice"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-01" },
  { id: "u_vojtech", name: "Vojtěch Navrátil", phone: "+420 777 201 101", role: "foreman", roleLabel: "Předák", calendarMode: "short_long", login: "vojtech", pass: "vojtech123", token: "tok_vojtech", isScheduleable: true, depots: ["depo_plzen"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-02" },
  { id: "u_marek", name: "Marek Švejda", phone: "+420 777 201 102", role: "foreman", roleLabel: "Předák", calendarMode: "short_long", login: "marek", pass: "marek123", token: "tok_marek", isScheduleable: true, depots: ["depo_plzen"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-03" },
  { id: "u_ladislav", name: "Ladislav Hubler", phone: "+420 777 201 103", role: "foreman", roleLabel: "Předák", calendarMode: "short_long", login: "ladislav", pass: "ladislav123", token: "tok_ladislav", isScheduleable: true, depots: ["depo_teplice"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-04" },
  { id: "u_tomas", name: "Tomáš Butkovsky", phone: "+420 777 301 201", role: "specialist", roleLabel: "Specialista", calendarMode: "short_long", login: "tomas", pass: "tomas123", token: "tok_tomas", isScheduleable: true, depots: ["depo_plzen"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-05" },
  { id: "u_daniela", name: "Daniela Lodlová", phone: "+420 777 301 202", role: "specialist", roleLabel: "Specialista", calendarMode: "mon_fri", login: "daniela", pass: "daniela123", token: "tok_daniela", isScheduleable: true, depots: ["depo_plzen", "depo_teplice"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-06" },
  { id: "u_daniel", name: "Daniel Doležal", phone: "+420 777 401 301", role: "warehouse", roleLabel: "Skladník", calendarMode: "short_long", login: "daniel", pass: "daniel123", token: "tok_daniel", isScheduleable: true, depots: ["depo_plzen"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-07" },
  { id: "u_adam", name: "Adam Doležal", phone: "+420 777 401 302", role: "warehouse", roleLabel: "Skladník", calendarMode: "short_long", login: "adam", pass: "adam123", token: "tok_adam", isScheduleable: true, depots: ["depo_plzen"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-08" },
  { id: "u_jan", name: "Jan Markovič", phone: "+420 777 401 303", role: "warehouse", roleLabel: "Skladník", calendarMode: "short_long", login: "jan", pass: "jan123", token: "tok_jan", isScheduleable: true, depots: ["depo_plzen"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-09" },
  { id: "u_josef", name: "Josef Karnold", phone: "+420 777 401 304", role: "warehouse", roleLabel: "Skladník", calendarMode: "short_long", login: "josef", pass: "josef123", token: "tok_josef", isScheduleable: true, depots: ["depo_teplice"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-10" },
  { id: "u_hossen", name: "Hossen Mohammad Arafat", phone: "+420 777 401 305", role: "warehouse", roleLabel: "Skladník", calendarMode: "short_long", login: "hossen", pass: "hossen123", token: "tok_hossen", isScheduleable: true, depots: ["depo_plzen"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-11" },
  { id: "u_hossain", name: "Hossain Mohammad Jabed", phone: "+420 777 401 306", role: "warehouse", roleLabel: "Skladník", calendarMode: "short_long", login: "hossain", pass: "hossain123", token: "tok_hossain", isScheduleable: true, depots: ["depo_plzen"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-12" },
  { id: "u_rahman", name: "Rahman Md Faisal", phone: "+420 777 401 307", role: "warehouse", roleLabel: "Skladník", calendarMode: "short_long", login: "rahman", pass: "rahman123", token: "tok_rahman", isScheduleable: true, depots: ["depo_teplice"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-13" },
  { id: "u_islam", name: "Islam Kazi Raihanul", phone: "+420 777 401 308", role: "warehouse", roleLabel: "Skladník", calendarMode: "short_long", login: "islam", pass: "islam123", token: "tok_islam", isScheduleable: true, depots: ["depo_teplice"], perms: { requestAg: false, approveRequests: false, editShifts: false }, terminatedFrom: null, createdAt: "2026-09-14" }
];

let appState = {
  version: APP_VERSION,
  depots: JSON.parse(JSON.stringify(DEFAULT_DEPOTS)),
  calendars: JSON.parse(JSON.stringify(DEFAULT_CALENDARS)),
  users: JSON.parse(JSON.stringify(DEFAULT_USERS)),
  shiftTimes: {
    D: { start: "03:00", end: "15:00" },
    N: { start: "18:30", end: "06:30" },
    AG: { start: "19:00", end: "07:00" }
  },
  schedules: {},
  agSlots: [],
  requests: [],
  chats: {},
  depotUserOrder: {},
  auditLog: []
};

let currentUser = null;
let firebaseAuthToken = null;
let anchorDate = new Date(2026, 10, 1);
let rosterViewMode = "month";
let activeDepotId = "depo_plzen";
let coordSelectedDepotId = "ALL";
let activeAdminTab = "schedule";
let settingsSubTab = "depots";
let activeCoordTab = "requests";
let showTerminatedWorkers = false;

let draftDepots = [];
let draftUsers = [];
let hasUnsavedAdminChanges = false;

let builderMonthDate = new Date(2026, 10, 1);
let builderPattern = {};
let builderSelectedShift = "D";

let terminatingUserIdx = null;
let selectedChatUserId = null;
let editingCell = null;
let empReqType = "DOV";
let empReqDates = [];
let dragPayload = null;
let rowDragUserId = null;

function canUserRequestAg(u = currentUser) {
  return !!u && (normalizeUserRole(u) === "admin" || !!u.perms?.requestAg);
}
function canUserApproveRequests(u = currentUser) {
  return !!u && (normalizeUserRole(u) === "admin" || !!u.perms?.approveRequests);
}
function canUserEditShifts(u = currentUser) {
  return !!u && (normalizeUserRole(u) === "admin" || !!u.perms?.editShifts);
}

// Save sanitized copy in localStorage so non-admin users never store peers' passwords in local cache
function persistSafeLocalCache() {
  const isAdmin = normalizeUserRole(currentUser) === "admin";
  const selfId = currentUser ? currentUser.id : null;
  const sanitized = {
    ...appState,
    users: (appState.users || []).map(u => {
      if (isAdmin || (selfId && u.id === selfId)) {
        return { ...u };
      }
      return { ...u, pass: "", token: "" };
    })
  };
  safeStorage.set("depotshift_cache", JSON.stringify(sanitized));
}

function getCalendarModeLabel(mode) {
  if (mode === "mon_fri") return currentLang === "en" ? "Monday – Friday" : "Pondělí – Pátek";
  if (mode === "short_long") return currentLang === "en" ? "Short / Long" : "Krátký / Dlouhý";
  const custom = (appState.calendars || []).find(c => c.id === mode || c.code === mode);
  if (custom) return custom.name;
  return currentLang === "en" ? "Short / Long" : "Krátký / Dlouhý";
}

function ensureMultiDepotConsistency() {
  if (!Array.isArray(appState.depots) || appState.depots.length === 0) {
    appState.depots = JSON.parse(JSON.stringify(DEFAULT_DEPOTS));
  }
  if (!Array.isArray(appState.calendars) || appState.calendars.length === 0) {
    appState.calendars = JSON.parse(JSON.stringify(DEFAULT_CALENDARS));
  }

  const fallbackD = appState.shiftTimes?.D || { start: "03:00", end: "15:00" };
  const fallbackN = appState.shiftTimes?.N || { start: "18:30", end: "06:30" };
  const fallbackAG = appState.shiftTimes?.AG || { start: "19:00", end: "07:00" };

  appState.depots.forEach(d => {
    if (!d.calendarMode) d.calendarMode = "short_long";
    if (d.hasDay === undefined) d.hasDay = true;
    if (!d.dayStart) d.dayStart = fallbackD.start;
    if (!d.dayEnd) d.dayEnd = fallbackD.end;
    if (d.hasNight === undefined) d.hasNight = true;
    if (!d.nightStart) d.nightStart = fallbackN.start;
    if (!d.nightEnd) d.nightEnd = fallbackN.end;
    if (!d.agStart) d.agStart = fallbackAG.start;
    if (!d.agEnd) d.agEnd = fallbackAG.end;
  });

  const defaultDepotId = appState.depots[0].id;
  if (!appState.depots.some(d => d.id === activeDepotId)) {
    activeDepotId = defaultDepotId;
  }

  appState.users.forEach((u, i) => {
    u.role = normalizeUserRole(u);
    if (!u.pass) {
      const def = DEFAULT_USERS.find(x => x.id === u.id);
      if (def) u.pass = def.pass;
    }
    if (!u.token) {
      const def = DEFAULT_USERS.find(x => x.id === u.id);
      u.token = def ? def.token : ("tok_" + u.id);
    }
    if (!Array.isArray(u.depots)) {
      const def = DEFAULT_USERS.find(x => x.id === u.id);
      u.depots = def ? [...def.depots] : [defaultDepotId];
    }
    if (!u.calendarMode) {
      const def = DEFAULT_USERS.find(x => x.id === u.id);
      u.calendarMode = def ? def.calendarMode : "short_long";
    }
    if (!u.perms || typeof u.perms !== "object") {
      u.perms = {
        requestAg: u.role === "admin",
        approveRequests: u.role === "admin",
        editShifts: u.role === "admin"
      };
    }
    if (u.phone === undefined) {
      const def = DEFAULT_USERS.find(x => x.id === u.id);
      u.phone = def ? def.phone : "";
    }
    if (u.terminatedFrom === undefined) u.terminatedFrom = null;
    if (!u.createdAt) {
      const def = DEFAULT_USERS.find(x => x.id === u.id);
      u.createdAt = def ? def.createdAt : `2026-09-${String(Math.min(28, i + 1)).padStart(2, "0")}`;
    }
  });

  if (!appState.depotUserOrder || typeof appState.depotUserOrder !== "object") {
    appState.depotUserOrder = {};
  }

  Object.keys(appState.schedules || {}).forEach(mKey => {
    const mObj = appState.schedules[mKey];
    if (!mObj || typeof mObj !== "object") return;
    const keys = Object.keys(mObj);
    const isLegacyUserMap = keys.some(k => k.startsWith("u_") || appState.users.some(u => u.id === k));
    if (isLegacyUserMap) {
      const migrated = {};
      appState.depots.forEach(d => { migrated[d.id] = {}; });
      keys.forEach(uid => { migrated[defaultDepotId][uid] = mObj[uid]; });
      appState.schedules[mKey] = migrated;
    }
  });

  appState.agSlots.forEach(s => {
    if (!s.depotId) s.depotId = defaultDepotId;
  });
}

function getDepotById(depotId = activeDepotId) {
  return appState.depots.find(x => x.id === depotId) || appState.depots[0];
}

function getDepotName(depotId) {
  const d = appState.depots.find(x => x.id === depotId);
  return d ? d.name : "Hlavní depo";
}

function getDepotScheduleMap(mKey, depotId = activeDepotId) {
  if (!appState.schedules[mKey]) appState.schedules[mKey] = {};
  if (!appState.schedules[mKey][depotId]) appState.schedules[mKey][depotId] = {};
  return appState.schedules[mKey][depotId];
}

function getMonthKey(dateObj = anchorDate) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getDaysInMonth(dateObj = anchorDate) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
}

function formatDateStr(y, mZeroIndexed, d) {
  return `${y}-${String(mZeroIndexed + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1, day: d, mKey: `${y}-${String(m).padStart(2, "0")}`, dateObj: new Date(y, m - 1, d) };
}

function calcDurationHours(startStr, endStr) {
  if (!startStr || !endStr) return 12;
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
}

function getShiftHours(entry, depotId = activeDepotId) {
  if (!entry || !entry.type) return 0;
  if (entry.start && entry.end) return calcDurationHours(entry.start, entry.end);
  const dep = getDepotById(entry.depotId || depotId);
  if (entry.type === "D") return calcDurationHours(dep.dayStart, dep.dayEnd);
  if (entry.type === "N") return calcDurationHours(dep.nightStart, dep.nightEnd);
  if (["DOV", "NV", "PN"].includes(entry.type)) return 12;
  return 0;
}

function addAudit(type, detail) {
  appState.auditLog.unshift({
    time: new Date().toLocaleString("cs-CZ"),
    actor: currentUser ? currentUser.name : "Systém",
    type,
    detail
  });
  if (appState.auditLog.length > 250) appState.auditLog.length = 250;
}

function showToast(msg, kind = "info") {
  const box = document.getElementById("toast-box");
  if (!box) return;
  const styles = {
    success: "bg-emerald-950/95 border-emerald-500 text-emerald-200",
    error: "bg-red-950/95 border-red-500 text-red-200",
    warn: "bg-amber-950/95 border-amber-500 text-amber-200",
    info: "bg-slate-900/95 border-blue-500 text-blue-200"
  };
  box.className = `fixed bottom-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl shadow-2xl text-xs font-bold border ${styles[kind] || styles.info}`;
  box.textContent = msg;
  box.classList.remove("hidden");
  clearTimeout(box._timer);
  box._timer = setTimeout(() => box.classList.add("hidden"), 3400);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove("hidden"); el.classList.add("flex"); }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add("hidden"); el.classList.remove("flex"); }
}
