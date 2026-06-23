console.log("SCRIPT LOADED");

let token = "";
let user = null;



// ---------- LOGIN ----------
async function login() {
  try {
    const res = await fetch('/api/users/login', {
      method: 'POST',
      credentials: 'include', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('logEmail').value,
        password: document.getElementById('logPass').value
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return setStatus(data.error || "Login failed", false);
    }

    user = data.user;

    setStatus("Login successful");

    showApp();
    loadWork();

  } catch (err) {
    setStatus("Server error", false);
  }
}


// ---------- REGISTER ----------

async function register() {
  try {
    const res = await fetch('/api/users/register', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPass').value,
        first_name: document.getElementById('regFirst').value,
        last_name: document.getElementById('regLast').value
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return setStatus(data.error || "Register failed", false);
    }

    setStatus("✅ Registration successful");

  } catch (err) {
    setStatus("❌ Server error", false);
  }
}


// ---------- LOGOUT ----------
async function logout() {
  await fetch('/api/users/logout', {
    method: 'POST',
    credentials: 'include'
  });

  // reset UI
  user = null;

  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth').classList.remove('hidden');
}

// ---------- UI SWITCH ----------

function showApp() {
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  document.getElementById('welcome').innerText =
    "Welcome, " + user.first_name;

  setDefaultTime();
}

// ---------- DEFAULT TIME ----------
function setDefaultTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  document.getElementById('start').value =
    now.toISOString().slice(0,16);
}

// ---------- ADD WORK ----------
async function addWork() {
  const res = await fetch('/api/work', {    
        method: 'POST',
        credentials: 'include',
        headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      task: document.getElementById('task').value,
      started_at: document.getElementById('start').value,
      ended_at: document.getElementById('end').value
    })
  });

  const data = await res.json();
  console.log(data);
}

// ---------- LOAD WORK ----------
async function loadWork() {
  const res = await fetch('/api/work', {
    credentials: 'include'
  });

  const data = await res.json();
  console.log("DATA:", data);

  const table = document.getElementById('table');

  table.innerHTML = `
    <tr>
      <th>Name</th>
      <th>Task</th>
      <th>Start</th>
      <th>End</th>
      <th>Total</th>
    </tr>
  `;

  data.forEach(row => {
    const hours = (row.minutes / 60).toFixed(2);

    table.innerHTML += `
      <tr>
        <td>${row.first_name} ${row.last_name}</td>
        <td>${row.task}</td>
        <td>${new Date(row.started_at).toLocaleString()}</td>
        <td>${new Date(row.ended_at).toLocaleString()}</td>
        <td>${hours} h</td>
      </tr>
    `;
  });
}

function setStatus(message, success = true) {
  const el = document.getElementById('status');
  el.innerText = message;
  el.style.color = success ? 'lightgreen' : 'red';
}


document.getElementById('loginBtn')
  .addEventListener('click', login);

document.getElementById('registerBtn')
  .addEventListener('click', register);
  
document.getElementById('workBtn')
  .addEventListener('click', addWork);
  
document.getElementById('logoutBtn')
  .addEventListener('click', logout);


window.onload = async () => {
  try {
    const res = await fetch('/api/work', {
      credentials: 'include'
    });
    console.log("STATUS:", res.status);
    if (res.status === 401) {
      // ni loginan
      showAuth();
      return;
    }

    // vse ostalo (200 ali 304) = login OK
    showApp();
    loadWork();

  } catch (err) {
    console.error(err);
    showAuth();
  }
};



function showAuth() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth').classList.remove('hidden');
}
