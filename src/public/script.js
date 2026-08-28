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
      loadWork();
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
  REGISTER FLOW
========================= */

function showRegister() {
  document.getElementById("login-box").classList.remove("active");
  document.getElementById("register-step1").classList.add("active");
}

function showLogin() {
  document.getElementById("register-step1").classList.remove("active");
  document.getElementById("register-step2").classList.remove("active");
  document.getElementById("login-box").classList.add("active");
}


// STEP 1
async function registerStep1() {
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value.trim();  

  const emailError = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");

  emailError.innerText = "";
  passwordError.innerText = "";
  if (!email) {
    emailError.innerText = "Vnesi email";
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailError.innerText = "Neveljaven email";
    return;
  }

  if (!password) {
    passwordError.innerText = "Vnesi geslo";
    return;
  }

  //preveri email
  const check = await fetch("/api/users/check-email", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    credentials: "include",
    body: JSON.stringify({ email })
  });

  const checkData = await check.json();

  if (checkData.exists) {    
    emailError.innerText = "Email je že uporabljen";
    return;
  }

  //če je ok nadaljuj na step1 API
  const res = await fetch("/api/users/register/step1", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    credentials: "include",
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const err = await res.json();
    alert(err.message || "Napaka");
    return;
  }

  document.getElementById("register-step1").classList.remove("active");
  document.getElementById("register-step2").classList.add("active");

  loadOrganizations();
  updateOrgModeUI();
}


/* =========================
  DRUŠTVA (register step2)
========================= */
async function loadOrganizations() {
  const select = document.getElementById("org-select");
  if (!select) return;

  try {
    const res = await fetch("/api/users/organizations", {
      credentials: "include"
    });

    const orgs = await res.json();

    select.innerHTML = orgs.length
      ? orgs.map(o => `<option value="${o.id}">${o.name}</option>`).join("")
      : `<option value="">Ni še nobenega društva</option>`;
  } catch (err) {
    console.error("LOAD ORGANIZATIONS ERROR:", err);
  }
}

function updateOrgModeUI() {
  const isJoin = document.getElementById("orgModeJoin").checked;

  document.getElementById("org-name").classList.toggle("hidden", isJoin);
  document.getElementById("org-select").classList.toggle("hidden", !isJoin);
}

document.getElementById("orgModeCreate")?.addEventListener("change", updateOrgModeUI);
document.getElementById("orgModeJoin")?.addEventListener("change", updateOrgModeUI);


// STEP 2
async function registerStep2() {
  const first_name = document.getElementById("first_name").value.trim();
  const last_name = document.getElementById("last_name").value.trim();
  const orgError = document.getElementById("orgError");

  orgError.innerText = "";

  if (!first_name || !last_name) {
    alert("Izpolni ime in priimek");
    return;
  }

  const org_mode = document.getElementById("orgModeJoin").checked ? "join" : "create";

  let org_name = "";
  let organization_id = "";

  if (org_mode === "create") {
    org_name = document.getElementById("org-name").value.trim();

    if (!org_name) {
      orgError.innerText = "Vnesi ime društva";
      return;
    }
  } else {
    organization_id = document.getElementById("org-select").value;

    if (!organization_id) {
      orgError.innerText = "Izberi društvo";
      return;
    }
  }

  const btn = document.getElementById("regStep2Btn");
  btn.innerText = "Ustvarjam...";

  const res = await fetch("/api/users/register/step2", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    credentials: "include",
    body: JSON.stringify({ first_name, last_name, org_mode, org_name, organization_id })
  });

  btn.innerText = "Zaključi registracijo";

  if (!res.ok) {
    const err = await res.json();
    console.log("REGISTER ERROR:", err);
    orgError.innerText = err.message || "Napaka";
    return;
  }

  checkAuth();
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

const emailInput = document.getElementById("reg-email");
const emailError = document.getElementById("emailError");

emailInput.addEventListener("blur", async () => {
  const email = emailInput.value.trim();

  if (!email) return;

  const res = await fetch("/api/users/check-email", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    credentials: "include",
    body: JSON.stringify({ email })
  });

  const data = await res.json();

  if (data.exists) {
    emailError.innerText = "Email že obstaja";
  } else {
    emailError.innerText = "";
  }
});

document.getElementById("loginForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  login(e);
});

document.getElementById("goRegister")?.addEventListener("click", showRegister);
document.getElementById("goLogin")?.addEventListener("click", showLogin);

document.getElementById("regStep1Btn")?.addEventListener("click", registerStep1);
document.getElementById("regStep2Btn")?.addEventListener("click", registerStep2);

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

