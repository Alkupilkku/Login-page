const container = document.getElementById("container");
const signInButton = document.getElementById("signIn");
const signUpButton = document.getElementById("signUp");
const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const message = document.getElementById("message");
const logoutButton = document.getElementById("logout");

signUpButton.addEventListener("click", () => {
  container.classList.add("right-panel-active");
});

signInButton.addEventListener("click", () => {
  container.classList.remove("right-panel-active");
});

async function sendForm(url, form) {
  const values = Object.fromEntries(new FormData(form));
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong");
  return result;
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const user = await sendForm("/api/signup", signupForm);
    showUser(user);
    signupForm.reset();
  } catch (error) {
    message.textContent = error.message;
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const user = await sendForm("/api/login", loginForm);
    showUser(user);
    loginForm.reset();
  } catch (error) {
    message.textContent = error.message;
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    if (!response.ok) throw new Error("Could not sign out");
    logoutButton.hidden = true;
    message.textContent = "You are signed out";
  } catch (error) {
    message.textContent = error.message;
  }
});

function showUser(user) {
  message.textContent = "Signed in as " + user.name;
  logoutButton.hidden = false;
}

fetch("/api/me")
  .then((response) => response.json())
  .then((user) => {
    if (user) showUser(user);
  })
  .catch(() => {});
