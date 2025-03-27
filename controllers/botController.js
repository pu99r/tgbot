// controllers/botController.js
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const User = require("../models/User");
const logger = require("../utils/logger");

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
      user = new User({
        telegramId: chatId,
        username,
        referredBy,
        spins: 0,
        click_id: clickId,
      });
      await user.save();
      logger.info(`Новый пользователь создан: ${username} (ID: ${chatId})`);

      const addReferral = async (referredBy, user) => {
        if (referredBy) {
          await User.findByIdAndUpdate(referredBy, {
            $push: { referrals: { user: user._id } },
          });
        }
      };
      if (referredBy) {
        await addReferral(referredBy, user);
      }
    }

    // Проверяем, подписан ли пользователь на основной канал
    let userSubbed = false;
    try {
      const member = await bot.getChatMember(process.env.MAINCHANNEL_ID, chatId);
      if (
        member.status === "member" ||
        member.status === "creator" ||
        member.status === "administrator"
      ) {
        userSubbed = true;
      }
    } catch (error) {
      // Ошибка при проверке подписки — например, если бот не админ в канале
      // или если канал закрыт. Логируем, чтобы не прерывать остальную логику.
      logger.error("Ошибка при проверке подписки:", error);
    }

    // 1. Отправляем главное сообщение
    await sendMainFunctionalityMessage(bot, chatId, user);

    // 2. Если пользователь не подписан, предлагаем подписаться и получить бонус
    if (!userSubbed && !user.complete.includes("MainChanel1")) {
      await sendBonusSubscriptionMessage(bot, chatId);
    }
  } catch (error) {
    logger.error("Ошибка при обработке команды /start:", error);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже."
    );
  }
};

// -- ОТПРАВКА ОСНОВНОГО СООБЩЕНИЯ --
const sendMainFunctionalityMessage = async (
  bot,
  chatId,
  user,
  messageId = null
) => {
  // Если передан messageId, то удаляем старое сообщение (если нужно)
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

    // 1. Парсим данные из offercomplete
    // Предполагаем, что каждый элемент хранится в JSON-строке вида {"group":"1","name":"name1","status":"reg"}
    // Если формат другой, подстроите парсинг
    let offercompleteInfo = "";
    if (Array.isArray(user.offercomplete) && user.offercomplete.length > 0) {
      // Преобразуем каждый элемент в объект
      const parsedOffers = user.offercomplete.map((item) => {
        try {
          return JSON.parse(item);
        } catch (err) {
          // Если парсить не удалось, просто возвращаем необработанную строку
          return { raw: item };
        }
      });

      // Формируем удобный для чтения список
      offercompleteInfo = parsedOffers
        .map((offer, index) => {
          // Если удалось распарсить как объект со структурой {group, name, status}
          if (offer.group && offer.name && offer.status) {
            return `   ${index + 1}. Группа: <b>${
              offer.group
            }</b>, Название: <b>${offer.name}</b>, Статус: <b>${
              offer.status
            }</b>`;
          } else if (offer.raw) {
            // Если это "сырые" данные, которые не удалось распарсить
            return `   ${index + 1}. (Не удалось распарсить) <b>${
              offer.raw
            }</b>`;
          }
          // На случай, если какой-то объект не по формату, но без поля raw
          return `   ${index + 1}. (Неизвестный формат) <b>${JSON.stringify(
            offer
          )}</b>`;
        })
        .join("\n");
    } else {
      offercompleteInfo = "Нет данных по офферам.";
    }

    // 2. Формируем текст сообщения
    const message1 = `
🎉 <b>Добро пожаловать, ${user.username}!</b>

<a href="${referralLink || "#"}">${referralLink || "Реферальная ссылка"}</a>
• Приглашено друзей: <b>${referralsCount || 0}</b>
• Спины: <b>${user.spins || 0}</b>
• Спинов откручено: <b>${user.spentSpins || 0}</b>
• Дата реги: <b>${user.registrationDate || "n/a"}</b>
• Задания: <b>${user.complete.join(", ") || "нет"}</b>
• Баланс: <b>${user.balance || 0}</b>
• click_id: <b>${user.click_id || 0}</b>

<b>Список офферов (offercomplete):</b>
${offercompleteInfo}
`.trim();

const message = `
🎉 <b>Добро пожаловать, ${user.username}!</b>

<b>Stars Wheel</b> — ваш шанс испытать удачу и выиграть <b>ценные призы</b> каждый день!  
🎁 Среди призов: Phone 16 Pro, AirPods Pro, Яндекс Алиса и <b>Telegram Stars</b> — внутренняя валюта Telegram!
Мы гарантируем честность, прозрачную статистику и шанс на победу для каждого участника.

📢 <b>Увеличьте свои шансы:</b>  
Делитесь реферальной ссылкой и получайте дополнительные вращения и звезды на баланс:  
<a href="${referralLink || "#"}">${referralLink || "Реферальная ссылка"}</a>  
• Приглашено друзей: <b>${referralsCount || 0}</b>

🚀 <b>Крутите колесо, собирайте звезды и выигрывайте ценные призы прямо сейчас!</b> 🍀
`.trim();
    // 3. Кнопки
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

    const manager = {
      text: "Менеджер",
      url: process.env.MANAGER,
    };

    const replyMarkup = {
      inline_keyboard: [[webAppButton], [manager], [newsButton, reviewsButton]],
    };

    // 4. Отправка изображения и сообщения
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

// -- ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ --
const setupBotHandlers = (bot) => {
  bot.onText(/\/start(?: (.+))?/, (msg, match) => {
    handleStart(bot, msg, match);
  });
  bot.on("callback_query", async (query) => {
    const { message, data, from } = query;
    const chatId = message.chat.id;
  
    if (data === "check_mainchannel_sub") {
      try {
        const member = await bot.getChatMember(process.env.MAINCHANNEL_ID, from.id);
  
        if (
          member.status === "member" ||
          member.status === "creator" ||
          member.status === "administrator"
        ) {
          const user = await User.findOne({ telegramId: chatId });
  
          // Проверка, чтобы не начислить повторно
          if (!user.complete.includes("MainChanel1")) {
            user.spins += 3;
            user.complete.push("MainChanel1");
            await user.save();
  
            await bot.deleteMessage(chatId, message.message_id);
            await bot.sendMessage(chatId, "✅ Спасибо за подписку! Вам начислено +3 спина.");
          } else {
            await bot.deleteMessage(chatId, message.message_id);
            await bot.answerCallbackQuery(query.id, {
              text: "⚠️ Вы уже получили бонус за подписку.",
              show_alert: true
            });
          }
        } else {
          await bot.answerCallbackQuery(query.id, {
            text: "Вы не подписались на канал. Пожалуйста, подпишитесь и попробуйте снова.",
            show_alert: true
          });
        }
      } catch (err) {
        logger.error("Ошибка при проверке подписки:", err);
        await bot.sendMessage(chatId, "⚠️ Не удалось проверить подписку. Попробуйте позже.");
      }
    }
  });
};
// -- БОНУС --
const sendBonusSubscriptionMessage = async (bot, chatId) => {
  const checkSubscriptionButton = {
    text: "✅ Проверить подписку",
    callback_data: "check_mainchannel_sub",
  };
  const channelButton = {
    text: "📢 Перейти в канал",
    url: process.env.MAINCHANNEL,
  };

  const replyMarkup = {
    inline_keyboard: [[channelButton], [checkSubscriptionButton]],
  };

  const message = `
<b>🎁 Получи +3 спина!</b>

Подпишись на наш <a href="${process.env.MAINCHANNEL}">новостной канал</a> и получи <b>3 спина</b> на баланс!

После подписки нажми "✅ Проверить подписку".
`;

  const sentMessage = await bot.sendMessage(chatId, message, {
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });

  return sentMessage.message_id;
};

module.exports = { setupBotHandlers, sendMainFunctionalityMessage, sendBonusSubscriptionMessage};
