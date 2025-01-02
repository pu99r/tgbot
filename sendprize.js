require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");

// Проверяем наличие токена
if (!process.env.TELEGRAM_TOKEN) {
  throw new Error("Токен Telegram отсутствует. Проверьте файл .env.");
}

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

const sendHello = async (telegramId, priz) => {
  try {
    if (!telegramId || !priz) {
      console.error("Некорректные параметры: telegramId или priz не указаны.");
      return;
    }

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
          photoPath = path.resolve(__dirname, "./img/5000.png");
          buttonUrl = "https://onesecgo.ru/stream/5000_wbprize";
          break;
        case "iphone":
          message = `🎉 Поздравляем! 🎉\n\n📱 Вы выиграли возможность получить iPhone 16 PRO! 📱`;
          photoPath = path.resolve(__dirname, "./img/iphone.png");
          buttonUrl = "https://onesecgo.ru/stream/iphone_wbprize";
          break;
        case "500":
          message = `🎉 Поздравляем! 🎉\n\n💳 Вы выиграли купон на 500₽ для пополнения в Wildberries!`;
          photoPath = path.resolve(__dirname, "./img/500.png");
          break;
        default:
          console.error(`Неизвестный приз: ${priz}`);
          return;
      }

      // Проверка пути к изображению
      if (!photoPath || !path.isAbsolute(photoPath)) {
        console.error(`Некорректный путь к изображению: ${photoPath}`);
        return;
      }

      // Проверка существования файла изображения
      const fs = require("fs");
      if (!fs.existsSync(photoPath)) {
        console.error(`Файл изображения не найден: ${photoPath}`);
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
        : {};

      // Отправка сообщения с изображением и кнопкой
      await bot.sendPhoto(telegramId, photoPath, {
        caption: message,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });

      console.log(`Сообщение с кнопкой и фото успешно отправлено пользователю с ID: ${telegramId}, приз: ${priz}`);
    }, 5000);
  } catch (error) {
    console.error(`Ошибка при отправке сообщения пользователю с ID: ${telegramId}`, error.message);
  }
};

module.exports = { sendHello };
