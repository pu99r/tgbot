require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const TelegramBot = require("node-telegram-bot-api");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const User = require("../models/User");

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
  "OTZOVCHANNEL"
];
const missingEnv = requiredEnv.filter((env) => !process.env[env]);

if (missingEnv.length > 0) {
  console.error(
    `Ошибка: отсутствуют переменные окружения: ${missingEnv.join(", ")}`
  );
  process.exit(1);
}

// Подключение к MongoDB без устаревших опций
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("MongoDB подключена"))
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

// Функция для парсинга initData из Web App
function parseInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const userParam = params.get("user");
    if (!userParam) return null;
    return JSON.parse(decodeURIComponent(userParam));
  } catch (error) {
    console.error("Ошибка парсинга initData:", error);
    return null;
  }
}

// Инициализация бота с использованием polling
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// ======= Обработчик команды /start =======
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username =
    msg.from.username ||
    `${msg.from.first_name || ""} ${msg.from.last_name || ""}`.trim();

  // Извлекаем реферальный код, если он есть
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
    // Проверяем, существует ли пользователь в базе данных
    let user = await User.findOne({ telegramId: chatId });

    if (user) {
      // Пользователь уже существует
      // Проверяем статус подписки
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
        // Пользователь подписан, отправляем основное сообщение
        await sendMainFunctionalityMessage(chatId, user);
      } else {
        // Пользователь не подписан, отправляем сообщение с предложением подписаться
        await sendSubscriptionPrompt(chatId, user);
      }
    } else {
      // Новый пользователь, создаём запись в базе данных
      user = new User({
        telegramId: chatId,
        username: username,
        referredBy: referredBy,
        spins: 0,
      });
      await user.save();
      console.log(`Новый пользователь создан: ${username} (ID: ${chatId})`);

      // Если есть реферер — добавляем текущего пользователя к его referrals и +1 spin рефереру
      if (referredBy) {
        await User.findByIdAndUpdate(referredBy, {
          $push: { referrals: user._id },
          $inc: { spins: 1 },
        });
        console.log(
          `Пользователь ${username} добавлен в рефералы, spins реферера увеличено на 1`
        );
      }

      // Отправляем приветственное сообщение с предложением подписаться
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

// ======= Функция отправки приветственного сообщения с предложением подписаться =======
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
        url: `${process.env.MAINCHANNEL}`, // ваша реальная ссылка на канал
      },
    ],
    [
      {
        text: "Продолжить",
        callback_data: "check_subscribe", // при нажатии - проверка подписки
      },
    ],
  ];

  try {
    // Отправляем сообщение и сохраняем message_id отправленного ботом сообщения
    const sentMessage = await bot.sendMessage(chatId, welcomeText, {
      reply_markup: { inline_keyboard: inlineKeyboard },
      parse_mode: "HTML", // если используете форматирование
    });

    // Можно сохранить sentMessage.message_id в базе данных, если нужно
    // Например, добавить поле в модель User для хранения message_id
    // Это опционально и зависит от вашей логики
  } catch (error) {
    console.error(
      "Ошибка при отправке приветственного сообщения с подпиской:",
      error
    );
  }
}

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
      // Немедленно ответить на callback-запрос
      await bot.answerCallbackQuery(callbackQueryId, {
        text: "⚠️ Пожалуйста, ожидайте, мы проверяем!",
      });
      console.log(`Ответ на callback_query ${callbackQueryId} отправлен`);

      // Проверяем статус подписки
      let memberStatus;
      try {
        const res = await bot.getChatMember(CHANNEL_ID, chatId);
        memberStatus = res.status;
        console.log(`Статус пользователя ${chatId} в канале: ${memberStatus}`);
      } catch (err) {
        console.error("Ошибка при getChatMember:", err);
        memberStatus = "left";
      }

      // Получаем пользователя из базы данных
      const user = await User.findOne({ telegramId: chatId });

      if (["member", "administrator", "creator"].includes(memberStatus)) {
        // Пользователь подписан, отправляем основное сообщение
        await sendMainFunctionalityMessage(chatId, user, messageId);
      } else {
        // Пользователь не подписан, обновляем сообщение с предложением подписаться
        const text = `
Увы, Вы не подписаны на наш Telegram-канал.

Подпишитесь и нажмите «Продолжить».
        `;
        const inlineKeyboard = [
          [
            {
              text: "Перейти на канал",
              url: "https://t.me/+78tt3taFIjA0Njky", // замените на вашу реальную ссылку
            },
          ],
          [
            {
              text: "Продолжить",
              callback_data: "check_subscribe", // можно оставить ту же callback_data
            },
          ],
        ];

        try {
          await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: inlineKeyboard },
            parse_mode: "HTML", // если используете форматирование
          });
          console.log(
            `Сообщение для пользователя ${chatId} обновлено с предложением подписаться.`
          );
        } catch (editError) {
          if (
            editError.response &&
            editError.response.body &&
            editError.response.body.description &&
            editError.response.body.description.includes(
              "message is not modified"
            )
          ) {
            // Игнорируем ошибку, если сообщение не изменилось
            console.log(
              "Попытка изменить сообщение на идентичное. Ошибка игнорирована."
            );
          } else {
            // Обработка других ошибок
            throw editError; // перекидываем ошибку в общий catch
          }
        }
      }
    } catch (error) {
      console.error("Ошибка при обработке callback_query:", error);
      // Проверяем, является ли ошибка "message is not modified"
      if (
        error.response &&
        error.response.body &&
        error.response.body.description &&
        error.response.body.description.includes("message is not modified")
      ) {
        // Не отправляем дополнительное сообщение пользователю
      } else {
        // В случае других ошибок уведомляем пользователя
        await bot.sendMessage(
          chatId,
          "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже."
        );
      }
    }
  }
});

async function sendMainFunctionalityMessage(chatId, user, messageId = null) {
    try {
      // Считаем число рефералов у текущего пользователя
      const referralsCount = await User.countDocuments({ referredBy: user._id });
  
      // Формируем динамический рефкод:
      const userReferralCode = `ref_${user.telegramId}`;
  
      // Формируем реферальную ссылку:
      const referralLink = `https://t.me/${process.env.BOT_USERNAME}?start=${userReferralCode}`;
  
      // Обновляем количество вращений, если необходимо
      user.spins = user.spins || 0;
      await user.save();
  
      // Кнопки
      const webAppButton = {
        text: "Открыть приложение",
        web_app: { url: process.env.WEB_APP_URL },
      };
  
      const newsButton = {
        text: "Новости",
        url: process.env.MAINCHANNEL, // Ссылка на основной канал
      };
  
      const reviewsButton = {
        text: "Отзывы",
        url: process.env.OTZOVCHANNEL, // Ссылка на канал отзывов
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
        inline_keyboard: [
          [webAppButton],
          [newsButton, reviewsButton]
        ],
      };
  
      if (messageId) {
        // Если messageId передан, редактируем существующее сообщение
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: replyMarkup,
        });
        console.log(
          `Сообщение для пользователя ${chatId} обновлено с основной функциональностью.`
        );
      } else {
        // Иначе отправляем новое сообщение
        await bot.sendMessage(chatId, message, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: replyMarkup,
        });
        console.log(`Основное сообщение отправлено пользователю ${chatId}.`);
      }
    } catch (error) {
      console.error("Ошибка в sendMainFunctionalityMessage:", error);
      await bot.sendMessage(
        chatId,
        "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже."
      );
    }
  }

app.post("/webapp-data", async (req, res) => {
  try {
    const { initData } = req.body;
    if (!initData) {
      return res
        .status(400)
        .json({ success: false, message: "initData не передан." });
    }

    const userObj = parseInitData(initData);
    if (!userObj) {
      return res
        .status(400)
        .json({ success: false, message: "Невалидный initData." });
    }

    const telegramId = userObj.id;
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Пользователь не найден." });
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
    res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера." });
  }
});

app.post("/update-spins", async (req, res) => {
  try {
    const { initData, operation } = req.body;

    if (!initData || !operation) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Необходимо передать initData и operation (plus/minus).",
        });
    }

    if (!["plus", "minus"].includes(operation)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "operation должно быть 'plus' или 'minus'.",
        });
    }

    const userObj = parseInitData(initData);
    if (!userObj) {
      return res
        .status(400)
        .json({ success: false, message: "Невалидный initData." });
    }

    const telegramId = userObj.id;
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Пользователь не найден." });
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
      message: `Spins успешно ${
        operation === "plus" ? "увеличены" : "уменьшены"
      }.`,
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
