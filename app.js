const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./db");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "views")));

app.use(session({
  secret: "my-secret-key",
  resave: false,
  saveUninitialized: false
}));

function typeAyah(text){
  const ayahEl = document.getElementById("ayah");

  ayahEl.classList.remove("show"); // إزالة التأثير أولاً
  ayahEl.textContent = "";

  let i = 0;

  const interval = setInterval(() => {
    ayahEl.textContent += text.charAt(i);
    i++;

    if (i >= text.length) {
      clearInterval(interval);

      // 👇 هنا المكان الصحيح
      ayahEl.classList.add("show");
    }

  }, 35);
}

function saveAyah(){
  const text = document.getElementById("ayah").innerText;
  localStorage.setItem("savedAyah", text);
  alert("تم حفظ الآية ⭐");
}

function shareAyah(){
  const text = document.getElementById("ayah").innerText;
  if(navigator.share){
    navigator.share({
      title:"آية قرآنية",
      text:text
    });
  } else {
    alert("المشاركة غير مدعومة في هذا المتصفح");
  }
}

function toggleDark(){
  document.body.classList.toggle("dim");
}

function likeAyah(){
  alert("❤️ تم الإعجاب بالآية");
}


function playAudio(){
  count++;
  localStorage.setItem("count", count);
  console.log("عدد الاستماع:", count);
}

function dailyAyah(){
  const day = new Date().getDate();
  const list = moods[currentMood];
  const index = day % list.length;
  getAyah(list[index]);
}



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

