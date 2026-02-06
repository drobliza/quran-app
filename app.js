const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// جعل مجلد المشروع ثابت (static)
app.use(express.static(__dirname));

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ سيرفر Express يعمل على: http://localhost:${PORT}`);
});
