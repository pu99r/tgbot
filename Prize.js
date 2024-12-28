const fs = require("fs").promises;
const path = require("path");
const User = require("./models/User");
const axios = require("axios");

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
  const prizes = ["iphone", "10.000", "500", "0"];

  let priz = null;

  try {
    const filePath = path.join(__dirname, "codes.txt");
    let data = await fs.readFile(filePath, "utf8");
    let lines = data.split("\n").filter((line) => line.trim() !== "");

    // Если файл пустой, удаляем "500" из возможных призов
    if (lines.length === 0) {
      priz = prizes.filter((p) => p !== "500")[
        Math.floor(Math.random() * (prizes.length - 1))
      ];
    } else {
      // Если файл не пуст, выбираем случайный приз
      priz = prizes[Math.floor(Math.random() * prizes.length)];

      if (priz === "500") {
        const codeFromFile = lines.shift(); // Берём первый код
        await fs.writeFile(filePath, lines.join("\n")); // Перезаписываем файл

        // Сохраняем код пользователю
        const user = await User.findOne({ telegramId });
        if (user) {
          user.codes.push(codeFromFile.trim());
          await user.save();
        }

        // Отправляем сообщение пользователю
        await sendTelegramMessage(telegramId, codeFromFile.trim());
      }
    }
  } catch (err) {
    console.error("Ошибка при обработке файла с кодами:", err);
    // Если ошибка, убираем "500" из возможных призов
    priz = prizes.filter((p) => p !== "500")[
      Math.floor(Math.random() * (prizes.length - 1))
    ];
  }

  const indices = round
    .map((value, index) => (value === priz ? index : -1))
    .filter((index) => index !== -1);
  const indexof = indices[Math.floor(Math.random() * indices.length)];

  return {
    value: priz,
    degree: indexof * 30 + 15,
  };
};

const sendTelegramMessage = async (telegramId, couponCode) => {
  const message = `
🎉 <b>Поздравляем!</b>

Вы стали счастливым обладателем уникального кода для пополнения Wildberries на <b>500₽</b>! 🎁

🚀 <b>Ваш уникальный купон:</b> <code>${couponCode}</code>

Чтобы получить свой код, отправьте этот купон нашему менеджеру. Вот ссылка для связи: <a href="https://t.me/mad_pug">@mad_pug</a>.

💡 <b>Важно:</b> Убедитесь, что вы пишете купон без ошибок, чтобы ускорить обработку!

Спасибо за участие, и удачи в дальнейших розыгрышах!
`;

  try {
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: telegramId,
      text: message,
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error("Ошибка при отправке сообщения в Telegram:", error);
  }
};
module.exports = getRandomPrize;


