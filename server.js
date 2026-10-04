const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, "users.db"));
db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password TEXT NOT NULL)");

const sessions = new Map();
const sessionTime = 7 * 24 * 60 * 60 * 1000;
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function json(res, status, data, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(data));
}

function getCookie(req, name) {
  const item = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="));
  return item ? item.slice(name.length + 1) : "";
}

function currentUser(req) {
  const token = getCookie(req, "login_session");
  const session = sessions.get(token);
  if (!session) return null;
  if (session.until < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.user;
}

async function readJson(req) {
  if ((req.headers["content-type"] || "").toLowerCase().split(";")[0].trim() !== "application/json") {
    const error = new Error("Send JSON data");
    error.status = 415;
    throw error;
  }
  let body = "";
  req.setEncoding("utf8");
  for await (const part of req) {
    body += part;
    if (Buffer.byteLength(body) > 10000) {
      const error = new Error("Request is too big");
      error.status = 413;
      throw error;
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Bad JSON");
    error.status = 400;
    throw error;
  }
}

function cleanUser(row) {
  return { id: row.id, name: row.name, email: row.email };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/api/me") {
      return json(res, 200, currentUser(req));
    }

    if (req.method === "POST" && url.pathname === "/api/signup") {
      const data = await readJson(req);
      if (!data || typeof data !== "object" || Array.isArray(data)) return json(res, 400, { error: "Bad input" });
      const name = typeof data.name === "string" ? data.name.trim() : "";
      const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
      const password = typeof data.password === "string" ? data.password : "";
      if (!name || name.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || password.length < 6 || password.length > 128) {
        return json(res, 400, { error: "Enter a name, valid email and password with at least 6 characters" });
      }
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync(password, salt, 64).toString("hex");
      if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return json(res, 409, { error: "That email is already registered" });
      const result = db.prepare("INSERT INTO users (name, email, salt, password) VALUES (?, ?, ?, ?)").run(name, email, salt, hash);
      const user = { id: Number(result.lastInsertRowid), name, email };
      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, { user, until: Date.now() + sessionTime });
      return json(res, 201, user, { "Set-Cookie": `login_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` });
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const data = await readJson(req);
      if (!data || typeof data !== "object" || Array.isArray(data)) return json(res, 400, { error: "Bad input" });
      const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
      const password = typeof data.password === "string" ? data.password : "";
      const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (!row || !password || password.length > 128) return json(res, 401, { error: "Email or password is incorrect" });
      const hash = crypto.scryptSync(password, row.salt, 64);
      if (!crypto.timingSafeEqual(hash, Buffer.from(row.password, "hex"))) return json(res, 401, { error: "Email or password is incorrect" });
      const user = cleanUser(row);
      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, { user, until: Date.now() + sessionTime });
      return json(res, 200, user, { "Set-Cookie": `login_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` });
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      await readJson(req);
      sessions.delete(getCookie(req, "login_session"));
      return json(res, 200, { ok: true }, { "Set-Cookie": "login_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
    }

    const files = { "/": "index.html", "/index.html": "index.html", "/styles.css": "styles.css", "/script.js": "script.js" };
    if (req.method === "GET" && Object.hasOwn(files, url.pathname)) {
      const file = files[url.pathname];
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] });
      return fs.createReadStream(path.join(__dirname, file)).pipe(res);
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    return json(res, error.status || 500, { error: error.status ? error.message : "Server error" });
  }
});

server.listen(Number(process.env.PORT || 3000), "127.0.0.1", () => {
  console.log("Server running on http://localhost:" + (process.env.PORT || 3000));
});
