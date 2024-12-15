require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const TelegramBot = require("node-telegram-bot-api");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const {
  handleWebAppData,
  handleUpdateSpins,
} = require("./routes/appPostRoutes");
const { setupAdminHandlers } = require("./admin/adminHandlers");

const User = require("./models/User");
const app = express();

const port = process.env.PORT || 3000;
const CHANNEL_ID = process.env.CHANNEL_ID;
const requiredEnv = [
  "TELEGRAM_TOKEN",
  "BOT_USERNAME",
  "MONGODB_URL",
  "WEB_APP_URL",
  "CHANNEL_ID",
  "MAINCHANNEL",
  "OTZOVCHANNEL",
];
const missingEnv = requiredEnv.filter((env) => !process.env[env]);

if (missingEnv.length > 0) {
  console.error(
    `Ошибка: отсутствуют переменные окружения: ${missingEnv.join(", ")}`
  );
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("MongoDB подключена"))
  .catch((err) => {
    console.error("Ошибка подключения к MongoDB:", err);
    process.exit(1);
  });

app.use(cors());
app.use(express.json());

// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 минут
//   max: 100, // макс. 100 запросов с одного IP
//   message: "Слишком много запросов, попробуйте позже.",
// });
app.use(limiter);

app.post("/webapp-data", handleWebAppData);
app.post("/update-spins", handleUpdateSpins);

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
setupAdminHandlers(bot);

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username =
    msg.from.username ||
    `${msg.from.first_name || ""} ${msg.from.last_name || ""}`.trim();

  let referredBy = null;
  if (match[1] && match[1].startsWith("ref_")) {
    const referrerTelegramId = match[1].replace("ref_", "");
    const referrer = await User.findOne({ telegramId: referrerTelegramId });
    if (referrer) {
      referredBy = referrer._id;
      console.log(
        `Реферер найден: ${referrer.username} (ID: ${referrer.telegramId})`
      );
    } else {
      console.log("Реферер не найден");
    }
  }

  try {
    let user = await User.findOne({ telegramId: chatId });

    if (user) {
      let memberStatus;
      try {
        const res = await bot.getChatMember(CHANNEL_ID, chatId);
        memberStatus = res.status;
        console.log(`Статус пользователя ${chatId} в канале: ${memberStatus}`);
      } catch (err) {
        console.error("Ошибка при getChatMember:", err);
        memberStatus = "left";
      }

      if (["member", "administrator", "creator"].includes(memberStatus)) {
        await sendMainFunctionalityMessage(chatId, user);
      } else {
        await sendSubscriptionPrompt(chatId, user);
      }
    } else {
      user = new User({
        telegramId: chatId,
        username: username,
        referredBy: referredBy,
        spins: 3,
      });
      await user.save();
      console.log(`Новый пользователь создан: ${username} (ID: ${chatId})`);

      if (referredBy) {
        await User.findByIdAndUpdate(referredBy, {
          $push: { referrals: user._id },
          $inc: { spins: 1 },
        });
        console.log(
          `Пользователь ${username} добавлен в рефералы, spins реферера увеличено на 1`
        );
      }

      await sendSubscriptionPrompt(chatId, user);
    }
  } catch (error) {
    console.error("Ошибка при обработке команды /start:", error);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже."
    );
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  const callbackQueryId = query.id;

  console.log(
    `Получен callback_query: ${callbackQueryId} от пользователя ${query.from.id}`
  );

  if (data === "check_subscribe") {
    try {
      await bot.answerCallbackQuery(callbackQueryId, {
        text: "⚠️ Пожалуйста, ожидайте, мы проверяем!",
      });
      console.log(`Ответ на callback_query ${callbackQueryId} отправлен`);

      let memberStatus;
      try {
        const res = await bot.getChatMember(CHANNEL_ID, chatId);
        memberStatus = res.status;
        console.log(`Статус пользователя ${chatId} в канале: ${memberStatus}`);
      } catch (err) {
        console.error("Ошибка при getChatMember:", err);
        memberStatus = "left";
      }

      const user = await User.findOne({ telegramId: chatId });

      if (["member", "administrator", "creator"].includes(memberStatus)) {
        await sendMainFunctionalityMessage(chatId, user, messageId);
      } else {
        const newText = `
Увы, Вы не подписаны на наш Telegram-канал.

Подпишитесь и нажмите «Продолжить».
        `;
        const inlineKeyboard = [
          [
            {
              text: "Перейти на канал",
              url: "https://t.me/+78tt3taFIjA0Njky",
            },
          ],
          [
            {
              text: "Продолжить",
              callback_data: "check_subscribe",
            },
          ],
        ];

        try {
          await bot.deleteMessage(chatId, messageId);

          const imagePath = path.join(__dirname, "img", "pursh.jpg");
          await bot.sendPhoto(chatId, imagePath, {
            caption: newText,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: inlineKeyboard }
          });
        } catch (error) {
          console.error("Ошибка при отправке нового сообщения:", error);
        }
      }
    } catch (error) {
      console.error("Ошибка при обработке callback_query:", error);
      await bot.sendMessage(
        chatId,
        "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже."
      );
    }
  }
});

async function sendMainFunctionalityMessage(chatId, user, messageId = null) {

  if (messageId) {
    try {
      await bot.deleteMessage(chatId, messageId);
      console.log(`Сообщение с ID ${messageId} удалено.`);
    } catch (err) {
      console.error(`Ошибка при удалении сообщения с ID ${messageId}:`, err);
    }
  }
  try {
    const referralsCount = await User.countDocuments({ referredBy: user._id });
    const userReferralCode = `ref_${user.telegramId}`;
    const referralLink = `https://t.me/${process.env.BOT_USERNAME}?start=${userReferralCode}`;
    user.spins = user.spins || 0;
    await user.save();

    const webAppButton = {
      text: "Открыть приложение",
      web_app: { url: process.env.WEB_APP_URL },
    };

    const newsButton = {
      text: "Новости",
      url: process.env.MAINCHANNEL,
    };

    const reviewsButton = {
      text: "Отзывы",
      url: process.env.OTZOVCHANNEL,
    };

    const message = `
🎁 <b>Добро пожаловать, ${user.username}!</b>

Это <b>WB Рулетка</b> — первое Telegram-приложение для розыгрыша купонов на покупки в Wildberries!

🔗 <b>Ваша реферальная ссылка:</b>
<a href="${referralLink}">${referralLink}</a>

📊 <b>Статистика:</b>
• Рефералов: <b>${referralsCount}</b>
• Вращений: <b>${user.spins}</b>

Удачи и приятных покупок! 🍀
`;

    const replyMarkup = {
      inline_keyboard: [[webAppButton], [newsButton, reviewsButton]],
    };

    const imagePath = path.join(__dirname, "img", "main.jpg");

    await bot.sendPhoto(chatId, imagePath, {
      caption: message,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });

    console.log(
      `Основное сообщение с изображением отправлено пользователю ${chatId}.`
    );
  } catch (error) {
    console.error("Ошибка в sendMainFunctionalityMessage:", error);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже."
    );
  }
}

async function sendSubscriptionPrompt(chatId, user) {
  const welcomeText = `
👋 Добро пожаловать! Пройдите небольшую авторизацию в нашей лучшей Telegram-рулетке по WB.

1) Подпишитесь на наш новостной канал
2) Нажмите «Продолжить»
`;

  const inlineKeyboard = [
    [
      {
        text: "Перейти на канал",
        url: process.env.MAINCHANNEL,
      },
    ],
    [
      {
        text: "Продолжить",
        callback_data: "check_subscribe",
      },
    ],
  ];

  const imagePath = path.join(__dirname, "img", "pursh.jpg");

  try {
    await bot.sendPhoto(chatId, imagePath, {
      caption: welcomeText,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineKeyboard },
    });

    console.log(
      `Приветственное сообщение с изображением отправлено пользователю ${chatId}.`
    );
  } catch (error) {
    console.error(
      "Ошибка при отправке приветственного сообщения с подпиской:",
      error
    );
  }
}

app.use((req, res) => {
  res.status(404).send({ success: false, message: "Endpoint not found" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});