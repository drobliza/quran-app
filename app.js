const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = require("./db");

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be set and contain at least 32 characters.");
}

if (isProduction) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(express.static(path.join(__dirname, "views")));

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 4
    }
  })
);

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

function requireCsrf(req, res, next) {
  const token = req.body.csrfToken;
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).send("طلب غير صالح. أعد تحميل الصفحة وحاول مرة أخرى.");
  }
  next();
}

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function rateLimitLogin(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const username = String(req.body.username || "").trim().toLowerCase();
  const key = `${ip}:${username}`;
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    attempts.set(key, { firstAttempt: now, count: 1 });
    return next();
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - record.firstAttempt)) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).send("محاولات تسجيل دخول كثيرة. حاول مرة أخرى بعد قليل.");
  }

  record.count += 1;
  next();
}

function clearLoginAttempts(req) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const username = String(req.body.username || "").trim().toLowerCase();
  attempts.delete(`${ip}:${username}`);
}

function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/");
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views/login.html"));
});

app.get("/login-token", (req, res) => {
  res.json({ csrfToken: ensureCsrfToken(req) });
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views/register.html"));
});

app.post("/register", requireCsrf, async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!/^[A-Za-z0-9_\u0600-\u06FF]{3,30}$/.test(username)) {
    return res.redirect("/register?error=invalid_username");
  }

  if (password.length < 8 || password.length > 128) {
    return res.redirect("/register?error=weak_password");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    db.run(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword],
      function (err) {
        if (err) {
          if (err.code === "SQLITE_CONSTRAINT") {
            return res.redirect("/register?error=exists");
          }
          console.error("Registration error:", err);
          return res.status(500).send("حدث خطأ في الخادم.");
        }
        res.redirect("/?registered=1");
      }
    );
  } catch (err) {
    console.error("Password hashing error:", err);
    res.status(500).send("حدث خطأ في الخادم.");
  }
});

app.post("/login", requireCsrf, rateLimitLogin, (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!username || !password) {
    return res.redirect("/?error=1");
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, row) => {
    if (err) {
      console.error("Login database error:", err);
      return res.status(500).send("حدث خطأ في الخادم.");
    }

    const passwordHash = row ? row.password : await bcrypt.hash("dummy-password-for-timing", 12);
    const match = await bcrypt.compare(password, passwordHash);

    if (!row || !match) {
      return res.redirect("/?error=1");
    }

    clearLoginAttempts(req);

    req.session.regenerate((sessionError) => {
      if (sessionError) {
        console.error("Session regeneration error:", sessionError);
        return res.status(500).send("حدث خطأ في الخادم.");
      }

      req.session.loggedIn = true;
      req.session.username = row.username;
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");
      res.redirect("/quran");
    });
  });
});

app.get("/quran", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/quran.html"));
});

app.post("/logout", requireLogin, requireCsrf, (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Logout error:", err);
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
