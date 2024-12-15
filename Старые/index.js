//index.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const TelegramBot = require("node-telegram-bot-api");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const User = require("../models/User");

const app = express();
const port = process.env.PORT || 3000;

const requiredEnv = ["TELEGRAM_TOKEN", "MONGODB_URI", "WEB_APP_URL", "BOT_USERNAME"];
const missingEnv = requiredEnv.filter((env) => !process.env[env]);

if (missingEnv.length > 0) {
  console.error(`Ошибка: отсутствуют переменные окружения: ${missingEnv.join(", ")}`);
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("Ошибка подключения к MongoDB:", err);
    process.exit(1);
  });

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // макс. 100 запросов с одного IP
  message: "Слишком много запросов, попробуйте позже.",
});
app.use(limiter);

function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const userParam = params.get("user");
  if (!userParam) return null;
  return JSON.parse(decodeURIComponent(userParam));
}

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });


bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username =
    msg.from.username || `${msg.from.first_name || ""} ${msg.from.last_name || ""}`.trim();
  let referredBy = null;

  // Если пользователь стартует с /start ref_12345 — извлекаем telegramId реферера
  if (match[1]) {
    const refString = match[1].trim(); // например "ref_12345"
    console.log(`Получен реферальный код (строка): ${refString}`);

    if (refString.startsWith("ref_")) {
      const referrerTelegramId = refString.replace("ref_", "");
      const referrer = await User.findOne({ telegramId: referrerTelegramId });

      if (referrer) {
        referredBy = referrer._id;
        console.log(`Реферер найден: ${referrer.username} (ID: ${referrer.telegramId})`);
      } else {
        console.log("Реферер не найден");
      }
    } else {
      console.log("Неверный формат реферального кода");
    }
  }

  let user = await User.findOne({ telegramId: chatId });
  if (!user) {
    try {
      // Создаём нового пользователя
      user = new User({
        telegramId: chatId,
        username: username,
        referredBy: referredBy,
      });
      await user.save();
      console.log(`Новый пользователь создан: ${username} (ID: ${chatId})`);

      // Если есть реферер — добавляем текущего пользователя к его referrals и +1 spin рефереру
      if (referredBy) {
        await User.findByIdAndUpdate(referredBy, {
          $push: { referrals: user._id },
          $inc: { spins: 1 },
        });
        console.log(`Пользователь ${username} добавлен в рефералы, spins реферера увеличено на 1`);
      }
    } catch (error) {
      console.error("Ошибка при создании пользователя:", error);
      bot.sendMessage(chatId, "Произошла ошибка при регистрации. Попробуйте позже.");
      return;
    }
  } else {
    console.log(`Пользователь уже существует: ${username} (ID: ${chatId})`);
  }

  try {
    // Считаем число рефералов у текущего пользователя
    const referralsCount = await User.countDocuments({ referredBy: user._id });

    // Формируем динамический рефкод:
    const userReferralCode = `ref_${user.telegramId}`;

    // Формируем реферальную ссылку:
    const referralLink = `https://t.me/${process.env.BOT_USERNAME}?start=${userReferralCode}`;

    console.log(`Реферальная ссылка: ${referralLink}`);

    const webAppButton = {
      text: "Открыть приложение",
      web_app: { url: process.env.WEB_APP_URL },
    };

    const message = `Привет, ${username}! Добро пожаловать в наш бот.
Ваш реферальный код: <b>${userReferralCode}</b>
Количество рефералов: <b>${referralsCount}</b>
Количество вращений: <b>${user.spins}</b>
Ваша реферальная ссылка: <b>${referralLink}</b>`;

    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[webAppButton]],
      },
    });
    console.log("Сообщение отправлено успешно");
  } catch (err) {
    console.error("Ошибка при отправке сообщения:", err);
  }
});

app.post("/webapp-data", async (req, res) => {
  try {
    const { initData } = req.body;
    if (!initData) {
      return res.status(400).json({ success: false, message: "initData не передан." });
    }

    const userObj = parseInitData(initData);
    if (!userObj) {
      return res.status(400).json({ success: false, message: "Невалидный initData." });
    }

    const telegramId = userObj.id;
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ success: false, message: "Пользователь не найден." });
    }

    const referralsCount = await User.countDocuments({ referredBy: user._id });

    const userReferralCode = `ref_${user.telegramId}`;

    res.send({
      success: true,
      referralCode: userReferralCode,
      botUsername: process.env.BOT_USERNAME,
      referralsCount,
      spins: user.spins,
    });
  } catch (error) {
    console.error("Ошибка /webapp-data:", error);
    res.status(500).json({ success: false, message: "Внутренняя ошибка сервера." });
  }
});

app.post("/update-spins", async (req, res) => {
  try {
    const { initData, operation } = req.body;

    if (!initData || !operation) {
      return res
        .status(400)
        .json({ success: false, message: "Необходимо передать initData и operation (plus/minus)." });
    }

    if (!["plus", "minus"].includes(operation)) {
      return res
        .status(400)
        .json({ success: false, message: "operation должно быть 'plus' или 'minus'." });
    }

    const userObj = parseInitData(initData);
    if (!userObj) {
      return res.status(400).json({ success: false, message: "Невалидный initData." });
    }

    const telegramId = userObj.id;
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ success: false, message: "Пользователь не найден." });
    }

    if (operation === "plus") {
      user.spins += 1;
    } else {
      // ограничиваем, чтобы spins не уходил в минус
      user.spins = Math.max(user.spins - 1, 0);
    }

    await user.save();

    return res.json({
      success: true,
      spins: user.spins,
      message: `Spins успешно ${operation === "plus" ? "увеличены" : "уменьшены"}.`,
    });
  } catch (error) {
    console.error("Ошибка /update-spins:", error);
    return res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера." });
  }
});

app.use((req, res) => {
  res.status(404).send({ success: false, message: "Endpoint not found" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});