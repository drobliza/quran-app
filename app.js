const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./db");

const app = express();
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "my-secret-key",
  resave: false,
  saveUninitialized: false
}));

function requireLogin(req, res, next) {
  if (req.session.loggedIn) next();
  else res.redirect("/");
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views/login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, row) => {
    if (err) return res.send("خطأ في السيرفر");

    if (!row) return res.redirect("/?error=1");

    const match = await bcrypt.compare(password, row.password);

    if (match) {
      req.session.loggedIn = true;
      req.session.username = row.username;
      res.redirect("/quran");
    } else {
      res.redirect("/?error=1");
    }
  });
});

app.get("/quran", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "views/quran.html"));
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

