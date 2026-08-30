function getCode() {
  return new URLSearchParams(window.location.search).get("code");
}

let joinMembers = [];
let selectedMemberId = null;

function renderMemberList() {
  const container = document.getElementById("joinMemberList");
  const query = (document.getElementById("joinSearch").value || "").trim().toLowerCase();

  const filtered = joinMembers.filter(m => {
    if (!query) return true;
    return m.first_name.toLowerCase().startsWith(query) || m.last_name.toLowerCase().startsWith(query);
  });

  container.innerHTML = filtered.length
    ? filtered.map(m => `
        <label class="participant-row">
          <input type="radio" name="joinMember" value="${m.id}" ${selectedMemberId === m.id ? "checked" : ""}>
          <span>${m.first_name} ${m.last_name}</span>
        </label>
      `).join("")
    : "<span>Ni ujemajočih se imen</span>";

  container.querySelectorAll('input[name="joinMember"]').forEach(radio => {
    radio.addEventListener("change", () => {
      selectedMemberId = Number(radio.value);
    });
  });
}

async function loadJoin() {
  const code = getCode();
  const info = document.getElementById("joinInfo");

  if (!code) {
    info.innerText = "Manjka registracijska koda v povezavi.";
    return;
  }

  const res = await fetch(`/api/users/join/${code}`);
  const data = await res.json();

  if (!res.ok) {
    info.innerText = data.message || "Registracijska povezava ni veljavna";
    return;
  }

  joinMembers = data.members || [];
  info.innerText = `${data.organization_name} — poišči svoje ime na seznamu`;
  document.getElementById("joinForm").classList.remove("hidden");

  renderMemberList();
}

document.getElementById("joinSearch").addEventListener("input", renderMemberList);
wirePasswordChecklist("joinPassword", "newPasswordChecklist");

document.getElementById("joinSubmitBtn").addEventListener("click", async () => {
  const code = getCode();
  const email = document.getElementById("joinEmail").value.trim();
  const password = document.getElementById("joinPassword").value;
  const confirmPassword = document.getElementById("joinPasswordConfirm").value;
  const err = document.getElementById("joinError");

  err.innerText = "";

  if (!selectedMemberId) {
    err.innerText = "Izberi svoje ime na seznamu";
    return;
  }

  if (!email) {
    err.innerText = "Vnesi email";
    return;
  }

  if (!isPasswordValid(password)) {
    err.innerText = "Geslo ne izpolnjuje vseh zahtev spodaj";
    return;
  }

  if (password !== confirmPassword) {
    err.innerText = "Gesli se ne ujemata";
    return;
  }

  const res = await fetch(`/api/users/join/${code}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ member_id: selectedMemberId, email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    err.innerText = data.message || "Napaka";
    return;
  }

  window.location.href = "/";
});

loadJoin();
