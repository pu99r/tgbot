const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const fs = require("fs").promises;
require("dotenv").config();

if (!process.env.TELEGRAM_TOKEN) {
  throw new Error("Токен Telegram отсутствует. Проверьте файл .env.");
}

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

const sendHello = async (telegramId, prizeName, prizeLink, prizeCaption) => {
  try {
    if (!telegramId || !prizeName) {
      console.error("Некорректные параметры: telegramId или prizeName не указаны.");
      return;
    }

    // Если приз "0" – не отправляем ничего.
    if (prizeName === "0") {
      console.log(
        `Ничего не отправлено для пользователя с ID: ${telegramId}, так как приз: ${prizeName}.`
      );
      return;
    }

    // Задержка (10 секунд) перед отправкой сообщения
    setTimeout(async () => {
      const message = prizeCaption || "Поздравляем! Вы выиграли приз!";
      const buttonUrl = prizeLink && prizeLink !== "none" ? prizeLink : null;
      const buttonText = "Забрать приз";

      // Выбираем изображение по названию приза
      let photoPath;
      switch (prizeName) {
        case "5.000":
          photoPath = path.resolve(__dirname, "./img/5000.png");
          break;
        case "iphone":
          photoPath = path.resolve(__dirname, "./img/iphone.png");
          break;
        default:
          console.error(`Неизвестный приз: ${prizeName}`);
          return;
      }

      // Проверяем наличие файла изображения
      try {
        await fs.access(photoPath);
      } catch (err) {
        console.error(`Файл изображения не найден: ${photoPath}`);
        return;
      }

      // Разметка кнопки (если есть ссылка)
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

      // Отправка фото + сообщения
      await bot.sendPhoto(telegramId, photoPath, {
        caption: message,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });

      console.log(
        `Сообщение с кнопкой и фото успешно отправлено пользователю c ID: ${telegramId}, приз: ${prizeName}.`
      );
    }, 10000);
  } catch (error) {
    console.error(`Ошибка при отправке сообщения пользователю c ID: ${telegramId}:`, error.message);
  }
};

module.exports = { sendHello };
