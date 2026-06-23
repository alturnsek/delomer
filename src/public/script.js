let token = "";
let user = null;

// ---------- LOGIN ----------

async function login() {
  try {
    const res = await fetch('/api/users/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        email: document.getElementById('logEmail').value,
        password: document.getElementById('logPass').value
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return setStatus(data.error || "Login failed", false);
    }

    token = data.token;
    user = data.user;

    setStatus("✅ Login successful");

    showApp();
    loadWork();

  } catch (err) {
    setStatus("❌ Server error", false);
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
function logout() {
  token = "";
  user = null;

  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth').classList.remove('hidden');
}

// ---------- UI SWITCH ----------
function showApp() {
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  document.getElementById('welcome').innerText =
    "Welcome user ID: " + user.id;

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
  await fetch('http://localhost:3000/api/work', {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      task: task.value,
      started_at: start.value,
      ended_at: end.value
    })
  });

  loadWork();
}

// ---------- LOAD WORK ----------
async function loadWork() {
  const res = await fetch('http://localhost:3000/api/work', {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });

  const data = await res.json();

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

