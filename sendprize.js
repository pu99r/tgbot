// sendprize.js
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

/**
 * Функция для отправки сообщения "Привет" пользователю.
 * @param {number} telegramId - Telegram ID пользователя.
 */
const sendHello = async (telegramId, priz) => {
  try {
    // Отправляем сообщение "Привет"
    await bot.sendMessage(telegramId, `${priz}`);
    console.log(`Сообщение "Привет" успешно отправлено пользователю с ID: ${telegramId}`);
  } catch (error) {
    console.error(`Ошибка при отправке сообщения пользователю с ID: ${telegramId}`, error);
  }
};

module.exports = { sendHello };
