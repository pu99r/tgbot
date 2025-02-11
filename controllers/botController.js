// controllers/botController.js
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const User = require("../models/User");
const logger = require("../utils/logger");

const CHANNEL_ID = process.env.CHANNEL_ID;
async function activateUser(user) {
  if (!user.activated) {
    // Выдаём 3 спина самому пользователю
    user.spins = 3;
    user.activated = true;

    // Если есть реферер, даём ему +1 спин
    if (user.referredBy) {
      await User.findByIdAndUpdate(user.referredBy, {
        $push: { referrals: user._id },
        $inc: { spins: 1 },
      });
      logger.info(
        `Пользователь ${user.username} активирован, рефереру добавлен 1 спин`
      );
    }

    await user.save();
    logger.info(`Пользователь ${user.username} успешно активирован`);
  }
}

// -- ОСНОВНАЯ ФУНКЦИЯ /start --
const handleStart = async (bot, msg, match) => {
  const chatId = msg.chat.id;
  const username =
    msg.from.username ||
    `${msg.from.first_name || ""} ${msg.from.last_name || ""}`.trim();

  let referredBy = null;
  let clickId = "none";

  if (match[1]) {
    const params = match[1].split("_");
    if (params.length >= 2) {
      if (params[0] === "ref") {
        const referrerTelegramId = params[1];
        try {
          const referrer = await User.findOne({ telegramId: referrerTelegramId });
          if (referrer) {
            referredBy = referrer._id;
            logger.info(
              `Реферер найден: ${referrer.username} (ID: ${referrer.telegramId})`
            );
          } else {
            logger.warn("Реферер не найден");
          }
        } catch (error) {
          logger.error("Ошибка при поиске реферера:", error);
        }
      } else if (params[0] === "kt") {
        clickId = params[1];
        logger.info(`Click ID найден: ${clickId}`);
      }
    }
  }

  try {
    let user = await User.findOne({ telegramId: chatId });

    if (!user) {
      // Регистрируем пользователя
      user = new User({
        telegramId: chatId,
        username,
        referredBy,
        spins: 0, // без спинов — выдадим позже после проверки подписки
        activated: false, // специальный флаг, чтобы не выдавать спины повторно
        click_id: clickId, // Сохраняем click_id
      });
      await user.save();
      logger.info(`Новый пользователь создан: ${username} (ID: ${chatId})`);
    } else if (clickId !== "none" && user.click_id === "none") {
      // Обновляем click_id, если он ещё не был установлен
      user.click_id = clickId;
      await user.save();
      logger.info(`Click ID обновлён для пользователя ${username} (ID: ${chatId})`);
    }

    // Проверяем статус подписки
    let memberStatus;
    try {
      const res = await bot.getChatMember(CHANNEL_ID, chatId);
      memberStatus = res.status;
      logger.info(`Статус пользователя ${chatId} в канале: ${memberStatus}`);
    } catch (err) {
      logger.error("Ошибка при getChatMember:", err);
      memberStatus = "left";
    }

    if (["member", "administrator", "creator"].includes(memberStatus)) {
      // Пользователь уже подписан, активируем (если не активирован) и отправляем основное меню
      await activateUser(user);
      await sendMainFunctionalityMessage(bot, chatId, user);
    } else {
      // Пользователь не подписан — просим подписаться
      await sendSubscriptionPrompt(bot, chatId);
    }
  } catch (error) {
    logger.error("Ошибка при обработке команды /start:", error);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже."
    );
  }
};

// -- ОБРАБОТКА CALLBACK_QUERY --
const handleCallbackQuery = async (bot, query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  const callbackQueryId = query.id;

  logger.info(
    `Получен callback_query: ${callbackQueryId} от пользователя ${query.from.id}`
  );

  if (data === "check_subscribe") {
    try {
      // Ответ пользователю о том, что идёт проверка
      await bot.answerCallbackQuery(callbackQueryId, {
        text: "⚠️ Пожалуйста, ожидайте, мы проверяем!",
      });
      logger.info(`Ответ на callback_query ${callbackQueryId} отправлен`);

      let memberStatus;
      try {
        const res = await bot.getChatMember(CHANNEL_ID, chatId);
        memberStatus = res.status;
        logger.info(`Статус пользователя ${chatId} в канале: ${memberStatus}`);
      } catch (err) {
        logger.error("Ошибка при getChatMember:", err);
        memberStatus = "left";
      }

      const user = await User.findOne({ telegramId: chatId });

      if (!user) {
        // Теоретически такого быть не должно, но на всякий случай
        logger.warn(
          `Пользователь c ID ${chatId} не найден в базе при check_subscribe`
        );
        await bot.sendMessage(
          chatId,
          "Произошла ошибка. Попробуйте заново набрать /start."
        );
        return;
      }

      if (["member", "administrator", "creator"].includes(memberStatus)) {
        // Пользователь подписан — активируем (если ещё не активирован) и отправляем основное сообщение
        await activateUser(user);
        await sendMainFunctionalityMessage(bot, chatId, user, messageId);
      } else {
        // По-прежнему не подписан — удаляем старое сообщение и показываем заново
        const newText = `
Увы, Вы не подписаны на наш Telegram-канал.

Подпишитесь на канал и получите 3 спина на счет.

Подпишитесь и нажмите «Продолжить».
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

        try {
          // Удаляем предыдущее сообщение
          await bot.deleteMessage(chatId, messageId);

          const imagePath = path.join(__dirname, "../img", "pursh.png");
          await bot.sendPhoto(chatId, imagePath, {
            caption: newText,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: inlineKeyboard },
          });
        } catch (error) {
          logger.error("Ошибка при обновлении сообщения подписки:", error);
        }
      }
    } catch (error) {
      logger.error("Ошибка при обработке callback_query:", error);
      await bot.sendMessage(
        chatId,
        "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже."
      );
    }
  }
};

// -- ОТПРАВКА ОСНОВНОГО СООБЩЕНИЯ --
const sendMainFunctionalityMessage = async (
  bot,
  chatId,
  user,
  messageId = null
) => {
  // Если передан messageId, то удаляем старое сообщение
  if (messageId) {
    try {
      await bot.deleteMessage(chatId, messageId);
      logger.info(`Сообщение с ID ${messageId} удалено.`);
    } catch (err) {
      logger.error(`Ошибка при удалении сообщения ${messageId}:`, err);
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
🎉 <b>Добро пожаловать, ${user.username}!</b>

<b>WB Рулетка</b> — это ваш уникальный шанс выиграть одну из <b>тысячи бесплатных купонов</b> каждый день!  
Мы гарантируем прозрачность и честную статистику — <b>победит каждый участник</b>.

📢 <b>Не упустите возможность:</b>  
Делитесь своей реферальной ссылкой и получайте дополнительные вращения:  
<a href="${referralLink || "#"}">${referralLink || "Реферальная ссылка"}</a>  
• Приглашено друзей: <b>${referralsCount || 0}</b>
• Спины: <b>${user.spins || 0}</b>
• Дата реги: <b>${user.registrationDate || 0}</b>
• Спинов откручено: <b>${user.spentSpins || 0}</b>
• Мейн офферы: <b>${user.complete || 0}</b>
• Задания: <b>${user.offercomplete || 0}</b>
• Баланс: <b>${user.balance || 0}</b>
• Активировал подписку: <b>${user.activated || 0}</b>
• click_id: <b>${user.click_id || 0}</b>
🔥 Подарочные купоны ждут вас прямо сейчас! Начните игру и станьте одним из победителей! 🍀
`;

    const replyMarkup = {
      inline_keyboard: [[webAppButton], [newsButton, reviewsButton]],
    };

    const imagePath = path.join(__dirname, "../img", "main.png");

    await bot.sendPhoto(chatId, imagePath, {
      caption: message,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });

    logger.info(
      `Основное сообщение с изображением отправлено пользователю ${chatId}.`
    );
  } catch (error) {
    logger.error("Ошибка в sendMainFunctionalityMessage:", error);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже."
    );
  }
};

// -- ПРОСЬБА ПОДПИСАТЬСЯ --
const sendSubscriptionPrompt = async (bot, chatId) => {
  const welcomeText = `
🎉 <b>Добро пожаловать в WB Рулетку!</b>

Чтобы получить <b>3 БЕСПЛАТНЫХ ПРОКРУТА КОЛЕСА</b>, нужно подписаться на наш канал. 
Это ваш шанс выиграть отличные подарочные купоны на покупки.

🛡️ <b>Для активации:</b>
1️⃣ Подпишитесь на наш <b>новостной канал</b>, чтобы не пропустить важные обновления.
2️⃣ Нажмите кнопку <b>«Продолжить»</b>.

Это простой шаг, чтобы убедиться, что вы настоящий участник, а не бот.

🎁 <b>Не упустите свой шанс — начните выигрывать уже сегодня!</b> 🚀
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

  const imagePath = path.join(__dirname, "../img", "pursh.png");

  try {
    await bot.sendPhoto(chatId, imagePath, {
      caption: welcomeText,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineKeyboard },
    });

    logger.info(
      `Сообщение с просьбой подписаться отправлено пользователю ${chatId}.`
    );
  } catch (error) {
    logger.error("Ошибка при отправке приветственного сообщения:", error);
  }
};

// -- ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ --
const setupBotHandlers = (bot) => {
  // Обработка команды /start
  bot.onText(/\/start(?: (.+))?/, (msg, match) => {
    handleStart(bot, msg, match);
  });

  // Обработка callback_query
  bot.on("callback_query", (query) => {
    handleCallbackQuery(bot, query);
  });
};

module.exports = { setupBotHandlers };