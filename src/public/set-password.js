function getToken() {
  return new URLSearchParams(window.location.search).get("token");
}

async function loadInvite() {
  const token = getToken();
  const info = document.getElementById("inviteInfo");

  if (!token) {
    info.innerText = "Manjka povezava (token) v URL-ju.";
    document.getElementById("activateBtn").disabled = true;
    return;
  }

  const res = await fetch(`/api/users/invite/${token}`);
  const data = await res.json();

  if (!res.ok) {
    info.innerText = data.message || "Povabilo ni veljavno";
    document.getElementById("activateBtn").disabled = true;
    return;
  }

  info.innerText = `${data.first_name} ${data.last_name} (${data.email})` +
    (data.organization_name ? ` — ${data.organization_name}` : "");
}

document.getElementById("activateBtn").addEventListener("click", async () => {
  const token = getToken();
  const password = document.getElementById("new-password").value.trim();
  const err = document.getElementById("passwordError");

  err.innerText = "";

  if (!password || password.length < 6) {
    err.innerText = "Geslo mora imeti vsaj 6 znakov";
    return;
  }

  const res = await fetch(`/api/users/invite/${token}/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password })
  });

  const data = await res.json();

  if (!res.ok) {
    err.innerText = data.message || "Napaka";
    return;
  }

  window.location.href = "/";
});

loadInvite();
