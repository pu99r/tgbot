// sendHello.js
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

/**
 * Функция для отправки сообщения пользователю с указанием приза.
 * @param {number} telegramId - Telegram ID пользователя.
 * @param {string} priz - Приз, который будет указан в сообщении.
 */
const sendHello = async (telegramId, priz) => {
  try {
    if (priz === "0") {
      console.log(`Ничего не отправлено для пользователя с ID: ${telegramId}, так как приз: ${priz}`);
      return;
    }

    // Задержка на 5 секунд перед отправкой сообщения
    setTimeout(async () => {
      let message;

      switch (priz) {
        case "5000":
          message = `🎉 Поздравляем! 🎉\n\n💰 Вы выиграли возможность получить 5000₽! 💰\n\n<a href=\"https://onesecgo.ru/stream/5000_wbprize\">✨ Получить приз ✨</a>`;
          break;
        case "iphone":
          message = `🎉 Поздравляем! 🎉\n\n📱 Вы выиграли возможность получить iPhone 16 PRO! 📱\n\n<a href=\"https://onesecgo.ru/stream/iphone_wbprize\">✨ Получить приз ✨</a>`;
          break;
        case "500":
          message = `🎉 Поздравляем! 🎉\n\n💳 Вы выиграли купон на 500₽ для пополнения в Wildberries! 💳\n\n📌 Где найти купон?\nОн уже ждет вас во вкладке с купонами.\n\n📋 Как получить промокод?\nОтправьте купон нашему менеджеру и получите свой уникальный промокод!\n\n🎁 Забирайте свой подарок прямо сейчас! 🎁`;
          break;
        default:
          console.log(`Неизвестный приз: ${priz}`);
          return;
      }

      await bot.sendMessage(telegramId, message, { parse_mode: "HTML" });
      console.log(`Сообщение успешно отправлено пользователю с ID: ${telegramId}, приз: ${priz}`);
    }, 5000);
  } catch (error) {
    console.error(`Ошибка при отправке сообщения пользователю с ID: ${telegramId}`, error);
  }
};

module.exports = { sendHello };