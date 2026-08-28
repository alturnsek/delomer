const authDiv = document.querySelector(".container");
const appLayout = document.getElementById("appLayout");
const sidebar = document.getElementById("sidebar");

const taskInput = document.getElementById("task");
const taskCount = document.getElementById("taskCount");

let workToDelete = null;
let editingWorkId = null;
let currentUserId = null;
let currentUserRole = null;

/* =========================
  VIEW ROUTING (sidebar meni)
========================= */
const VIEW_LOADERS = {
  work: () => { loadCategories(); loadParticipantOptions(); loadWork(); },
  members: () => loadOrgMembers(),
  categories: () => loadCategories(),
  approvals: () => loadAdminWork(),
  "org-stats": () => {},
  organizations: () => loadOrganizationsSuperadmin(),
  "org-admins": () => loadOrgAdminsOrgOptions(),
  "platform-stats": () => {},
  profile: () => {}
};

function showView(viewName) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.querySelectorAll(".nav-link").forEach(a => a.classList.remove("active"));

  const section = document.getElementById(`view-${viewName}`);
  const link = document.querySelector(`.nav-link[data-view="${viewName}"]`);

  if (section) section.classList.remove("hidden");
  if (link) link.classList.add("active");

  if (VIEW_LOADERS[viewName]) VIEW_LOADERS[viewName]();

  sidebar.classList.add("hidden");
}

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showView(link.dataset.view);
  });
});

document.getElementById("burgerBtn")?.addEventListener("click", () => {
  sidebar.classList.toggle("hidden");
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
  SUPER ADMIN - DRUŠTVA
========================= */
async function loadOrganizationsSuperadmin() {
  const list = document.getElementById("orgList");
  if (!list) return;

  const res = await fetch("/api/superadmin/organizations", { credentials: "include" });
  if (!res.ok) return;

  const orgs = await res.json();

  list.innerHTML = orgs.length
    ? orgs.map(o => `<li><span>${o.name}</span><span>${o.member_count} članov</span></li>`).join("")
    : "<li>Ni še nobenega društva</li>";
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
          <option value="MEMBER" ${m.role === "MEMBER" ? "selected" : ""}>MEMBER</option>
          <option value="SUPERINTENDENT" ${m.role === "SUPERINTENDENT" ? "selected" : ""}>SUPERINTENDENT</option>
          <option value="ADMIN" ${m.role === "ADMIN" ? "selected" : ""}>ADMIN</option>
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
  ADMIN - ČLANI DRUŠTVA
========================= */
async function loadOrgMembers() {
  const list = document.getElementById("orgMembersList");
  if (!list) return;

  const res = await fetch("/api/admin/users", { credentials: "include" });
  if (!res.ok) return;

  const members = await res.json();

  list.innerHTML = members.length
    ? members.map(renderOrgMember).join("")
    : "<li>Ni še članov</li>";

  wireRoleSelects();

  document.querySelectorAll(".editMemberBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const member = members.find(m => m.id == btn.dataset.id);
      if (!member) return;

      const first_name = prompt("Ime:", member.first_name);
      if (first_name === null) return;

      const last_name = prompt("Priimek:", member.last_name);
      if (last_name === null) return;

      const email = prompt("Email:", member.email);
      if (email === null) return;

      const res = await fetch(`/api/admin/users/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ first_name, last_name, email })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Napaka");
        return;
      }

      loadOrgMembers();
    });
  });
}

function renderOrgMember(m) {
  const isSelf = m.id === currentUserId;

  return `
    <li>
      <span>${m.first_name} ${m.last_name} — ${m.email}${m.activated ? "" : " (čaka aktivacijo)"}</span>
      <div class="actions">
        ${isSelf
          ? `<span class="status-badge">${m.role}</span>`
          : `<select class="roleSelect" data-id="${m.id}" data-endpoint="/api/admin/users">
              <option value="MEMBER" ${m.role === "MEMBER" ? "selected" : ""}>MEMBER</option>
              <option value="SUPERINTENDENT" ${m.role === "SUPERINTENDENT" ? "selected" : ""}>SUPERINTENDENT</option>
              <option value="ADMIN" ${m.role === "ADMIN" ? "selected" : ""}>ADMIN</option>
            </select>`
        }
        <button class="editMemberBtn" data-id="${m.id}">✏️</button>
      </div>
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
  KATEGORIJE DELA
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

  const list = document.getElementById("categoryList");
  if (list) {
    list.innerHTML = categories.length
      ? categories.map(c => `<li><span>${c.name}</span><button class="deleteCategoryBtn" data-id="${c.id}">❌</button></li>`).join("")
      : "<li>Ni še kategorij</li>";

    document.querySelectorAll(".deleteCategoryBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        await fetch(`/api/admin/categories/${btn.dataset.id}`, {
          method: "DELETE",
          credentials: "include"
        });

        loadCategories();
      });
    });
  }
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
  loadCategories();
});


/* =========================
  ČLANI DRUŠTVA (za izbiro sodelavcev pri vnosu dela)
========================= */
async function loadParticipantOptions() {
  const container = document.getElementById("participantCheckboxes");
  if (!container) return;

  const res = await fetch("/api/work/organization-members", { credentials: "include" });
  if (!res.ok) return;

  const members = await res.json();

  container.innerHTML = members.length
    ? members.map(m => `
        <label>
          <input type="checkbox" class="participantCheckbox" value="${m.id}">
          ${m.first_name} ${m.last_name}
        </label>
      `).join("")
    : "<span>Ni drugih članov v društvu</span>";
}


/* =========================
  ADMIN - DELO V DRUŠTVU
========================= */
async function loadAdminWork() {
  const list = document.getElementById("adminWorkList");
  if (!list) return;

  const res = await fetch("/api/admin/work", { credentials: "include" });
  if (!res.ok) return;

  const items = await res.json();

  list.innerHTML = items.length
    ? items.map(renderAdminWorkItem).join("")
    : "<li>Ni še vnosov</li>";

  document.querySelectorAll(".approveBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetch(`/api/admin/work/${btn.dataset.id}/approve`, {
        method: "POST",
        credentials: "include"
      });

      loadAdminWork();
    });
  });

  document.querySelectorAll(".rejectBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const reason = prompt("Razlog za zavrnitev:");
      if (!reason) return;

      await fetch(`/api/admin/work/${btn.dataset.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason })
      });

      loadAdminWork();
    });
  });
}

function renderAdminWorkItem(w) {
  const hours = (w.minutes / 60).toFixed(2);
  const participants = w.participants.map(p => `${p.first_name} ${p.last_name}`).join(", ");

  return `
    <li>
      <span>
        <strong>${w.creator_first_name} ${w.creator_last_name}</strong> — ${w.task}
        <span class="status-badge status-${w.status}">${w.status}</span><br>
        <small>${w.category_name || "brez kategorije"} · ${hours} h · sodelavci: ${participants || "-"}</small>
        ${w.status === "REJECTED" && w.rejection_reason ? `<br><small>Razlog: ${w.rejection_reason}</small>` : ""}
      </span>
      <div class="actions">
        ${w.status === "PENDING" ? `
          <button class="approveBtn" data-id="${w.id}">✔️</button>
          <button class="rejectBtn" data-id="${w.id}">✖️</button>
        ` : ""}
      </div>
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
    const participantNames = w.participants.map(p => `${p.first_name} ${p.last_name}`).join(", ");
    const isOwner = w.user_id === currentUserId;
    const isLocked = w.status === "APPROVED";

    const li = document.createElement("li");

    li.innerHTML = `
      <span>
        ${w.task}
        <span class="status-badge status-${w.status}">${w.status}</span><br>
        <small>${w.category_name || "brez kategorije"}${participantNames ? " · " + participantNames : ""}</small>
        ${w.status === "REJECTED" && w.rejection_reason ? `<br><small>Razlog zavrnitve: ${w.rejection_reason}</small>` : ""}
      </span>
      <div class="actions">
        <strong>${hours} h</strong>
        ${isOwner && !isLocked ? `
          <button class="editBtn" data-id="${w.id}">✏️</button>
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

      document.querySelectorAll(".participantCheckbox").forEach(cb => {
        cb.checked = item.participants.some(p => p.id == cb.value);
      });

    //posodobi števec
    document.getElementById("taskCount").innerText = `${item.task.length} / 255`;

      //EDIT MODE
      editingWorkId = item.id;

      const addBtn = document.getElementById("addWorkBtn");
      addBtn.innerText = "Uredi";
      addBtn.style.background = "#22c55e";

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

  const participant_ids = Array.from(document.querySelectorAll(".participantCheckbox:checked"))
    .map(cb => Number(cb.value));

  if (!task || !end) {
    alert("Izpolni podatke");
    return;
  }

  const payload = {
    task,
    started_at: start,
    ended_at: end,
    category_id,
    participant_ids
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
  document.querySelectorAll(".participantCheckbox").forEach(cb => cb.checked = false);


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
