// getRandomPrize.js
const fs = require("fs").promises;
const path = require("path");
const User = require("./models/User");

const getRandomPrize = async (telegramId) => {
  const round = [
    "iphone",
    "0",
    "10.000",
    "30.000",
    "0",
    "500",
    "40.000",
    "0",
    "500",
    "10.000",
    "0",
    "500",
  ];
  const prizes = ["iphone", "40.000", "30.000", "10.000", "500", "0"];
//   const prizes = ["500"]; // <-- здесь выбирается, что именно может выпасть
  const priz = prizes[Math.floor(Math.random() * prizes.length)];

  const indices = round
    .map((value, index) => (value === priz ? index : -1))
    .filter((index) => index !== -1);
  const indexof = indices[Math.floor(Math.random() * indices.length)];

  // Если приз "500", то забираем код из файла codes.txt
  if (priz === "500") {
    try {
      const filePath = path.join(__dirname, "codes.txt");
      let data = await fs.readFile(filePath, "utf8");
      let lines = data.split("\n").filter((line) => line.trim() !== "");
      if (lines.length > 0) {
        const codeFromFile = lines.shift(); // берём первый код
        // перезаписываем файл, вырезав уже используемый код
        await fs.writeFile(filePath, lines.join("\n"));

        // Сохраняем код пользователю
        const user = await User.findOne({ telegramId });
        if (user) {
          user.codes.push(codeFromFile.trim());
          await user.save();
        }
      }
    } catch (err) {
      console.error("Ошибка при обработке файла с кодами:", err);
    }
  }

  return {
    value: priz,
    degree: indexof * 30 + 15,
  };
};

module.exports = getRandomPrize;