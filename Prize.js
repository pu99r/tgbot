const fs = require("fs").promises;
const path = require("path");
const User = require("./models/User");

const getRandomPrize = async (telegramId, spins) => {
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

  const filePath = path.join(__dirname, "codes.txt");
  let isCodesFileNotEmpty = false;

  try {
    const data = await fs.readFile(filePath, "utf8");
    const lines = data.split("\n").filter((line) => line.trim() !== "");
    isCodesFileNotEmpty = lines.length > 0;
  } catch (err) {
    console.error("Ошибка при проверке файла с кодами:", err);
  }

  const prizes = ["iphone", "10.000", "0"];
  if (isCodesFileNotEmpty) {
    prizes.push("500");
  }

  const priz = prizes[Math.floor(Math.random() * prizes.length)];
  const indices = round
    .map((value, index) => (value === priz ? index : -1))
    .filter((index) => index !== -1);
  const indexof = indices[Math.floor(Math.random() * indices.length)];

  if (priz === "500") {
    try {
      let data = await fs.readFile(filePath, "utf8");
      let lines = data.split("\n").filter((line) => line.trim() !== "");
      if (lines.length > 0) {
        const codeFromFile = lines.shift();
        await fs.writeFile(filePath, lines.join("\n"));
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