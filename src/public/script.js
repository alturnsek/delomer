const authDiv = document.querySelector(".container");
const appLayout = document.getElementById("appLayout");
const sidebar = document.getElementById("sidebar");

const taskInput = document.getElementById("task");
const taskCount = document.getElementById("taskCount");

let workToDelete = null;
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
  MEMBER: "Član"
};

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

/* =========================
  VIEW ROUTING (sidebar meni)
========================= */
const VIEW_LOADERS = {
  work: () => { loadCategories(); loadParticipantOptions(); loadWork(); },
  members: () => loadOrgMembers(),
  categories: () => loadCategoriesAdmin(),
  teams: () => loadTeamsView(),
  approvals: () => loadAdminWork(),
  "org-stats": () => {},
  organizations: () => { loadEmailModeSetting(); loadOrganizationsSuperadmin(); },
  "org-admins": () => loadOrgAdminsOrgOptions(),
  "platform-stats": () => {},
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
        <span>${o.name} — ${o.member_count} članov</span>
        <button class="editOrgBtn icon-btn btn-edit" data-id="${o.id}">✏️</button>
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

async function loadOrgAdminsUsers(organizationId) {
  const list = document.getElementById("orgAdminsList");
  if (!list || !organizationId) {
    if (list) list.innerHTML = "";
    return;
  }

  const res = await fetch(`/api/superadmin/organizations/${organizationId}/users`, { credentials: "include" });
  if (!res.ok) return;

  const members = await res.json();

  list.innerHTML = members.length
    ? members.map(m => renderRoleManagedMember(m, `/api/superadmin/organizations/${organizationId}/users`)).join("")
    : "<li>Ni še članov</li>";

  wireRoleSelects();
}

function renderRoleManagedMember(m, roleEndpointBase) {
  return `
    <li>
      <span>${m.first_name} ${m.last_name} — ${m.email}${m.activated ? "" : " (čaka aktivacijo)"}</span>
      <div class="actions">
        <select class="roleSelect" data-id="${m.id}" data-endpoint="${roleEndpointBase}">
          <option value="MEMBER" ${m.role === "MEMBER" ? "selected" : ""}>${roleLabel("MEMBER")}</option>
          <option value="SUPERINTENDENT" ${m.role === "SUPERINTENDENT" ? "selected" : ""}>${roleLabel("SUPERINTENDENT")}</option>
          <option value="ADMIN" ${m.role === "ADMIN" ? "selected" : ""}>${roleLabel("ADMIN")}</option>
        </select>
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
  const statusFilter = document.getElementById("membersStatusFilter")?.value || "ALL";
  const roleFilter = document.getElementById("membersRoleFilter")?.value || "ALL";
  const sortMode = document.getElementById("membersSort")?.value || "last_asc";

  let members = adminMembersCache.filter(m => {
    if (query && !m.first_name.toLowerCase().startsWith(query) && !m.last_name.toLowerCase().startsWith(query)) return false;
    if (statusFilter === "ACTIVE" && !m.is_active) return false;
    if (statusFilter === "INACTIVE" && m.is_active) return false;
    if (roleFilter !== "ALL" && m.role !== roleFilter) return false;
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

      if (!first_name || !last_name || !email) {
        msg.innerText = "Izpolni vsa polja";
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
document.getElementById("membersStatusFilter")?.addEventListener("change", renderOrgMembersList);
document.getElementById("membersRoleFilter")?.addEventListener("change", renderOrgMembersList);
document.getElementById("membersSort")?.addEventListener("change", renderOrgMembersList);

function renderOrgMember(m) {
  const isSelf = m.id === currentUserId;
  const canManage = currentUserRole === "ADMIN";
  const nameHtml = `<a href="#" class="member-name-link" data-id="${m.id}">${m.first_name} ${m.last_name}</a>`;
  const inactiveNote = m.is_active ? "" : " (deaktiviran)";

  return `
    <li class="member-item${m.is_active ? "" : " member-inactive"}" data-id="${m.id}">
      <div class="member-row">
        <span>${nameHtml} — ${m.email}${m.activated ? "" : " (čaka aktivacijo)"}${inactiveNote}</span>
        <div class="actions">
          <span class="status-badge">${roleLabel(m.role)}</span>
          ${canManage ? `<button class="editMemberBtn icon-btn btn-edit" data-id="${m.id}">✏️</button>` : ""}
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
          <input class="editEmail" value="${m.email}" type="email">
        </div>
        ${!isSelf ? `
        <div class="field">
          <label>Vloga</label>
          <select class="roleSelect" data-id="${m.id}" data-endpoint="/api/admin/users">
            <option value="MEMBER" ${m.role === "MEMBER" ? "selected" : ""}>${roleLabel("MEMBER")}</option>
            <option value="SUPERINTENDENT" ${m.role === "SUPERINTENDENT" ? "selected" : ""}>${roleLabel("SUPERINTENDENT")}</option>
            <option value="ADMIN" ${m.role === "ADMIN" ? "selected" : ""}>${roleLabel("ADMIN")}</option>
          </select>
        </div>
        ` : ""}
        <div id="editMemberMsg-${m.id}" class="error"></div>
        <div class="edit-actions">
          <button class="saveMemberBtn icon-btn btn-edit" data-id="${m.id}">Shrani</button>
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
    body: JSON.stringify({ first_name, last_name, email })
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
              <button class="editCategoryBtn icon-btn btn-edit" data-id="${c.id}">✏️</button>
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
          <span>${t.name} (${t.member_ids.length} članov)</span>
          <div class="actions">
            <button class="editTeamBtn" data-id="${t.id}">✏️</button>
            <button class="deleteTeamBtn" data-id="${t.id}">❌</button>
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
    btn.addEventListener("click", async () => {
      if (!confirm("Izbriši to ekipo?")) return;

      await fetch(`/api/admin/teams/${btn.dataset.id}`, {
        method: "DELETE",
        credentials: "include"
      });

      loadTeamList();
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
    orgTeamsCache.map(t => `<option value="${t.id}">${t.name} (${t.member_ids.length})</option>`).join("");
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
  return `${p.first_name} ${p.last_name} (${(minutes / 60).toFixed(2)} h)`;
}

function formatDateDisplay(dateStr) {
  const d = new Date(dateStr);
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function renderAdminWorkItem(w) {
  const hours = (w.minutes / 60).toFixed(2);
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
          <small>${w.category_name || "brez kategorije"} · ${hours} h · sodelavci: ${participants || "-"}</small>
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
    const hours = (w.minutes / 60).toFixed(2);
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
        <strong>${hours} h</strong>
        ${isOwner && !isLocked ? `
          <button class="editBtn icon-btn" data-id="${w.id}">✏️</button>
          <button class="deleteBtn" data-id="${w.id}">❌</button>
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


  // DELETE (odpre modal)

  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      workToDelete = btn.dataset.id;

      document.getElementById("confirmModal").classList.add("show");
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
  document.getElementById("memberDetailEmail").innerText = m.email;
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

document.addEventListener("DOMContentLoaded", () => {

  const confirmYes = document.getElementById("confirmYes");
  const confirmNo = document.getElementById("confirmNo");
  const modal = document.getElementById("confirmModal");

  if (!confirmYes || !confirmNo || !modal) return;

  // CONFIRM DELETE
    confirmYes.addEventListener("click", async () => {
      if (!workToDelete) return;

      await fetch(`/api/work/${workToDelete}`, {
        method: "DELETE",
        credentials: "include"
      });

      document.getElementById("confirmModal").classList.remove("show");

      workToDelete = null;
      loadWork();
    });

    confirmNo.addEventListener("click", () => {
      workToDelete = null;
      document.getElementById("confirmModal").classList.remove("show");
    });


});

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
