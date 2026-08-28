const authDiv = document.querySelector(".container");
const appDiv = document.getElementById("app");

const taskInput = document.getElementById("task");
const taskCount = document.getElementById("taskCount");

let workToDelete = null;
let editingWorkId = null;

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
      appDiv.classList.remove("hidden");
      document.querySelector(".header-right").style.display = "flex";

      const role = data.user.role;

      document.getElementById("superadminSection").classList.toggle("hidden", role !== "SUPER_ADMIN");
      document.getElementById("adminSection").classList.toggle("hidden", role !== "ADMIN");
      document.getElementById("workSection").classList.toggle("hidden", role === "SUPER_ADMIN");

      if (role === "SUPER_ADMIN") {
        loadOrganizationsSuperadmin();
      } else {
        loadWork();
        if (role === "ADMIN") loadOrgMembers();
      }
    } else {
      authDiv.classList.remove("hidden");
      appDiv.classList.add("hidden");
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
  ADMIN - ČLANI DRUŠTVA
========================= */
async function loadOrgMembers() {
  const list = document.getElementById("orgMembersList");
  if (!list) return;

  const res = await fetch("/api/admin/users", { credentials: "include" });
  if (!res.ok) return;

  const members = await res.json();

  list.innerHTML = members.length
    ? members.map(m => `<li><span>${m.first_name} ${m.last_name} — ${m.email}</span><span>${m.activated ? "aktiven" : "čaka aktivacijo"}</span></li>`).join("")
    : "<li>Ni še članov</li>";
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

    const li = document.createElement("li");

    li.innerHTML = `
      <span>${w.task}</span>
      <div class="actions">
        <strong>${hours} h</strong>
        <button class="editBtn" data-id="${w.id}">✏️</button>
        <button class="deleteBtn" data-id="${w.id}">❌</button>
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

  if (!task || !end) {
    alert("Izpolni podatke");
    return;
  }

  const payload = {
    task,
    started_at: start,
    ended_at: end
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

