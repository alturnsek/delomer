const authDiv = document.querySelector(".container");
const appLayout = document.getElementById("appLayout");
const sidebar = document.getElementById("sidebar");

const taskInput = document.getElementById("task");
const taskCount = document.getElementById("taskCount");

let editingWorkId = null;
let editingTeamId = null;
let currentUserId = null;
let currentUserRole = null;

let orgMembersCache = [];
let orgTeamsCache = [];
const selectedParticipants = new Map(); // userId -> minutesOverride|null

const SIDEBAR_STORAGE_KEY = "delomer_sidebar_open";

const STATUS_LABELS = {
  PENDING: "V obravnavi",
  APPROVED: "Potrjeno",
  REJECTED: "Zavrnjeno"
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

const ROLE_LABELS = {
  SUPER_ADMIN: "Super administrator",
  ADMIN: "Administrator",
  SUPERINTENDENT: "Nadzornik",
  MEMBER: "Član",
  PUBLIC: "Javni (kiosk)"
};

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

// slovensko sklanjanje: 1 član, 2 člana, 3-4 člani, sicer članov (11-14 vedno članov)
function memberCountLabel(n) {
  const mod100 = n % 100;
  const mod10 = n % 10;

  let word;
  if (mod100 >= 11 && mod100 <= 14) {
    word = "članov";
  } else if (mod10 === 1) {
    word = "član";
  } else if (mod10 === 2) {
    word = "člana";
  } else if (mod10 === 3 || mod10 === 4) {
    word = "člani";
  } else {
    word = "članov";
  }

  return `${n} ${word}`;
}

/* =========================
  IKONE ZA UREJANJE/BRISANJE (SVG namesto emoji - emoji ✏️/❌ sta pisano-barvna
  in ne prevzameta bele barve besedila na obarvanem gumbu, SVG s fill="currentColor" jo)
========================= */
const ICON_EDIT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
const ICON_DELETE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;

/* =========================
  STILIZIRAN POTRDITVENI POPUP (namesto brskalnikovega confirm())
========================= */
function showConfirmModal(message, onConfirm, confirmLabel) {
  const modal = document.getElementById("confirmModal");
  const yesBtn = document.getElementById("confirmYes");
  const noBtn = document.getElementById("confirmNo");
  if (!modal || !yesBtn || !noBtn) return;

  modal.querySelector("p").innerText = message;
  yesBtn.innerText = confirmLabel || "Izbriši";
  modal.classList.add("show");

  yesBtn.onclick = async () => {
    modal.classList.remove("show");
    await onConfirm();
  };

  noBtn.onclick = () => {
    modal.classList.remove("show");
  };
}

/* =========================
  NAČIN OBRAČUNAVANJA/PRIKAZA UR (nastavitev na nivoju društva)
========================= */
let orgHourSettings = { hour_rounding_minutes: 1, hour_display_format: "DECIMAL" };

async function loadOrgHourSettings() {
  try {
    const res = await fetch("/api/work/organization-settings", { credentials: "include" });
    if (res.ok) orgHourSettings = await res.json();
  } catch (err) {
    console.error("LOAD ORG HOUR SETTINGS ERROR:", err);
  }
}

function roundMinutes(minutes) {
  const step = orgHourSettings.hour_rounding_minutes || 1;
  return Math.round(minutes / step) * step;
}

// vrne besedilo ur glede na nastavitev društva (zaokroževanje + format prikaza)
function formatHours(minutes) {
  const rounded = roundMinutes(minutes);

  if (orgHourSettings.hour_display_format === "WHOLE") {
    return `${Math.round(rounded / 60)} h`;
  }

  if (orgHourSettings.hour_display_format === "DHM") {
    const days = Math.floor(rounded / (60 * 24));
    const hours = Math.floor((rounded % (60 * 24)) / 60);
    const mins = rounded % 60;

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (days || hours) parts.push(`${hours}h`);
    parts.push(`${mins}min`);

    return parts.join(" ");
  }

  return `${(rounded / 60).toFixed(1)} h`;
}

/* =========================
  VIEW ROUTING (sidebar meni)
========================= */
const VIEW_LOADERS = {
  work: () => { loadCategories(); loadParticipantOptions(); loadWork(); },
  members: () => loadOrgMembers(),
  categories: () => loadCategoriesAdmin(),
  teams: () => loadTeamsView(),
  "org-settings": () => loadOrgSettingsView(),
  approvals: () => loadAdminWork(),
  "org-stats": () => loadOrgStatsView(),
  organizations: () => { loadEmailModeSetting(); loadOrganizationsSuperadmin(); },
  "org-admins": () => loadOrgAdminsOrgOptions(),
  "platform-stats": () => loadPlatformStatsView(),
  profile: () => loadProfileView()
};

function showView(viewName) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.querySelectorAll(".nav-link").forEach(a => a.classList.remove("active"));

  const section = document.getElementById(`view-${viewName}`);
  const link = document.querySelector(`.nav-link[data-view="${viewName}"]`);

  if (section) section.classList.remove("hidden");
  if (link) link.classList.add("active");

  if (VIEW_LOADERS[viewName]) VIEW_LOADERS[viewName]();
}

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showView(link.dataset.view);
  });
});

/* =========================
  POD-ZAVIHKI (npr. Člani: Prikaz/Dodajanje, Ekipe: Ekipe/Dodajanje)
========================= */
document.querySelectorAll(".subtab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const parent = btn.closest(".view");
    if (!parent) return;

    parent.querySelectorAll(".subtab-btn").forEach(b => b.classList.remove("active"));
    parent.querySelectorAll(".subtab-panel").forEach(p => p.classList.add("hidden"));

    btn.classList.add("active");
    parent.querySelector(`.subtab-panel[data-subtab-panel="${btn.dataset.subtab}"]`)?.classList.remove("hidden");
  });
});

function isSidebarOpenPreferred() {
  const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
  return stored === null ? true : stored === "1";
}

function applySidebarState() {
  sidebar.classList.toggle("hidden", !isSidebarOpenPreferred());
}

document.getElementById("burgerBtn")?.addEventListener("click", () => {
  const nowOpen = sidebar.classList.contains("hidden");
  sidebar.classList.toggle("hidden", !nowOpen);
  localStorage.setItem(SIDEBAR_STORAGE_KEY, nowOpen ? "1" : "0");
});


/* =========================
  AUTH CHECK
========================= */
async function checkAuth() {
  try {
    const res = await fetch("/api/users/me", {
      credentials: "include"
    });

    const data = await res.json();

    const name = data.user?.first_name || "uporabnik";
    const org = data.user?.organization_name;
    document.getElementById("headerUser").innerText = org
      ? `Pozdravljen/a, ${name} (${org})`
      : `Pozdravljen/a, ${name}`;

    document.getElementById("start").value = getNowDateTime();
    document.getElementById("end").value = getNowDateTime();

    console.log("CHECK AUTH:", data);

    if (data.loggedIn && data.user) {
      authDiv.classList.add("hidden");
      appLayout.classList.remove("hidden");
      document.getElementById("burgerBtn").classList.remove("hidden");
      document.querySelector(".header-right").style.display = "flex";

      currentUserId = data.user.id;
      currentUserRole = data.user.role;

      if (currentUserRole !== "SUPER_ADMIN") loadOrgHourSettings();

      applySidebarState();

      let firstVisible = null;

      document.querySelectorAll(".nav-link").forEach(link => {
        const allowedRoles = link.dataset.roles.split(",");
        const visible = allowedRoles.includes(currentUserRole);

        link.classList.toggle("hidden", !visible);

        if (visible && !firstVisible) firstVisible = link.dataset.view;
      });

      if (firstVisible) showView(firstVisible);
    } else {
      authDiv.classList.remove("hidden");
      appLayout.classList.add("hidden");
      sidebar.classList.add("hidden");
      document.getElementById("burgerBtn").classList.add("hidden");
      document.querySelector(".header-right").style.display = "none";
    }

  } catch (err) {
    console.error("AUTH ERROR:", err);
  } finally {
    document.body.classList.remove("loading");
  }
}

checkAuth();


/* =========================
  LOGIN
========================= */


async function login(e) {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  const emailError = document.getElementById("loginEmailError");
  const passwordError = document.getElementById("loginPasswordError");
  const generalError = document.getElementById("loginGeneralError");


  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");

  emailInput.classList.remove("errorInput");
  passwordInput.classList.remove("errorInput");


  //reset errors
  emailError.innerText = "";
  passwordError.innerText = "";
  generalError.innerText = "";

  let hasError = false;

  if (!email) {
    emailError.innerText = "Vnesi email";
    emailInput.classList.add("errorInput");
    hasError = true;

  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailError.innerText = "Neveljaven email";
    emailInput.classList.add("errorInput");
    hasError = true;
  }

  if (!password) {
    passwordError.innerText = "Vnesi geslo";
    passwordInput.classList.add("errorInput");
    hasError = true;
  }

  if (hasError) return;


  const btn = document.getElementById("loginBtn");
  if (btn) btn.innerText = "Prijavljam...";

  const res = await fetch("/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password })
  });

  if (btn) btn.innerText = "Prijava";

  if (!res.ok) {
    generalError.innerText = "Napačen email ali geslo";

    emailInput.classList.add("errorInput");
    passwordInput.classList.add("errorInput");
  return;
  }

  location.reload();
}


/* =========================
  SUPER ADMIN - NASTAVITVE (način pošiljanja emailov)
========================= */
async function loadEmailModeSetting() {
  const select = document.getElementById("emailModeSelect");
  if (!select) return;

  const res = await fetch("/api/superadmin/settings", { credentials: "include" });
  if (!res.ok) return;

  const settings = await res.json();
  select.value = settings.email_mode || "log";
}

document.getElementById("emailModeSelect")?.addEventListener("change", async (e) => {
  const msg = document.getElementById("emailModeMsg");
  msg.innerText = "";

  const res = await fetch("/api/superadmin/settings/email-mode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email_mode: e.target.value })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
  }
});


/* =========================
  SUPER ADMIN - DRUŠTVA
========================= */
async function loadOrganizationsSuperadmin() {
  const list = document.getElementById("orgList");
  if (!list) return;

  const res = await fetch("/api/superadmin/organizations", { credentials: "include" });
  if (!res.ok) return;

  const orgs = await res.json();

  list.innerHTML = orgs.length
    ? orgs.map(renderOrganization).join("")
    : "<li>Ni še nobenega društva</li>";

  document.querySelectorAll(".editOrgBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(`orgEdit-${btn.dataset.id}`)?.classList.toggle("hidden");
    });
  });

  document.querySelectorAll(".cancelOrgEditBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(`orgEdit-${btn.dataset.id}`)?.classList.add("hidden");
    });
  });

  document.querySelectorAll(".saveOrgBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const panel = document.getElementById(`orgEdit-${id}`);
      const name = panel.querySelector(".editOrgName").value.trim();
      const msg = document.getElementById(`editOrgMsg-${id}`);

      msg.innerText = "";

      if (!name) {
        msg.innerText = "Vnesi ime društva";
        return;
      }

      const res = await fetch(`/api/superadmin/organizations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.innerText = data.message || "Napaka";
        return;
      }

      loadOrganizationsSuperadmin();
    });
  });
}

function renderOrganization(o) {
  return `
    <li class="org-item" data-id="${o.id}">
      <div class="member-row">
        <span>${o.name} — ${memberCountLabel(o.member_count)}</span>
        <button class="editOrgBtn icon-btn btn-edit" data-id="${o.id}">${ICON_EDIT}</button>
      </div>
      <div class="edit-panel hidden" id="orgEdit-${o.id}">
        <div class="field">
          <label>Ime društva</label>
          <input class="editOrgName" value="${o.name}">
        </div>
        <div id="editOrgMsg-${o.id}" class="error"></div>
        <div class="edit-actions">
          <button class="saveOrgBtn icon-btn btn-edit" data-id="${o.id}">Shrani</button>
          <button class="cancelOrgEditBtn secondary-btn" data-id="${o.id}">Prekliči</button>
        </div>
      </div>
    </li>
  `;
}

document.getElementById("createOrgBtn")?.addEventListener("click", async () => {
  const name = document.getElementById("newOrgName").value.trim();
  const admin_first_name = document.getElementById("newOrgAdminFirst").value.trim();
  const admin_last_name = document.getElementById("newOrgAdminLast").value.trim();
  const admin_email = document.getElementById("newOrgAdminEmail").value.trim();
  const msg = document.getElementById("createOrgMsg");

  msg.innerText = "";
  msg.style.color = "";

  if (!name || !admin_first_name || !admin_last_name || !admin_email) {
    msg.innerText = "Izpolni vsa polja";
    return;
  }

  const res = await fetch("/api/superadmin/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, admin_first_name, admin_last_name, admin_email })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    return;
  }

  msg.style.color = "#16a34a";
  msg.innerText = data.message;

  document.getElementById("newOrgName").value = "";
  document.getElementById("newOrgAdminFirst").value = "";
  document.getElementById("newOrgAdminLast").value = "";
  document.getElementById("newOrgAdminEmail").value = "";

  loadOrganizationsSuperadmin();
});


/* =========================
  SUPER ADMIN - ADMINI DRUŠTEV
========================= */
async function loadOrgAdminsOrgOptions() {
  const select = document.getElementById("orgAdminsSelect");
  if (!select) return;

  const res = await fetch("/api/superadmin/organizations", { credentials: "include" });
  if (!res.ok) return;

  const orgs = await res.json();

  select.innerHTML = orgs.length
    ? orgs.map(o => `<option value="${o.id}">${o.name}</option>`).join("")
    : `<option value="">Ni še nobenega društva</option>`;

  if (orgs.length) loadOrgAdminsUsers(select.value);
}

document.getElementById("orgAdminsSelect")?.addEventListener("change", (e) => {
  loadOrgAdminsUsers(e.target.value);
});

let orgAdminsMembersCache = [];
let currentOrgAdminsOrgId = null;

async function loadOrgAdminsUsers(organizationId) {
  if (currentOrgAdminsOrgId !== organizationId) bulkSelectedOrgAdminIds.clear();
  currentOrgAdminsOrgId = organizationId;

  const list = document.getElementById("orgAdminsList");
  if (!list || !organizationId) {
    if (list) list.innerHTML = "";
    return;
  }

  const res = await fetch(`/api/superadmin/organizations/${organizationId}/users`, { credentials: "include" });
  if (!res.ok) return;

  orgAdminsMembersCache = await res.json();
  renderOrgAdminsList();
}

function renderOrgAdminsList() {
  const list = document.getElementById("orgAdminsList");
  const organizationId = currentOrgAdminsOrgId;
  if (!list || !organizationId) return;

  const query = (document.getElementById("orgAdminsSearch")?.value || "").trim().toLowerCase();
  const statusFilters = Array.from(document.querySelectorAll("#orgAdminsStatusPanel input:checked")).map(cb => cb.value);
  const roleFilters = Array.from(document.querySelectorAll("#orgAdminsRolePanel input:checked")).map(cb => cb.value);
  const sortMode = document.getElementById("orgAdminsSort")?.value || "last_asc";

  let members = orgAdminsMembersCache.filter(m => {
    if (query && !m.first_name.toLowerCase().startsWith(query) && !m.last_name.toLowerCase().startsWith(query)) return false;

    if (statusFilters.length) {
      const buckets = [m.is_active ? "ACTIVE" : "INACTIVE"];
      if (!m.email) buckets.push("NO_EMAIL");
      else if (!m.activated) buckets.push("PENDING");
      if (!buckets.some(b => statusFilters.includes(b))) return false;
    }

    if (roleFilters.length && !roleFilters.includes(m.role)) return false;

    return true;
  });

  const [sortField, sortDir] = sortMode.split("_");
  const sortKey = sortField === "first" ? "first_name" : "last_name";

  members = [...members].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;

    const cmp = a[sortKey].localeCompare(b[sortKey], "sl");
    return sortDir === "asc" ? cmp : -cmp;
  });

  list.innerHTML = members.length
    ? members.map(m => renderRoleManagedMember(m, `/api/superadmin/organizations/${organizationId}/users`)).join("")
    : "<li>Ni članov, ki bi ustrezali filtru</li>";

  wireRoleSelects();

  document.querySelectorAll(".editRoleManagedBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(`roleManagedEdit-${btn.dataset.id}`)?.classList.toggle("hidden");
    });
  });

  document.querySelectorAll(".cancelRoleManagedEditBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(`roleManagedEdit-${btn.dataset.id}`)?.classList.add("hidden");
    });
  });

  document.querySelectorAll(".resendInviteRoleManagedBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const msg = document.getElementById(`roleManagedMsg-${id}`);

      const res = await fetch(`${btn.dataset.orgEndpoint}/${id}/resend-invite`, {
        method: "POST",
        credentials: "include"
      });

      const data = await res.json();
      msg.innerText = data.message || "";
      msg.style.color = res.ok ? "#16a34a" : "";
    });
  });

  document.querySelectorAll(".saveRoleManagedBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const panel = document.getElementById(`roleManagedEdit-${id}`);
      const first_name = panel.querySelector(".editFirstName").value.trim();
      const last_name = panel.querySelector(".editLastName").value.trim();
      const email = panel.querySelector(".editEmail").value.trim();
      const msg = document.getElementById(`roleManagedMsg-${id}`);

      msg.innerText = "";
      msg.style.color = "";

      if (!first_name || !last_name) {
        msg.innerText = "Izpolni ime in priimek";
        return;
      }

      const res = await fetch(`${btn.dataset.orgEndpoint}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ first_name, last_name, email })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.innerText = data.message || "Napaka";
        return;
      }

      loadOrgAdminsUsers(organizationId);
    });
  });

  document.querySelectorAll(".deleteRoleManagedBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;

      showConfirmModal(
        "Izbrišeš uporabnika? Če ima že vneseno delo, bo namesto izbrisa anonimiziran (ure ostanejo).",
        async () => {
          const res = await fetch(`${btn.dataset.orgEndpoint}/${id}`, {
            method: "DELETE",
            credentials: "include"
          });

          const data = await res.json();

          if (!res.ok) {
            alert(data.message || "Napaka pri izbrisu");
            return;
          }

          bulkSelectedOrgAdminIds.delete(Number(id));
          loadOrgAdminsUsers(organizationId);
        }
      );
    });
  });

  document.querySelectorAll(".bulkSelectCheckbox").forEach(cb => {
    cb.addEventListener("change", () => {
      const id = Number(cb.dataset.id);
      if (cb.checked) bulkSelectedOrgAdminIds.add(id); else bulkSelectedOrgAdminIds.delete(id);
    });
  });

  const selectAllBox = document.getElementById("orgAdminsSelectAll");
  if (selectAllBox) selectAllBox.checked = false;
}

let bulkSelectedOrgAdminIds = new Set();

document.getElementById("orgAdminsSelectAll")?.addEventListener("change", (e) => {
  document.querySelectorAll(".bulkSelectCheckbox").forEach(cb => {
    cb.checked = e.target.checked;
    const id = Number(cb.dataset.id);
    if (e.target.checked) bulkSelectedOrgAdminIds.add(id); else bulkSelectedOrgAdminIds.delete(id);
  });
});

document.getElementById("orgAdminsBulkRoleBtn")?.addEventListener("click", async () => {
  const role = document.getElementById("orgAdminsBulkRole").value;
  const msg = document.getElementById("orgAdminsBulkMsg");
  const ids = Array.from(bulkSelectedOrgAdminIds);

  msg.innerText = "";
  msg.style.color = "";

  if (!ids.length) {
    msg.innerText = "Izberi vsaj enega člana";
    return;
  }

  const res = await fetch(`/api/superadmin/organizations/${currentOrgAdminsOrgId}/users/bulk-role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ user_ids: ids, role })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    return;
  }

  const okCount = data.results.filter(r => r.ok).length;
  msg.style.color = "#16a34a";
  msg.innerText = `Vloga posodobljena za ${okCount}/${data.results.length}`;

  bulkSelectedOrgAdminIds.clear();
  loadOrgAdminsUsers(currentOrgAdminsOrgId);
});

document.getElementById("orgAdminsBulkDeleteBtn")?.addEventListener("click", async () => {
  const msg = document.getElementById("orgAdminsBulkMsg");
  const ids = Array.from(bulkSelectedOrgAdminIds);

  msg.innerText = "";
  msg.style.color = "";

  if (!ids.length) {
    msg.innerText = "Izberi vsaj enega člana";
    return;
  }

  showConfirmModal(
    `Izbrišeš ${ids.length} izbranih uporabnikov? Tisti z že vnesenim delom bodo namesto izbrisa anonimizirani.`,
    async () => {
      const res = await fetch(`/api/superadmin/organizations/${currentOrgAdminsOrgId}/users/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_ids: ids })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.innerText = data.message || "Napaka";
        return;
      }

      const okCount = data.results.filter(r => r.ok).length;
      msg.style.color = "#16a34a";
      msg.innerText = `Izbrisanih: ${okCount}/${data.results.length}`;

      bulkSelectedOrgAdminIds.clear();
      loadOrgAdminsUsers(currentOrgAdminsOrgId);
    }
  );
});

document.getElementById("orgAdminsSearch")?.addEventListener("input", renderOrgAdminsList);
setupDropdownCheckFilter("orgAdminsStatusBtn", "orgAdminsStatusPanel", "Status", renderOrgAdminsList);
setupDropdownCheckFilter("orgAdminsRoleBtn", "orgAdminsRolePanel", "Vloga", renderOrgAdminsList);
document.getElementById("orgAdminsSort")?.addEventListener("change", renderOrgAdminsList);

function renderRoleManagedMember(m, roleEndpointBase) {
  if (m.is_deleted) {
    return `
      <li class="member-item member-inactive" data-id="${m.id}">
        <div class="member-row">
          <span>Izbrisan uporabnik</span>
          <span class="status-badge">${roleLabel(m.role)}</span>
        </div>
      </li>
    `;
  }

  const inactiveNote = m.is_active ? "" : " (deaktiviran)";
  const emailNote = m.email ? ` — ${m.email}` : " — brez emaila";
  const statusNote = m.activated ? "" : (m.email ? " (čaka aktivacijo)" : " (ni registriran)");

  return `
    <li class="member-item${m.is_active ? "" : " member-inactive"}" data-id="${m.id}">
      <div class="member-row">
        <input type="checkbox" class="bulkSelectCheckbox" data-id="${m.id}" ${bulkSelectedOrgAdminIds.has(m.id) ? "checked" : ""}>
        <span>${m.first_name} ${m.last_name}${emailNote}${statusNote}${inactiveNote}</span>
        <div class="actions">
          <select class="roleSelect" data-id="${m.id}" data-endpoint="${roleEndpointBase}">
            <option value="MEMBER" ${m.role === "MEMBER" ? "selected" : ""}>${roleLabel("MEMBER")}</option>
            <option value="SUPERINTENDENT" ${m.role === "SUPERINTENDENT" ? "selected" : ""}>${roleLabel("SUPERINTENDENT")}</option>
            <option value="ADMIN" ${m.role === "ADMIN" ? "selected" : ""}>${roleLabel("ADMIN")}</option>
            <option value="PUBLIC" ${m.role === "PUBLIC" ? "selected" : ""}>${roleLabel("PUBLIC")}</option>
          </select>
          <button class="editRoleManagedBtn icon-btn btn-edit" data-id="${m.id}">${ICON_EDIT}</button>
        </div>
      </div>
      <div class="edit-panel hidden" id="roleManagedEdit-${m.id}">
        <div class="field">
          <label>Ime</label>
          <input class="editFirstName" value="${m.first_name}">
        </div>
        <div class="field">
          <label>Priimek</label>
          <input class="editLastName" value="${m.last_name}">
        </div>
        <div class="field">
          <label>Email</label>
          <input class="editEmail" value="${m.email || ""}" type="email">
        </div>
        <div id="roleManagedMsg-${m.id}" class="error"></div>
        <div class="edit-actions">
          <button class="saveRoleManagedBtn icon-btn btn-edit" data-id="${m.id}" data-org-endpoint="${roleEndpointBase}">Shrani</button>
          ${(!m.activated && m.email) ? `<button class="resendInviteRoleManagedBtn icon-btn btn-edit" data-id="${m.id}" data-org-endpoint="${roleEndpointBase}">Ponovno pošlji vabilo</button>` : ""}
          <button class="deleteRoleManagedBtn icon-btn btn-reject" data-id="${m.id}" data-org-endpoint="${roleEndpointBase}">Izbriši</button>
          <button class="cancelRoleManagedEditBtn secondary-btn" data-id="${m.id}">Prekliči</button>
        </div>
      </div>
    </li>
  `;
}

function wireRoleSelects() {
  document.querySelectorAll(".roleSelect").forEach(select => {
    select.addEventListener("change", async () => {
      const id = select.dataset.id;
      const endpoint = select.dataset.endpoint;

      const res = await fetch(`${endpoint}/${id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: select.value })
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Napaka pri spremembi vloge");
      }
    });
  });
}


/* =========================
  ADMIN - ČLANI DRUŠTVA (+ filtri/iskanje/sort)
========================= */
let adminMembersCache = [];

async function loadOrgMembers() {
  const list = document.getElementById("orgMembersList");
  if (!list) return;

  const res = await fetch("/api/admin/users", { credentials: "include" });
  if (!res.ok) return;

  adminMembersCache = await res.json();
  renderOrgMembersList();
}

function renderOrgMembersList() {
  const list = document.getElementById("orgMembersList");
  if (!list) return;

  const query = (document.getElementById("membersSearch")?.value || "").trim().toLowerCase();
  const statusFilters = Array.from(document.querySelectorAll("#membersStatusPanel input:checked")).map(cb => cb.value);
  const roleFilters = Array.from(document.querySelectorAll("#membersRolePanel input:checked")).map(cb => cb.value);
  const sortMode = document.getElementById("membersSort")?.value || "last_asc";

  let members = adminMembersCache.filter(m => {
    if (query && !m.first_name.toLowerCase().startsWith(query) && !m.last_name.toLowerCase().startsWith(query)) return false;

    if (statusFilters.length) {
      const buckets = [m.is_active ? "ACTIVE" : "INACTIVE"];
      if (!m.email) buckets.push("NO_EMAIL");
      else if (!m.activated) buckets.push("PENDING");
      if (!buckets.some(b => statusFilters.includes(b))) return false;
    }

    if (roleFilters.length && !roleFilters.includes(m.role)) return false;

    return true;
  });

  const [sortField, sortDir] = sortMode.split("_");
  const sortKey = sortField === "first" ? "first_name" : "last_name";

  members = [...members].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1; // neaktivni vedno na dno

    const cmp = a[sortKey].localeCompare(b[sortKey], "sl");
    return sortDir === "asc" ? cmp : -cmp;
  });

  list.innerHTML = members.length
    ? members.map(renderOrgMember).join("")
    : "<li>Ni članov, ki bi ustrezali filtru</li>";

  wireRoleSelects();

  document.getElementById("addMembersSubtabBtn")?.classList.toggle("hidden", currentUserRole !== "ADMIN");

  document.querySelectorAll(".member-name-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openMemberDetail(link.dataset.id);
    });
  });

  document.querySelectorAll(".editMemberBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(`memberEdit-${btn.dataset.id}`)?.classList.toggle("hidden");
    });
  });

  document.querySelectorAll(".cancelMemberEditBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(`memberEdit-${btn.dataset.id}`)?.classList.add("hidden");
    });
  });

  document.querySelectorAll(".deactivateMemberBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetch(`/api/admin/users/${btn.dataset.id}/deactivate`, {
        method: "POST",
        credentials: "include"
      });

      loadOrgMembers();
    });
  });

  document.querySelectorAll(".resendInviteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const msg = document.getElementById(`editMemberMsg-${id}`);

      const res = await fetch(`/api/admin/users/${id}/resend-invite`, {
        method: "POST",
        credentials: "include"
      });

      const data = await res.json();
      msg.innerText = data.message || "";
      msg.style.color = res.ok ? "#16a34a" : "";
    });
  });

  document.querySelectorAll(".activateMemberBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetch(`/api/admin/users/${btn.dataset.id}/activate`, {
        method: "POST",
        credentials: "include"
      });

      loadOrgMembers();
    });
  });

  document.querySelectorAll(".saveMemberBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const panel = document.getElementById(`memberEdit-${id}`);
      const first_name = panel.querySelector(".editFirstName").value.trim();
      const last_name = panel.querySelector(".editLastName").value.trim();
      const email = panel.querySelector(".editEmail").value.trim();
      const msg = document.getElementById(`editMemberMsg-${id}`);

      msg.innerText = "";

      if (!first_name || !last_name) {
        msg.innerText = "Izpolni ime in priimek";
        return;
      }

      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ first_name, last_name, email })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.innerText = data.message || "Napaka";
        return;
      }

      loadOrgMembers();
    });
  });
}

document.getElementById("membersSearch")?.addEventListener("input", renderOrgMembersList);
setupDropdownCheckFilter("membersStatusBtn", "membersStatusPanel", "Status", renderOrgMembersList);
setupDropdownCheckFilter("membersRoleBtn", "membersRolePanel", "Vloga", renderOrgMembersList);
document.getElementById("membersSort")?.addEventListener("change", renderOrgMembersList);

function renderOrgMember(m) {
  const isSelf = m.id === currentUserId;
  const canManage = currentUserRole === "ADMIN";
  const nameHtml = `<a href="#" class="member-name-link" data-id="${m.id}">${m.first_name} ${m.last_name}</a>`;
  const inactiveNote = m.is_active ? "" : " (deaktiviran)";
  const emailNote = m.email ? ` — ${m.email}` : " — brez emaila";
  const statusNote = m.activated ? "" : (m.email ? " (čaka aktivacijo)" : " (ni registriran)");

  return `
    <li class="member-item${m.is_active ? "" : " member-inactive"}" data-id="${m.id}">
      <div class="member-row">
        <span>${nameHtml}${emailNote}${statusNote}${inactiveNote}</span>
        <div class="actions">
          <span class="status-badge">${roleLabel(m.role)}</span>
          ${canManage ? `<button class="editMemberBtn icon-btn btn-edit" data-id="${m.id}">${ICON_EDIT}</button>` : ""}
        </div>
      </div>
      ${canManage ? `
      <div class="edit-panel hidden" id="memberEdit-${m.id}">
        <div class="field">
          <label>Ime</label>
          <input class="editFirstName" value="${m.first_name}">
        </div>
        <div class="field">
          <label>Priimek</label>
          <input class="editLastName" value="${m.last_name}">
        </div>
        <div class="field">
          <label>Email</label>
          <input class="editEmail" value="${m.email || ""}" type="email">
        </div>
        ${!isSelf ? `
        <div class="field">
          <label>Vloga</label>
          <select class="roleSelect" data-id="${m.id}" data-endpoint="/api/admin/users">
            <option value="MEMBER" ${m.role === "MEMBER" ? "selected" : ""}>${roleLabel("MEMBER")}</option>
            <option value="SUPERINTENDENT" ${m.role === "SUPERINTENDENT" ? "selected" : ""}>${roleLabel("SUPERINTENDENT")}</option>
            <option value="ADMIN" ${m.role === "ADMIN" ? "selected" : ""}>${roleLabel("ADMIN")}</option>
            <option value="PUBLIC" ${m.role === "PUBLIC" ? "selected" : ""}>${roleLabel("PUBLIC")}</option>
          </select>
        </div>
        ` : ""}
        <div id="editMemberMsg-${m.id}" class="error"></div>
        <div class="edit-actions">
          <button class="saveMemberBtn icon-btn btn-edit" data-id="${m.id}">Shrani</button>
          ${(!m.activated && m.email) ? `<button class="resendInviteBtn icon-btn btn-edit" data-id="${m.id}">Ponovno pošlji vabilo</button>` : ""}
          ${!isSelf ? (m.is_active
            ? `<button class="deactivateMemberBtn icon-btn btn-reject" data-id="${m.id}">Deaktiviraj</button>`
            : `<button class="activateMemberBtn icon-btn btn-approve" data-id="${m.id}">Aktiviraj</button>`
          ) : ""}
          <button class="cancelMemberEditBtn secondary-btn" data-id="${m.id}">Prekliči</button>
        </div>
      </div>
      ` : ""}
    </li>
  `;
}

document.getElementById("inviteUserBtn")?.addEventListener("click", async () => {
  const first_name = document.getElementById("inviteFirst").value.trim();
  const last_name = document.getElementById("inviteLast").value.trim();
  const email = document.getElementById("inviteEmail").value.trim();
  const role = document.getElementById("invitePublicKiosk")?.checked ? "PUBLIC" : "MEMBER";
  const msg = document.getElementById("inviteMsg");

  msg.innerText = "";
  msg.style.color = "";

  if (!first_name || !last_name || !email) {
    msg.innerText = "Izpolni vsa polja";
    return;
  }

  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ first_name, last_name, email, role })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    return;
  }

  msg.style.color = "#16a34a";
  msg.innerText = data.message;

  document.getElementById("inviteFirst").value = "";
  document.getElementById("inviteLast").value = "";
  document.getElementById("inviteEmail").value = "";
  if (document.getElementById("invitePublicKiosk")) document.getElementById("invitePublicKiosk").checked = false;

  loadOrgMembers();
});

document.getElementById("rosterAddBtn")?.addEventListener("click", async () => {
  const raw = document.getElementById("rosterAddText").value.trim();
  const msg = document.getElementById("rosterAddMsg");

  msg.innerText = "";
  msg.style.color = "";

  if (!raw) {
    msg.innerText = "Vnesi vsaj eno osebo";
    return;
  }

  const entries = raw.split("\n")
    .map(line => {
      const [first_name, last_name] = line.split(",").map(v => (v || "").trim());
      return { first_name, last_name };
    })
    .filter(e => e.first_name && e.last_name);

  if (!entries.length) {
    msg.innerText = "Vsaka vrstica naj vsebuje ime in priimek";
    return;
  }

  const res = await fetch("/api/admin/users/roster", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ entries })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    return;
  }

  const okCount = data.results.filter(r => r.ok).length;
  const failed = data.results.filter(r => !r.ok);

  msg.style.color = failed.length ? "" : "#16a34a";
  msg.innerText = `Dodanih: ${okCount}/${data.results.length}` +
    (failed.length ? ` — napake: ${failed.map(f => `${f.first_name} ${f.last_name} (${f.message})`).join(", ")}` : "");

  document.getElementById("rosterAddText").value = "";

  loadOrgMembers();
});

document.getElementById("bulkInviteBtn")?.addEventListener("click", async () => {
  const raw = document.getElementById("bulkInviteText").value.trim();
  const msg = document.getElementById("bulkInviteMsg");

  msg.innerText = "";
  msg.style.color = "";

  if (!raw) {
    msg.innerText = "Vnesi vsaj eno osebo";
    return;
  }

  const users = raw.split("\n")
    .map(line => {
      const [first_name, last_name, email] = line.split(",").map(v => (v || "").trim());
      return { first_name, last_name, email };
    })
    .filter(u => u.email);

  const res = await fetch("/api/admin/users/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ users })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    return;
  }

  const okCount = data.results.filter(r => r.ok).length;
  const failed = data.results.filter(r => !r.ok);

  msg.style.color = failed.length ? "" : "#16a34a";
  msg.innerText = `Povabljenih: ${okCount}/${data.results.length}` +
    (failed.length ? ` — napake: ${failed.map(f => `${f.email} (${f.message})`).join(", ")}` : "");

  document.getElementById("bulkInviteText").value = "";

  loadOrgMembers();
});


/* =========================
  KATEGORIJE DELA (dropdown ob vnosu dela - samo aktivne)
========================= */
async function loadCategories() {
  const res = await fetch("/api/work/categories", { credentials: "include" });
  if (!res.ok) return;

  const categories = await res.json();

  const select = document.getElementById("workCategory");
  if (select) {
    select.innerHTML = `<option value="">Brez kategorije</option>` +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  }
}

/* =========================
  KATEGORIJE DELA (upravljanje - vse, tudi neaktivne)
========================= */
async function loadCategoriesAdmin() {
  const list = document.getElementById("categoryList");
  if (!list) return;

  const res = await fetch("/api/admin/categories", { credentials: "include" });
  if (!res.ok) return;

  const categories = await res.json();

  list.innerHTML = categories.length
    ? categories.map(c => `
        <li class="category-item" data-id="${c.id}">
          <div class="member-row">
            <span>${c.name} ${c.is_active ? "" : '<span class="status-badge status-REJECTED">neaktivna</span>'}</span>
            <div class="actions">
              <button class="editCategoryBtn icon-btn btn-edit" data-id="${c.id}">${ICON_EDIT}</button>
              ${c.is_active
                ? `<button class="deactivateCategoryBtn" data-id="${c.id}">Deaktiviraj</button>`
                : `<button class="activateCategoryBtn" data-id="${c.id}">Aktiviraj</button>`}
            </div>
          </div>
          <div class="edit-panel hidden" id="categoryEdit-${c.id}">
            <div class="field">
              <label>Ime kategorije</label>
              <input class="editCategoryName" value="${c.name}">
            </div>
            <div id="editCategoryMsg-${c.id}" class="error"></div>
            <div class="edit-actions">
              <button class="saveCategoryBtn icon-btn btn-edit" data-id="${c.id}">Shrani</button>
              <button class="cancelCategoryEditBtn secondary-btn" data-id="${c.id}">Prekliči</button>
            </div>
          </div>
        </li>
      `).join("")
    : "<li>Ni še kategorij</li>";

  list.querySelectorAll(".editCategoryBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(`categoryEdit-${btn.dataset.id}`)?.classList.toggle("hidden");
    });
  });

  list.querySelectorAll(".cancelCategoryEditBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(`categoryEdit-${btn.dataset.id}`)?.classList.add("hidden");
    });
  });

  list.querySelectorAll(".saveCategoryBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const panel = document.getElementById(`categoryEdit-${id}`);
      const newName = panel.querySelector(".editCategoryName").value.trim();
      const msg = document.getElementById(`editCategoryMsg-${id}`);

      msg.innerText = "";

      if (!newName) {
        msg.innerText = "Vnesi ime kategorije";
        return;
      }

      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.innerText = data.message || "Napaka";
        return;
      }

      loadCategoriesAdmin();
      loadCategories();
    });
  });

  list.querySelectorAll(".deactivateCategoryBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetch(`/api/admin/categories/${btn.dataset.id}/deactivate`, {
        method: "POST",
        credentials: "include"
      });

      loadCategoriesAdmin();
      loadCategories();
    });
  });

  list.querySelectorAll(".activateCategoryBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetch(`/api/admin/categories/${btn.dataset.id}/activate`, {
        method: "POST",
        credentials: "include"
      });

      loadCategoriesAdmin();
      loadCategories();
    });
  });
}

document.getElementById("addCategoryBtn")?.addEventListener("click", async () => {
  const input = document.getElementById("newCategoryName");
  const msg = document.getElementById("categoryMsg");
  const name = input.value.trim();

  msg.innerText = "";

  if (!name) {
    msg.innerText = "Vnesi ime kategorije";
    return;
  }

  const res = await fetch("/api/admin/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    return;
  }

  input.value = "";
  loadCategoriesAdmin();
});


/* =========================
  EKIPE
========================= */
async function loadTeamsView() {
  await loadTeamMemberCheckboxes();
  await loadTeamList();
}

let teamMembersCache = [];
let teamSelectedMemberIds = new Set();

async function loadTeamMemberCheckboxes() {
  const container = document.getElementById("teamMemberCheckboxes");
  if (!container) return;

  const res = await fetch("/api/work/organization-members", { credentials: "include" });
  if (!res.ok) return;

  teamMembersCache = await res.json();
  renderTeamMemberCheckboxes();
}

function renderTeamMemberCheckboxes() {
  const container = document.getElementById("teamMemberCheckboxes");
  if (!container) return;

  const query = (document.getElementById("teamMemberSearch")?.value || "").trim().toLowerCase();
  const sortMode = document.getElementById("teamMemberSort")?.value || "first_asc";

  let members = teamMembersCache.filter(m => {
    if (!query) return true;
    return m.first_name.toLowerCase().startsWith(query) || m.last_name.toLowerCase().startsWith(query);
  });

  const [sortField, sortDir] = sortMode.split("_");
  const sortKey = sortField === "first" ? "first_name" : "last_name";

  members = [...members].sort((a, b) => {
    const cmp = a[sortKey].localeCompare(b[sortKey], "sl");
    return sortDir === "asc" ? cmp : -cmp;
  });

  container.innerHTML = members.length
    ? members.map(m => `
        <label>
          <input type="checkbox" class="teamMemberCheckbox" value="${m.id}" ${teamSelectedMemberIds.has(m.id) ? "checked" : ""}>
          ${m.first_name} ${m.last_name}
        </label>
      `).join("")
    : "<span>Ni ujemajočih se članov</span>";

  container.querySelectorAll(".teamMemberCheckbox").forEach(cb => {
    cb.addEventListener("change", () => {
      const id = Number(cb.value);
      if (cb.checked) teamSelectedMemberIds.add(id);
      else teamSelectedMemberIds.delete(id);
    });
  });
}

document.getElementById("teamMemberSearch")?.addEventListener("input", renderTeamMemberCheckboxes);
document.getElementById("teamMemberSort")?.addEventListener("change", renderTeamMemberCheckboxes);

async function loadTeamList() {
  const list = document.getElementById("teamList");
  if (!list) return;

  const res = await fetch("/api/admin/teams", { credentials: "include" });
  if (!res.ok) return;

  const teams = await res.json();

  list.innerHTML = teams.length
    ? teams.map(t => `
        <li>
          <span>${t.name} (${memberCountLabel(t.member_ids.length)})</span>
          <div class="actions">
            <button class="editTeamBtn icon-btn btn-edit" data-id="${t.id}">${ICON_EDIT}</button>
            <button class="deleteTeamBtn icon-btn btn-reject" data-id="${t.id}">${ICON_DELETE}</button>
          </div>
        </li>
      `).join("")
    : "<li>Ni še ekip</li>";

  list.querySelectorAll(".editTeamBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const team = teams.find(t => t.id == btn.dataset.id);
      if (!team) return;

      editingTeamId = team.id;
      document.getElementById("teamName").value = team.name;

      teamSelectedMemberIds = new Set(team.member_ids);
      renderTeamMemberCheckboxes();

      document.getElementById("saveTeamBtn").innerText = "Posodobi ekipo";
      document.getElementById("cancelTeamEditBtn").classList.remove("hidden");

      list.closest(".view")?.querySelector('.subtab-btn[data-subtab="add"]')?.click();
    });
  });

  list.querySelectorAll(".deleteTeamBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      showConfirmModal("Izbriši to ekipo?", async () => {
        await fetch(`/api/admin/teams/${btn.dataset.id}`, {
          method: "DELETE",
          credentials: "include"
        });

        loadTeamList();
      });
    });
  });
}

document.getElementById("saveTeamBtn")?.addEventListener("click", async () => {
  const name = document.getElementById("teamName").value.trim();
  const msg = document.getElementById("teamMsg");

  msg.innerText = "";

  if (!name) {
    msg.innerText = "Vnesi ime ekipe";
    return;
  }

  const member_ids = Array.from(teamSelectedMemberIds);

  const url = editingTeamId ? `/api/admin/teams/${editingTeamId}` : "/api/admin/teams";
  const method = editingTeamId ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, member_ids })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    return;
  }

  resetTeamForm();
  loadTeamList();
});

document.getElementById("cancelTeamEditBtn")?.addEventListener("click", resetTeamForm);

function resetTeamForm() {
  editingTeamId = null;

  document.getElementById("teamName").value = "";
  teamSelectedMemberIds.clear();
  renderTeamMemberCheckboxes();
  document.getElementById("saveTeamBtn").innerText = "Ustvari ekipo";
  document.getElementById("cancelTeamEditBtn").classList.add("hidden");
  document.getElementById("teamMsg").innerText = "";
}


/* =========================
  NASTAVITVE DRUŠTVA (logotip, ime, opis, funkcionarji) - ADMIN
========================= */
async function loadOrgSettingsView() {
  const res = await fetch("/api/admin/organization", { credentials: "include" });

  if (res.ok) {
    const org = await res.json();

    document.getElementById("orgSettingsName").value = org.name || "";
    document.getElementById("orgSettingsDescription").value = org.description || "";
    document.getElementById("orgLogoImg").src = org.logo_path || "logo.png";
    document.getElementById("orgHourRounding").value = org.hour_rounding_minutes || 1;
    document.getElementById("orgHourDisplayFormat").value = org.hour_display_format || "DECIMAL";

    currentOrgSettings = org;
    document.getElementById("joinCodeUrl").value = `${window.location.origin}/join.html?code=${org.join_code || ""}`;
    document.getElementById("registrationEnabledToggle").checked = !!org.registration_enabled;
  }

  loadOfficials();
}

let currentOrgSettings = {};

document.getElementById("copyJoinCodeBtn")?.addEventListener("click", async () => {
  const input = document.getElementById("joinCodeUrl");
  const msg = document.getElementById("joinCodeMsg");

  try {
    await navigator.clipboard.writeText(input.value);
    msg.style.color = "#16a34a";
    msg.innerText = "Povezava kopirana";
  } catch (err) {
    input.select();
    msg.innerText = "Kopiraj ročno (Ctrl+C)";
  }
});

document.getElementById("registrationEnabledToggle")?.addEventListener("change", async (e) => {
  const msg = document.getElementById("joinCodeMsg");
  msg.innerText = "";
  msg.style.color = "";

  const res = await fetch("/api/admin/organization", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name: currentOrgSettings.name,
      description: currentOrgSettings.description,
      hour_rounding_minutes: currentOrgSettings.hour_rounding_minutes,
      hour_display_format: currentOrgSettings.hour_display_format,
      registration_enabled: e.target.checked
    })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    e.target.checked = !e.target.checked;
    return;
  }

  currentOrgSettings.registration_enabled = e.target.checked ? 1 : 0;
});

document.getElementById("regenerateJoinCodeBtn")?.addEventListener("click", () => {
  const msg = document.getElementById("joinCodeMsg");
  msg.innerText = "";
  msg.style.color = "";

  showConfirmModal(
    "Stara registracijska povezava bo prenehala delovati. Nadaljuješ?",
    async () => {
      const res = await fetch("/api/admin/organization/join-code/regenerate", {
        method: "POST",
        credentials: "include"
      });

      const data = await res.json();

      if (!res.ok) {
        msg.innerText = data.message || "Napaka";
        return;
      }

      currentOrgSettings.join_code = data.join_code;
      document.getElementById("joinCodeUrl").value = `${window.location.origin}/join.html?code=${data.join_code}`;
      msg.style.color = "#16a34a";
      msg.innerText = "Nova povezava ustvarjena";
    },
    "Ustvari novo"
  );
});

document.getElementById("saveOrgSettingsBtn")?.addEventListener("click", async () => {
  const name = document.getElementById("orgSettingsName").value.trim();
  const description = document.getElementById("orgSettingsDescription").value.trim();
  const hour_rounding_minutes = Number(document.getElementById("orgHourRounding").value) || 1;
  const hour_display_format = document.getElementById("orgHourDisplayFormat").value;
  const msg = document.getElementById("orgSettingsMsg");

  msg.innerText = "";
  msg.style.color = "";

  if (!name) {
    msg.innerText = "Vnesi ime društva";
    return;
  }

  const registration_enabled = document.getElementById("registrationEnabledToggle")?.checked ?? true;

  const res = await fetch("/api/admin/organization", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, description, hour_rounding_minutes, hour_display_format, registration_enabled })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    return;
  }

  msg.style.color = "#16a34a";
  msg.innerText = data.message;
  currentOrgSettings.name = name;
  currentOrgSettings.description = description;
  currentOrgSettings.hour_rounding_minutes = hour_rounding_minutes;
  currentOrgSettings.hour_display_format = hour_display_format;

  loadOrgHourSettings();
});

document.getElementById("orgLogoInput")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const msg = document.getElementById("orgLogoMsg");

  msg.innerText = "";

  if (!file) return;

  const formData = new FormData();
  formData.append("logo", file);

  const res = await fetch("/api/admin/organization/logo", {
    method: "POST",
    credentials: "include",
    body: formData
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka pri nalaganju logotipa";
    return;
  }

  document.getElementById("orgLogoImg").src = data.logo_path;
});


/* =========================
  FUNKCIONARJI DRUŠTVA
========================= */
let editingOfficialId = null;

async function loadOfficials() {
  const list = document.getElementById("officialsList");
  if (!list) return;

  const res = await fetch("/api/admin/officials", { credentials: "include" });
  if (!res.ok) return;

  const officials = await res.json();

  list.innerHTML = officials.length
    ? officials.map(renderOfficial).join("")
    : "<li>Ni še funkcionarjev</li>";

  document.querySelectorAll(".editOfficialBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const official = officials.find(o => o.id == btn.dataset.id);
      if (!official) return;

      editingOfficialId = official.id;

      document.getElementById("officialFirstName").value = official.first_name;
      document.getElementById("officialLastName").value = official.last_name;
      document.getElementById("officialTitle").value = official.title;
      document.getElementById("officialPhone").value = official.phone || "";
      document.getElementById("officialEmail").value = official.email || "";
      document.getElementById("officialWhatsapp").value = official.whatsapp || "";
      document.getElementById("officialViber").value = official.viber || "";
      document.getElementById("officialTelegram").value = official.telegram || "";

      document.getElementById("saveOfficialBtn").innerText = "Posodobi funkcionarja";
      document.getElementById("cancelOfficialEditBtn").classList.remove("hidden");
    });
  });

  document.querySelectorAll(".deleteOfficialBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      showConfirmModal("Izbriši tega funkcionarja?", async () => {
        await fetch(`/api/admin/officials/${btn.dataset.id}`, {
          method: "DELETE",
          credentials: "include"
        });

        loadOfficials();
      });
    });
  });
}

function renderOfficial(o) {
  const contacts = [];
  if (o.phone) contacts.push(`Tel: ${o.phone}`);
  if (o.email) contacts.push(`Email: ${o.email}`);
  if (o.whatsapp) contacts.push(`WhatsApp: ${o.whatsapp}`);
  if (o.viber) contacts.push(`Viber: ${o.viber}`);
  if (o.telegram) contacts.push(`Telegram: ${o.telegram}`);

  return `
    <li class="official-item" data-id="${o.id}">
      <div class="member-row">
        <span>
          <strong>${o.first_name} ${o.last_name}</strong> — ${o.title}
          ${contacts.length ? `<br><small>${contacts.join(" · ")}</small>` : ""}
        </span>
        <div class="actions">
          <button class="editOfficialBtn icon-btn btn-edit" data-id="${o.id}">${ICON_EDIT}</button>
          <button class="deleteOfficialBtn icon-btn btn-reject" data-id="${o.id}">${ICON_DELETE}</button>
        </div>
      </div>
    </li>
  `;
}

function resetOfficialForm() {
  editingOfficialId = null;

  ["officialFirstName", "officialLastName", "officialTitle", "officialPhone", "officialEmail", "officialWhatsapp", "officialViber", "officialTelegram"]
    .forEach(id => { document.getElementById(id).value = ""; });

  document.getElementById("saveOfficialBtn").innerText = "Dodaj funkcionarja";
  document.getElementById("cancelOfficialEditBtn").classList.add("hidden");
  document.getElementById("officialMsg").innerText = "";
}

document.getElementById("cancelOfficialEditBtn")?.addEventListener("click", resetOfficialForm);

document.getElementById("saveOfficialBtn")?.addEventListener("click", async () => {
  const msg = document.getElementById("officialMsg");
  msg.innerText = "";

  const payload = {
    first_name: document.getElementById("officialFirstName").value.trim(),
    last_name: document.getElementById("officialLastName").value.trim(),
    title: document.getElementById("officialTitle").value.trim(),
    phone: document.getElementById("officialPhone").value.trim(),
    email: document.getElementById("officialEmail").value.trim(),
    whatsapp: document.getElementById("officialWhatsapp").value.trim(),
    viber: document.getElementById("officialViber").value.trim(),
    telegram: document.getElementById("officialTelegram").value.trim()
  };

  if (!payload.first_name || !payload.last_name || !payload.title) {
    msg.innerText = "Ime, priimek in funkcija so obvezni";
    return;
  }

  const url = editingOfficialId ? `/api/admin/officials/${editingOfficialId}` : "/api/admin/officials";
  const method = editingOfficialId ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    return;
  }

  resetOfficialForm();
  loadOfficials();
});


/* =========================
  SODELAVCI PRI VNOSU DELA (iskanje, sortiranje, ekipe, override ur)
========================= */
async function loadParticipantOptions() {
  const container = document.getElementById("participantCheckboxes");
  if (!container) return;

  const res = await fetch("/api/work/organization-members", { credentials: "include" });
  if (!res.ok) return;

  orgMembersCache = await res.json();
  renderParticipantList();
  loadTeamsForPicker();
}

function renderParticipantList() {
  const container = document.getElementById("participantCheckboxes");
  if (!container) return;

  const query = (document.getElementById("participantSearch")?.value || "").trim().toLowerCase();
  const sortMode = document.getElementById("participantSort")?.value || "first_asc";

  let members = orgMembersCache.filter(m => {
    if (!query) return true;
    return m.first_name.toLowerCase().startsWith(query) || m.last_name.toLowerCase().startsWith(query);
  });

  const [sortField, sortDir] = sortMode.split("_");
  const sortKey = sortField === "first" ? "first_name" : "last_name";

  members = [...members].sort((a, b) => {
    const cmp = a[sortKey].localeCompare(b[sortKey], "sl");
    return sortDir === "asc" ? cmp : -cmp;
  });

  container.innerHTML = members.length
    ? members.map(m => {
        const isChecked = selectedParticipants.has(m.id);
        const overrideVal = selectedParticipants.get(m.id);

        return `
          <label class="participant-row">
            <input type="checkbox" class="participantCheckbox" value="${m.id}" ${isChecked ? "checked" : ""}>
            <span>${m.first_name} ${m.last_name}</span>
            <input type="number" class="participantMinutesOverride ${isChecked ? "" : "hidden"}"
                   data-id="${m.id}" min="0" placeholder="min"
                   value="${overrideVal === null || overrideVal === undefined ? "" : overrideVal}">
          </label>
        `;
      }).join("")
    : "<span>Ni ujemajočih se članov</span>";

  container.querySelectorAll(".participantCheckbox").forEach(cb => {
    cb.addEventListener("change", () => {
      const id = Number(cb.value);
      const overrideInput = container.querySelector(`.participantMinutesOverride[data-id="${id}"]`);

      if (cb.checked) {
        if (!selectedParticipants.has(id)) selectedParticipants.set(id, null);
        overrideInput?.classList.remove("hidden");
      } else {
        selectedParticipants.delete(id);
        overrideInput?.classList.add("hidden");
      }
    });
  });

  container.querySelectorAll(".participantMinutesOverride").forEach(input => {
    input.addEventListener("input", () => {
      const id = Number(input.dataset.id);
      const val = input.value === "" ? null : Number(input.value);
      selectedParticipants.set(id, val);
    });
  });
}

document.getElementById("participantSearch")?.addEventListener("input", renderParticipantList);
document.getElementById("participantSort")?.addEventListener("change", renderParticipantList);

async function loadTeamsForPicker() {
  const select = document.getElementById("teamQuickAdd");
  if (!select) return;

  const res = await fetch("/api/work/teams", { credentials: "include" });
  if (!res.ok) return;

  orgTeamsCache = await res.json();

  select.innerHTML = `<option value="">+ Dodaj ekipo...</option>` +
    orgTeamsCache.map(t => `<option value="${t.id}">${t.name} (${memberCountLabel(t.member_ids.length)})</option>`).join("");
}

document.getElementById("teamQuickAdd")?.addEventListener("change", (e) => {
  const teamId = Number(e.target.value);
  if (!teamId) return;

  const team = orgTeamsCache.find(t => t.id === teamId);

  if (team) {
    team.member_ids.forEach(id => {
      if (!selectedParticipants.has(id)) selectedParticipants.set(id, null);
    });
  }

  e.target.value = "";
  renderParticipantList();
});


/* =========================
  ADMIN - DELO V DRUŠTVU (+ filtri po datumu/statusu)
========================= */
let adminWorkCache = [];

async function loadAdminWork() {
  const list = document.getElementById("adminWorkList");
  if (!list) return;

  const res = await fetch("/api/admin/work", { credentials: "include" });
  if (!res.ok) return;

  adminWorkCache = await res.json();
  renderAdminWorkList();
}

function renderAdminWorkList() {
  const list = document.getElementById("adminWorkList");
  if (!list) return;

  const from = document.getElementById("approvalsDateFrom")?.value || "";
  const to = document.getElementById("approvalsDateTo")?.value || "";
  const statusFilter = document.getElementById("approvalsStatusFilter")?.value || "ALL";

  const items = adminWorkCache.filter(w => {
    const workDate = (w.started_at || "").slice(0, 10);

    if (from && workDate < from) return false;
    if (to && workDate > to) return false;

    if (statusFilter === "ALL") return true;
    if (statusFilter === "PENDING_CORRECTED") return w.status === "PENDING" && !!w.rejection_reason;
    if (statusFilter === "PENDING") return w.status === "PENDING" && !w.rejection_reason;
    return w.status === statusFilter;
  });

  list.innerHTML = items.length
    ? items.map(renderAdminWorkItem).join("")
    : "<li>Ni vnosov, ki bi ustrezali filtru</li>";

  document.querySelectorAll(".approveBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetch(`/api/admin/work/${btn.dataset.id}/approve`, {
        method: "POST",
        credentials: "include"
      });

      loadAdminWork();
    });
  });

  document.querySelectorAll(".rejectToggleBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(`rejectPanel-${btn.dataset.id}`)?.classList.toggle("hidden");
    });
  });

  document.querySelectorAll(".cancelRejectBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(`rejectPanel-${btn.dataset.id}`)?.classList.add("hidden");
    });
  });

  document.querySelectorAll(".confirmRejectBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const panel = document.getElementById(`rejectPanel-${id}`);
      const reason = panel.querySelector(".rejectReasonInput").value.trim();
      const msg = document.getElementById(`rejectMsg-${id}`);

      msg.innerText = "";

      if (!reason) {
        msg.innerText = "Vnesi razlog za zavrnitev";
        return;
      }

      const res = await fetch(`/api/admin/work/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.innerText = data.message || "Napaka";
        return;
      }

      loadAdminWork();
    });
  });
}

function formatDateForInput(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function applyApprovalsDateRange(from, to) {
  document.getElementById("approvalsDateFrom").value = formatDateForInput(from);
  document.getElementById("approvalsDateTo").value = formatDateForInput(to);
  renderAdminWorkList();
}

document.getElementById("filterToday")?.addEventListener("click", () => {
  const now = new Date();
  applyApprovalsDateRange(now, now);
});

document.getElementById("filterWeek")?.addEventListener("click", () => {
  const now = new Date();
  const dayIndex = (now.getDay() + 6) % 7; // 0 = ponedeljek ... 6 = nedelja
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayIndex);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  applyApprovalsDateRange(monday, sunday);
});

document.getElementById("filterMonth")?.addEventListener("click", () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  applyApprovalsDateRange(first, last);
});

document.getElementById("filterYear")?.addEventListener("click", () => {
  const now = new Date();
  applyApprovalsDateRange(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31));
});

document.getElementById("filterClear")?.addEventListener("click", () => {
  document.getElementById("approvalsDateFrom").value = "";
  document.getElementById("approvalsDateTo").value = "";
  renderAdminWorkList();
});

document.getElementById("approvalsDateFrom")?.addEventListener("change", renderAdminWorkList);
document.getElementById("approvalsDateTo")?.addEventListener("change", renderAdminWorkList);
document.getElementById("approvalsStatusFilter")?.addEventListener("change", renderAdminWorkList);

function formatParticipant(p, defaultMinutes) {
  const minutes = p.minutes_override === null || p.minutes_override === undefined ? defaultMinutes : p.minutes_override;
  return `${p.first_name} ${p.last_name} (${formatHours(minutes)})`;
}

function formatDateDisplay(dateStr) {
  const d = new Date(dateStr);
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function formatDateTimeDisplay(dateStr) {
  const d = new Date(dateStr);
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderAdminWorkItem(w) {
  const hours = formatHours(w.minutes);
  const participants = w.participants.map(p => formatParticipant(p, w.minutes)).join(", ");
  const correctedBadge = (w.status === "PENDING" && w.rejection_reason)
    ? `<span class="status-badge status-CORRECTED">popravljeno po zavrnitvi</span>`
    : "";

  return `
    <li class="admin-work-item" data-id="${w.id}">
      <div class="member-row">
        <span>
          <strong>${formatDateDisplay(w.started_at)}</strong> · <strong>${w.creator_first_name} ${w.creator_last_name}</strong> — ${w.task}
          <span class="status-badge status-${w.status}">${statusLabel(w.status)}</span>${correctedBadge}<br>
          <small>${w.category_name || "brez kategorije"} · ${hours} · sodelavci: ${participants || "-"}</small>
          ${w.status === "REJECTED" && w.rejection_reason ? `<br><small>Razlog: ${w.rejection_reason}</small>` : ""}
        </span>
        <div class="actions">
          ${w.status === "PENDING" ? `
            <button class="approveBtn icon-btn btn-approve" data-id="${w.id}">✓</button>
            <button class="rejectToggleBtn icon-btn btn-reject" data-id="${w.id}">✗</button>
          ` : ""}
        </div>
      </div>
      ${w.status === "PENDING" ? `
        <div class="reject-panel hidden" id="rejectPanel-${w.id}">
          <div class="field">
            <label>Razlog za zavrnitev</label>
            <textarea class="rejectReasonInput" rows="3" placeholder="Opiši razlog za zavrnitev..."></textarea>
          </div>
          <div id="rejectMsg-${w.id}" class="error"></div>
          <div class="edit-actions">
            <button class="confirmRejectBtn icon-btn btn-reject" data-id="${w.id}">Zavrni</button>
            <button class="cancelRejectBtn secondary-btn" data-id="${w.id}">Prekliči</button>
          </div>
        </div>
      ` : ""}
    </li>
  `;
}


/* =========================
  WORK
========================= */

async function loadWork() {
  const res = await fetch("/api/work", {
    credentials: "include"
  });

  const data = await res.json();

  const list = document.getElementById("workList");
  list.innerHTML = "";

  if (!data.length) {
    list.innerHTML = "<li>Ni še vnosov</li>";
    return;
  }

  data.forEach(w => {
    const hours = formatHours(w.minutes);
    const participantNames = w.participants.map(p => formatParticipant(p, w.minutes)).join(", ");
    const isOwner = w.user_id === currentUserId;
    const isLocked = w.status === "APPROVED";
    const correctedBadge = (w.status === "PENDING" && w.rejection_reason)
      ? `<span class="status-badge status-CORRECTED">popravljeno po zavrnitvi</span>`
      : "";

    const li = document.createElement("li");

    li.innerHTML = `
      <span>
        ${w.task}
        <span class="status-badge status-${w.status}">${statusLabel(w.status)}</span>${correctedBadge}<br>
        <small>${w.category_name || "brez kategorije"}${participantNames ? " · " + participantNames : ""}</small>
        ${w.status === "REJECTED" && w.rejection_reason ? `<br><small>Razlog zavrnitve: ${w.rejection_reason}</small>` : ""}
      </span>
      <div class="actions">
        <strong>${hours}</strong>
        ${isOwner && !isLocked ? `
          <button class="editBtn icon-btn btn-edit" data-id="${w.id}">${ICON_EDIT}</button>
          <button class="deleteBtn icon-btn btn-reject" data-id="${w.id}">${ICON_DELETE}</button>
        ` : ""}
      </div>
    `;

    list.appendChild(li);
  });

  document.querySelectorAll(".editBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const item = data.find(w => w.id == id);

      if (!item) return;

      document.getElementById("task").value = item.task;
      document.getElementById("start").value = formatDate(item.started_at);
      document.getElementById("end").value = formatDate(item.ended_at);
      document.getElementById("workCategory").value = item.category_id || "";

      selectedParticipants.clear();
      item.participants.forEach(p => {
        if (p.id !== currentUserId) selectedParticipants.set(p.id, p.minutes_override ?? null);
      });
      renderParticipantList();

    //posodobi števec
    document.getElementById("taskCount").innerText = `${item.task.length} / 255`;

      //EDIT MODE
      editingWorkId = item.id;

      const addBtn = document.getElementById("addWorkBtn");
      addBtn.innerText = "Uredi";
      addBtn.style.background = "#3b82f6";

      document.querySelector(".work-form").classList.add("editing");
    });
  });


  // DELETE (odpre stiliziran potrditveni popup)

  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      showConfirmModal("Ali res želiš izbrisati vnos?", async () => {
        await fetch(`/api/work/${btn.dataset.id}`, {
          method: "DELETE",
          credentials: "include"
        });

        loadWork();
      });
    });
  });

}

/* =========================
  ADD WORK
========================= */

async function addWork() {
  const task = document.getElementById("task").value.trim();
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;
  const category_id = document.getElementById("workCategory").value || null;

  const participants = Array.from(selectedParticipants.entries())
    .map(([user_id, minutes_override]) => ({ user_id, minutes_override }));

  if (!task || !end) {
    alert("Izpolni podatke");
    return;
  }

  const payload = {
    task,
    started_at: start,
    ended_at: end,
    category_id,
    participants
  };

  let res;

  if (editingWorkId) {
    //EDIT MODE
    res = await fetch(`/api/work/${editingWorkId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
  } else {
    //CREATE MODE
    res = await fetch("/api/work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
  }

  if (!res.ok) {
    alert("Napaka");
    return;
  }

  //reset forma
  resetForm();

  loadWork();
}



/* =========================
  GRAF UR SKOZI ČAS (skupno za "Moj profil" in profil člana)
========================= */
const chartInstances = {};

function renderHoursChart(canvasId, data, from, to) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;

  const byDate = Object.fromEntries(data.map(d => [d.date, d.minutes]));
  const labels = [];
  const values = [];

  const cursor = new Date(from);
  const end = new Date(to);

  while (cursor <= end) {
    const key = formatDateForInput(cursor);
    labels.push(formatDateDisplay(key));
    values.push(Math.round(((byDate[key] || 0) / 60) * 100) / 100);
    cursor.setDate(cursor.getDate() + 1);
  }

  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

  chartInstances[canvasId] = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Opravljene ure",
        data: values,
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79,70,229,0.1)",
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}


/* =========================
  STATISTIKA DRUŠTVA (ADMIN/SUPERINTENDENT)
========================= */
async function loadOrgStatsView() {
  const fromInput = document.getElementById("orgStatsDateFrom");
  const toInput = document.getElementById("orgStatsDateTo");

  if (!fromInput.value || !toInput.value) {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setMonth(now.getMonth() - 1);

    fromInput.value = formatDateForInput(monthAgo);
    toInput.value = formatDateForInput(now);
  }

  await loadOrgStatsFilterOptions();
  loadOrgStats();
}

/* =========================
  SPUSTNI SEZNAM Z VEČ KLJUKICAMI (status/kategorije/ekipe)
========================= */
function setupDropdownCheckFilter(btnId, panelId, label, onChange) {
  const btn = document.getElementById(btnId);
  const panel = document.getElementById(panelId);
  if (!btn || !panel) return;

  function updateLabel() {
    const checked = panel.querySelectorAll("input:checked").length;
    btn.innerText = checked ? `${label}: ${checked} izbranih ▾` : `${label}: Vse ▾`;
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();

    document.querySelectorAll(".dropdown-check-panel").forEach(p => {
      if (p !== panel) p.classList.add("hidden");
    });

    panel.classList.toggle("hidden");
  });

  panel.addEventListener("change", () => {
    updateLabel();
    if (onChange) onChange();
  });

  updateLabel();
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-check-filter")) {
    document.querySelectorAll(".dropdown-check-panel").forEach(p => p.classList.add("hidden"));
  }
});

setupDropdownCheckFilter("orgStatsStatusBtn", "orgStatsStatusPanel", "Status", () => loadOrgStats());
setupDropdownCheckFilter("orgStatsCategoryBtn", "orgStatsCategoryPanel", "Kategorije", () => loadOrgStats());
setupDropdownCheckFilter("orgStatsTeamBtn", "orgStatsTeamPanel", "Ekipe", () => loadOrgStats());

async function loadOrgStatsFilterOptions() {
  const catPanel = document.getElementById("orgStatsCategoryPanel");
  if (catPanel) {
    const res = await fetch("/api/admin/categories", { credentials: "include" });

    if (res.ok) {
      const categories = await res.json();

      catPanel.innerHTML = categories.length
        ? categories.map(c => `
            <label>
              <input type="checkbox" value="${c.id}">
              ${c.name}${c.is_active ? "" : " (neaktivna)"}
            </label>
          `).join("")
        : "<span>Ni še kategorij</span>";
    }
  }

  const teamPanel = document.getElementById("orgStatsTeamPanel");
  if (teamPanel) {
    const res = await fetch("/api/admin/teams", { credentials: "include" });

    if (res.ok) {
      const teams = await res.json();

      teamPanel.innerHTML = teams.length
        ? teams.map(t => `
            <label>
              <input type="checkbox" value="${t.id}">
              ${t.name}
            </label>
          `).join("")
        : "<span>Ni še ekip</span>";
    }
  }
}

async function loadOrgStats() {
  const from = document.getElementById("orgStatsDateFrom")?.value;
  const to = document.getElementById("orgStatsDateTo")?.value;

  if (!from || !to) return;

  const statuses = Array.from(document.querySelectorAll("#orgStatsStatusPanel input:checked")).map(cb => cb.value);
  const categoryIds = Array.from(document.querySelectorAll("#orgStatsCategoryPanel input:checked")).map(cb => cb.value);
  const teamIds = Array.from(document.querySelectorAll("#orgStatsTeamPanel input:checked")).map(cb => cb.value);

  const params = new URLSearchParams({ from, to });
  if (statuses.length) params.set("statuses", statuses.join(","));
  if (categoryIds.length) params.set("category_ids", categoryIds.join(","));
  if (teamIds.length) params.set("team_ids", teamIds.join(","));

  const res = await fetch(`/api/admin/stats?${params.toString()}`, { credentials: "include" });
  if (!res.ok) return;

  const data = await res.json();

  document.getElementById("orgStatsTotalHours").innerText = formatHours(data.totalMinutes);

  renderHoursChart("orgStatsChart", data.byDate, from, to);

  const topN = Number(document.getElementById("orgStatsTopN")?.value) || 10;
  const byUserTop = data.byUser.slice(0, topN);

  const list = document.getElementById("orgStatsByUserList");
  list.innerHTML = byUserTop.length
    ? byUserTop.map(u => `<li><span>${u.first_name} ${u.last_name}</span><span>${formatHours(u.minutes)}</span></li>`).join("")
    : "<li>Ni podatkov za izbrano obdobje/filtre</li>";
}

document.getElementById("orgStatsTopN")?.addEventListener("input", loadOrgStats);

document.getElementById("orgStatsDateFrom")?.addEventListener("change", loadOrgStats);
document.getElementById("orgStatsDateTo")?.addEventListener("change", loadOrgStats);
document.getElementById("orgStatsStatusFilter")?.addEventListener("change", loadOrgStats);
document.getElementById("orgStatsCategoryCheckboxes")?.addEventListener("change", loadOrgStats);
document.getElementById("orgStatsTeamCheckboxes")?.addEventListener("change", loadOrgStats);

function applyOrgStatsDateRange(from, to) {
  document.getElementById("orgStatsDateFrom").value = formatDateForInput(from);
  document.getElementById("orgStatsDateTo").value = formatDateForInput(to);
  loadOrgStats();
}

document.getElementById("orgStatsToday")?.addEventListener("click", () => {
  const now = new Date();
  applyOrgStatsDateRange(now, now);
});

document.getElementById("orgStatsWeek")?.addEventListener("click", () => {
  const now = new Date();
  const dayIndex = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayIndex);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  applyOrgStatsDateRange(monday, sunday);
});

document.getElementById("orgStatsMonth")?.addEventListener("click", () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  applyOrgStatsDateRange(first, last);
});

document.getElementById("orgStatsYear")?.addEventListener("click", () => {
  const now = new Date();
  applyOrgStatsDateRange(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31));
});

document.getElementById("orgStatsClear")?.addEventListener("click", () => {
  document.getElementById("orgStatsDateFrom").value = "";
  document.getElementById("orgStatsDateTo").value = "";
  loadOrgStats();
});


/* =========================
  STATISTIKA VSEH DRUŠTEV (SUPER_ADMIN)
========================= */
async function loadPlatformStatsView() {
  const fromInput = document.getElementById("platformStatsDateFrom");
  const toInput = document.getElementById("platformStatsDateTo");

  if (!fromInput.value || !toInput.value) {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setMonth(now.getMonth() - 1);

    fromInput.value = formatDateForInput(monthAgo);
    toInput.value = formatDateForInput(now);
  }

  await loadPlatformStatsFilterOptions();
  loadPlatformStats();
}

setupDropdownCheckFilter("platformStatsStatusBtn", "platformStatsStatusPanel", "Status", () => loadPlatformStats());
setupDropdownCheckFilter("platformStatsOrgBtn", "platformStatsOrgPanel", "Društva", () => loadPlatformStats());

async function loadPlatformStatsFilterOptions() {
  const orgPanel = document.getElementById("platformStatsOrgPanel");
  if (!orgPanel) return;

  const res = await fetch("/api/superadmin/organizations", { credentials: "include" });
  if (!res.ok) return;

  const orgs = await res.json();

  orgPanel.innerHTML = orgs.length
    ? orgs.map(o => `<label><input type="checkbox" value="${o.id}"> ${o.name}</label>`).join("")
    : "<span>Ni še nobenega društva</span>";
}

async function loadPlatformStats() {
  const from = document.getElementById("platformStatsDateFrom")?.value;
  const to = document.getElementById("platformStatsDateTo")?.value;

  if (!from || !to) return;

  const statuses = Array.from(document.querySelectorAll("#platformStatsStatusPanel input:checked")).map(cb => cb.value);
  const organizationIds = Array.from(document.querySelectorAll("#platformStatsOrgPanel input:checked")).map(cb => cb.value);

  const params = new URLSearchParams({ from, to });
  if (statuses.length) params.set("statuses", statuses.join(","));
  if (organizationIds.length) params.set("organization_ids", organizationIds.join(","));

  const res = await fetch(`/api/superadmin/stats?${params.toString()}`, { credentials: "include" });
  if (!res.ok) return;

  const data = await res.json();

  document.getElementById("platformStatsTotalHours").innerText = formatHours(data.totalMinutes);

  renderHoursChart("platformStatsChart", data.byDate, from, to);

  const list = document.getElementById("platformStatsByOrgList");
  list.innerHTML = data.byOrganization.length
    ? data.byOrganization.map(o => `<li><span>${o.name}</span><span>${formatHours(o.minutes)}</span></li>`).join("")
    : "<li>Ni podatkov za izbrano obdobje/filtre</li>";
}

document.getElementById("platformStatsDateFrom")?.addEventListener("change", loadPlatformStats);
document.getElementById("platformStatsDateTo")?.addEventListener("change", loadPlatformStats);

function applyPlatformStatsDateRange(from, to) {
  document.getElementById("platformStatsDateFrom").value = formatDateForInput(from);
  document.getElementById("platformStatsDateTo").value = formatDateForInput(to);
  loadPlatformStats();
}

document.getElementById("platformStatsToday")?.addEventListener("click", () => {
  const now = new Date();
  applyPlatformStatsDateRange(now, now);
});

document.getElementById("platformStatsWeek")?.addEventListener("click", () => {
  const now = new Date();
  const dayIndex = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayIndex);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  applyPlatformStatsDateRange(monday, sunday);
});

document.getElementById("platformStatsMonth")?.addEventListener("click", () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  applyPlatformStatsDateRange(first, last);
});

document.getElementById("platformStatsYear")?.addEventListener("click", () => {
  const now = new Date();
  applyPlatformStatsDateRange(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31));
});

document.getElementById("platformStatsClear")?.addEventListener("click", () => {
  document.getElementById("platformStatsDateFrom").value = "";
  document.getElementById("platformStatsDateTo").value = "";
  loadPlatformStats();
});


/* =========================
  MOJ PROFIL
========================= */
async function loadProfileView() {
  const res = await fetch("/api/users/me", { credentials: "include" });
  const data = await res.json();

  if (!data.loggedIn) return;

  const user = data.user;

  document.getElementById("profileFirstName").innerText = user.first_name;
  document.getElementById("profileLastName").innerText = user.last_name;
  document.getElementById("profileEmail").innerText = user.email;
  document.getElementById("profileOrg").innerText = user.organization_name || "-";
  document.getElementById("profileAvatarImg").src = user.avatar_path || "logo.png";

  const fromInput = document.getElementById("profileStatsFrom");
  const toInput = document.getElementById("profileStatsTo");

  if (!fromInput.value || !toInput.value) {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setMonth(now.getMonth() - 1);

    fromInput.value = formatDateForInput(monthAgo);
    toInput.value = formatDateForInput(now);
  }

  loadProfileStats();
  loadLoginHistory();
}

async function loadLoginHistory() {
  const list = document.getElementById("loginHistoryList");
  if (!list) return;

  const res = await fetch("/api/users/me/login-history", { credentials: "include" });
  if (!res.ok) return;

  const rows = await res.json();

  list.innerHTML = rows.length
    ? rows.map(r => `
        <li>
          <span>${formatDateTimeDisplay(r.created_at)} — ${r.ip_address || "neznan IP"}${r.location ? " · " + r.location : ""}</span>
          <span>${r.browser || "-"}</span>
        </li>
      `).join("")
    : "<li>Ni zabeleženih prijav</li>";
}

async function loadProfileStats() {
  const from = document.getElementById("profileStatsFrom")?.value;
  const to = document.getElementById("profileStatsTo")?.value;

  if (!from || !to) return;

  const res = await fetch(`/api/users/me/stats?from=${from}&to=${to}`, { credentials: "include" });
  if (!res.ok) return;

  const data = await res.json();
  renderHoursChart("profileChart", data, from, to);
}

document.getElementById("profileStatsFrom")?.addEventListener("change", loadProfileStats);
document.getElementById("profileStatsTo")?.addEventListener("change", loadProfileStats);

document.getElementById("avatarInput")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const msg = document.getElementById("avatarMsg");

  msg.innerText = "";

  if (!file) return;

  const formData = new FormData();
  formData.append("avatar", file);

  const res = await fetch("/api/users/me/avatar", {
    method: "POST",
    credentials: "include",
    body: formData
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka pri nalaganju slike";
    return;
  }

  document.getElementById("profileAvatarImg").src = data.avatar_path;
});

document.getElementById("profileSettingsBtn")?.addEventListener("click", () => {
  document.getElementById("profileSettingsPanel")?.classList.toggle("hidden");
});

document.getElementById("savePasswordBtn")?.addEventListener("click", async () => {
  const old_password = document.getElementById("oldPasswordInput").value;
  const new_password = document.getElementById("newPasswordInput").value;
  const confirm_password = document.getElementById("confirmPasswordInput").value;
  const msg = document.getElementById("passwordChangeMsg");

  msg.innerText = "";
  msg.style.color = "";

  if (!old_password || !new_password || !confirm_password) {
    msg.innerText = "Izpolni vsa polja";
    return;
  }

  if (new_password !== confirm_password) {
    msg.innerText = "Novi gesli se ne ujemata";
    return;
  }

  const res = await fetch("/api/users/me/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ old_password, new_password })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    return;
  }

  // geslo je bilo spremenjeno - streznik je ze unicil sejo, uporabnika preusmerimo na prijavo
  alert(data.message || "Geslo posodobljeno. Ponovno se prijavite.");
  location.reload();
});

document.getElementById("saveEmailBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("newEmailInput").value.trim();
  const msg = document.getElementById("emailChangeMsg");

  msg.innerText = "";
  msg.style.color = "";

  if (!email) {
    msg.innerText = "Vnesi email";
    return;
  }

  const res = await fetch("/api/users/me/email", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.message || "Napaka";
    return;
  }

  msg.style.color = "#16a34a";
  msg.innerText = data.message;
  document.getElementById("profileEmail").innerText = email;
  document.getElementById("newEmailInput").value = "";
});


/* =========================
  PROFIL POSAMEZNEGA ČLANA (ADMIN/SUPERINTENDENT - klik na ime v seznamu)
========================= */
let currentMemberDetailId = null;

async function openMemberDetail(userId) {
  const res = await fetch(`/api/admin/users/${userId}`, { credentials: "include" });
  if (!res.ok) return;

  const m = await res.json();
  currentMemberDetailId = m.id;

  document.getElementById("memberDetailFirstName").innerText = m.first_name;
  document.getElementById("memberDetailLastName").innerText = m.last_name;
  document.getElementById("memberDetailEmail").innerText = m.email || "brez emaila";
  document.getElementById("memberDetailRole").innerText = roleLabel(m.role);
  document.getElementById("memberDetailAvatarImg").src = m.avatar_path || "logo.png";

  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setMonth(now.getMonth() - 1);

  document.getElementById("memberDetailStatsFrom").value = formatDateForInput(monthAgo);
  document.getElementById("memberDetailStatsTo").value = formatDateForInput(now);

  showView("member-detail");
  loadMemberDetailStats();
}

async function loadMemberDetailStats() {
  if (!currentMemberDetailId) return;

  const from = document.getElementById("memberDetailStatsFrom")?.value;
  const to = document.getElementById("memberDetailStatsTo")?.value;

  if (!from || !to) return;

  const res = await fetch(`/api/admin/users/${currentMemberDetailId}/stats?from=${from}&to=${to}`, { credentials: "include" });
  if (!res.ok) return;

  const data = await res.json();
  renderHoursChart("memberDetailChart", data, from, to);
}

document.getElementById("memberDetailStatsFrom")?.addEventListener("change", loadMemberDetailStats);
document.getElementById("memberDetailStatsTo")?.addEventListener("change", loadMemberDetailStats);
document.getElementById("backToMembersBtn")?.addEventListener("click", () => showView("members"));


/* =========================
  LOGOUT
========================= */
async function logout() {
  await fetch("/api/users/logout", {
    method: "POST",
    credentials: "include"
  });

  location.reload();
}


/* =========================
  EVENT LISTENERS
========================= */

document.getElementById("loginForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  login(e);
});

document.getElementById("addWorkBtn")?.addEventListener("click", addWork);
document.getElementById("headerLogout")?.addEventListener("click", logout);


function getNowDateTime() {
  const now = new Date();

  const pad = (n) => n.toString().padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);

  const pad = (n) => n.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function resetForm() {
  document.getElementById("task").value = "";
  document.getElementById("start").value = getNowDateTime();
  document.getElementById("end").value = getNowDateTime();
  document.getElementById("workCategory").value = "";

  selectedParticipants.clear();
  const searchInput = document.getElementById("participantSearch");
  if (searchInput) searchInput.value = "";
  renderParticipantList();


  //reset edit mode
  editingWorkId = null;

  //button nazaj
  const btn = document.getElementById("addWorkBtn");
  btn.innerText = "+ Dodaj";
  btn.style.background = "#4f46e5";

  //odstrani border
  document.querySelector(".work-form").classList.remove("editing");
}


if (taskInput && taskCount) {
  taskInput.addEventListener("input", () => {
    const length = taskInput.value.length;

    taskCount.innerText = `${length} / 255`;

    if (length >= 255) {
      taskCount.classList.add("limit");
    } else {
      taskCount.classList.remove("limit");
    }
  });
}

const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");

const loginEmailError = document.getElementById("loginEmailError");
const loginPasswordError = document.getElementById("loginPasswordError");

if (loginEmailInput && loginPasswordInput) {
  loginEmailInput.addEventListener("input", () => {
    if (loginEmailInput.value.trim() !== "") {
      loginEmailError.innerText = "";
      loginEmailInput.classList.remove("errorInput");
    }
  });
  loginPasswordInput.addEventListener("input", () => {
    if (loginPasswordInput.value.trim() !== "") {
      loginPasswordError.innerText = "";
      loginPasswordInput.classList.remove("errorInput");
    }
  });
}


if (loginEmailInput && loginPasswordInput) {

  loginEmailInput.addEventListener("input", () => {
    const val = loginEmailInput.value.trim();

    if (!val) {
      loginEmailError.innerText = "";
      loginEmailInput.classList.remove("errorInput");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      loginEmailError.innerText = "Napačen format email";
      loginEmailInput.classList.add("errorInput");
    } else {
      loginEmailError.innerText = "";
      loginEmailInput.classList.remove("errorInput");
    }
  });

  loginPasswordInput.addEventListener("input", () => {
    if (loginPasswordInput.value.trim() !== "") {
      loginPasswordError.innerText = "";
      loginPasswordInput.classList.remove("errorInput");
    }
  });

}
