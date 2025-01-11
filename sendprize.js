// sendprize.js
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const fs = require("fs").promises;
require("dotenv").config();

// Проверяем наличие токена
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

    if (prizeName === "0") {
      console.log(`Ничего не отправлено для пользователя с ID: ${telegramId}, так как приз: ${prizeName}`);
      return;
    }

    // Задержка на 5 секунд перед отправкой сообщения
    setTimeout(async () => {
      let message = prizeCaption || "Поздравляем! Вы выиграли приз!";
      let photoPath;
      let buttonUrl = prizeLink && prizeLink !== "none" ? prizeLink : null;
      let buttonText = "Забрать приз";

      // Определяем путь к изображению на основе названия приза
      switch (prizeName) {
        case "5.000":
          photoPath = path.resolve(__dirname, "./img/5000.png");
          break;
        case "iphone":
          photoPath = path.resolve(__dirname, "./img/iphone.png");
          break;
        case "500":
          photoPath = path.resolve(__dirname, "./img/500.png");
          break;
        // Добавьте дополнительные случаи для других призов при необходимости
        default:
          console.error(`Неизвестный приз: ${prizeName}`);
          return;
      }

      // Проверка пути к изображению
      if (!photoPath || !path.isAbsolute(photoPath)) {
        console.error(`Некорректный путь к изображению: ${photoPath}`);
        return;
      }

      // Проверка существования файла изображения
      try {
        await fs.access(photoPath);
      } catch (err) {
        console.error(`Файл изображения не найден: ${photoPath}`);
        return;
      }

      // Формирование разметки кнопки, если ссылка предоставлена
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

      // Отправка фотографии с сообщением и кнопкой
      await bot.sendPhoto(telegramId, photoPath, {
        caption: message,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });

      console.log(`Сообщение с кнопкой и фото успешно отправлено пользователю с ID: ${telegramId}, приз: ${prizeName}`);
    }, 10000); // Задержка 5000 мс = 5 секунд
  } catch (error) {
    console.error(`Ошибка при отправке сообщения пользователю с ID: ${telegramId}:`, error.message);
  }
};

module.exports = { sendHello };