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
      // Регистрируем пользователя
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

    // Здесь убрана логика проверки подписки/активации
    // Вместо этого сразу отправляем основное сообщение
    await sendMainFunctionalityMessage(bot, chatId, user);
  } catch (error) {
    logger.error("Ошибка при обработке команды /start:", error);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже."
    );
  }
};

// -- ОТПРАВКА ОСНОВНОГО СООБЩЕНИЯ (ОСТАВЛЕНА ПО ПРОСЬБЕ) --
const sendMainFunctionalityMessage = async (bot, chatId, user, messageId = null) => {
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
• Спинов откручено: <b>${user.spentSpins || 0}</b>
• Дата реги: <b>${user.registrationDate || 0}</b>
• Задания: <b>${user.complete || 0}</b>
• Мэйн офферы: <b>${user.offercomplete || 0}</b>
• Баланс: <b>${user.balance || 0}</b>
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

// -- ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ --
const setupBotHandlers = (bot) => {
  // Обработка команды /start
  bot.onText(/\/start(?: (.+))?/, (msg, match) => {
    handleStart(bot, msg, match);
  });

  // Удалили логику callback_query, т.к. была завязана на подписку/активацию
};

module.exports = { setupBotHandlers, sendMainFunctionalityMessage };