const authDiv = document.querySelector(".container");
const appDiv = document.getElementById("app");

const taskInput = document.getElementById("task");
const taskCount = document.getElementById("taskCount");

let workToDelete = null;
let editingWorkId = null;

/* =========================
   ✅ AUTH CHECK
========================= */
async function checkAuth() {
  try {
    const res = await fetch("/api/users/me", {
      credentials: "include"
    });

    const data = await res.json();

    const name = data.user.first_name || "uporabnik";
    document.getElementById("welcomeText").innerText =  `Pozdravljen/a, ${name}`;

    document.getElementById("start").value = getNowDateTime();
    document.getElementById("end").value = getNowDateTime();

    console.log("CHECK AUTH:", data);

    if (data.loggedIn && data.user) {
      authDiv.classList.add("hidden");
      appDiv.classList.remove("hidden");

      loadWork();
    } else {
      authDiv.classList.remove("hidden");
      appDiv.classList.add("hidden");
    }

  } catch (err) {
    console.error("AUTH ERROR:", err);
  } finally {
    // ✅ odstrani loading (najbolj pomembno)
    document.body.classList.remove("loading");
  }
}

checkAuth();


/* =========================
   ✅ LOGIN
========================= */


async function login(e) {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  const emailError = document.getElementById("loginEmailError");
  const passwordError = document.getElementById("loginPasswordError");
  const generalError = document.getElementById("loginGeneralError");

  // ✅ reset errors
  emailError.innerText = "";
  passwordError.innerText = "";
  generalError.innerText = "";

  let hasError = false;

  if (!email) {
    emailError.innerText = "Vnesi email";
    hasError = true;
  }

  if (!password) {
    passwordError.innerText = "Vnesi geslo";
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
    return;
  }

  location.reload();
}


/* =========================
   ✅ REGISTER FLOW
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
  console.log("STEP 1 CLICKED");
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value.trim();

  if (!email || !password) {
    alert("Izpolni vsa polja");
    return;
  }

  // ✅ preveri email
  const check = await fetch("/api/users/check-email", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    credentials: "include",
    body: JSON.stringify({ email })
  });

  const checkData = await check.json();

  if (checkData.exists) {
    alert("Ta email je že uporabljen");
    return;
  }

  // ✅ če je ok → nadaljuj na step1 API
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
}


// STEP 2
async function registerStep2() {
console.log("STEP 2 CLICKED ✅"); 


  const first_name = document.getElementById("first_name").value.trim();
  const last_name = document.getElementById("last_name").value.trim();

  if (!first_name || !last_name) {
    alert("Izpolni ime in priimek");
    return;
  }

  const btn = document.getElementById("regStep2Btn");
  btn.innerText = "Ustvarjam...";

  const res = await fetch("/api/users/register/step2", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    credentials: "include",
    body: JSON.stringify({ first_name, last_name })
  });

    
if (!res.ok) {
  const err = await res.json();
  console.log("REGISTER ERROR:", err);
  alert(err.message || "Napaka");
  return;
}
  btn.innerText = "Zaključi registracijo";

  if (!res.ok) {
    alert("Napaka pri registraciji");
    return;
  }
  



  checkAuth();
}


/* =========================
   ✅ WORK
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

  /* ✅ EDIT */
 
  document.querySelectorAll(".editBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const item = data.find(w => w.id == id);

      if (!item) return;

      document.getElementById("task").value = item.task;
      document.getElementById("start").value = formatDate(item.started_at);
      document.getElementById("end").value = formatDate(item.ended_at);

      
    // ✅ BONUS: posodobi števec
    document.getElementById("taskCount").innerText = `${item.task.length} / 255`;

      // ✅ EDIT MODE
      editingWorkId = item.id;

      const addBtn = document.getElementById("addWorkBtn");
      addBtn.innerText = "Uredi";
      addBtn.style.background = "#22c55e";

      document.querySelector(".work-form").classList.add("editing");
    });
  });


  /* ✅ DELETE (odpre modal) */

  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      workToDelete = btn.dataset.id;

      document.getElementById("confirmModal").classList.add("show");
    });
  });

}

/* =========================
   ✅ ADD WORK
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
    // ✅ EDIT MODE
    res = await fetch(`/api/work/${editingWorkId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
  } else {
    // ✅ CREATE MODE
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

  // ✅ reset forma
  resetForm();

  loadWork();
}



/* =========================
   ✅ LOGOUT
========================= */
async function logout() {
  await fetch("/api/users/logout", {
    method: "POST",
    credentials: "include"
  });

  location.reload();
}


/* =========================
   ✅ EVENT LISTENERS
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
document.getElementById("logoutBtn")?.addEventListener("click", logout);


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

  /* ✅ CONFIRM DELETE */
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
  document.getElementById("start").value = "";
  document.getElementById("end").value = "";

  // ✅ reset edit mode
  editingWorkId = null;

  // ✅ button nazaj
  const btn = document.getElementById("addWorkBtn");
  btn.innerText = "+ Dodaj";
  btn.style.background = "#4f46e5";

  // ✅ odstrani border
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
