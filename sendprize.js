// sendHello.js
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");

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
      let photoPath;
      let buttonUrl = null;
      let buttonText = "Забрать приз";

      switch (priz) {
        case "5.000":
          message = `🎉 Поздравляем! 🎉\n\n💰 Вы выиграли возможность получить 5000₽! 💰`;
          photoPath = path.join(__dirname, "../img/5000.png");
          buttonUrl = "https://onesecgo.ru/stream/5000_wbprize";
          break;
        case "iphone":
          message = `🎉 Поздравляем! 🎉\n\n📱 Вы выиграли возможность получить iPhone 16 PRO! 📱`;
          photoPath = path.join(__dirname, "../img/iphone.png");
          buttonUrl = "https://onesecgo.ru/stream/iphone_wbprize";
          break;
        case "500":
          message = `🎉 Поздравляем! 🎉\n\n💳 Вы выиграли купон на 500₽ для пополнения в Wildberries! 💳\n\n📌 Где найти купон?\nОн уже ждет вас во вкладке с купонами.\n\n📋 Как получить промокод?\nОтправьте купон нашему менеджеру и получите свой уникальный промокод!\n\n🎁 Забирайте свой подарок прямо сейчас! 🎁`;
          photoPath = path.join(__dirname, "../img/5000.png");
          buttonUrl = null; // У приза 500 ссылки нет
          break;
        default:
          console.log(`Неизвестный приз: ${priz}`);
          return;
      }

      const replyMarkup = buttonUrl
        ? {
            inline_keyboard: [
              [
                {
                  text: buttonText,
                  url: buttonUrl,
                },
              ],
            ],
          }
        : undefined;

      if (!photoPath || !path.isAbsolute(photoPath)) {
        throw new Error("Некорректный путь к изображению: " + photoPath);
      }

      await bot.sendPhoto(telegramId, photoPath, {
        caption: message,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });

      console.log(`Сообщение с кнопкой и фото успешно отправлено пользователю с ID: ${telegramId}, приз: ${priz}`);
    }, 5000);
  } catch (error) {
    console.error(`Ошибка при отправке сообщения пользователю с ID: ${telegramId}`, error);
  }
};

module.exports = { sendHello };