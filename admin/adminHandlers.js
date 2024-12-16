const ADMIN_ID = 1370034279;
const User = require("../models/User");

let isWaitingForMessage = false;

const setupAdminHandlers = (bot) => {
  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;

    if (chatId !== ADMIN_ID) {
      return bot.sendMessage(chatId, "У вас нет доступа к этой команде.");
    }

    try {
      const users = await User.find({}, "telegramId username");
      const userCount = users.length;

      const message = `👥 <b>Пользователи бота: ${userCount}</b>`;

      await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Ошибка при выполнении команды /stats:", error);
      bot.sendMessage(chatId, "Произошла ошибка при получении статистики.");
    }
  });

  bot.onText(/\/mes/, async (msg) => {
    const chatId = msg.chat.id;

    if (chatId !== ADMIN_ID) {
      return bot.sendMessage(chatId, "У вас нет доступа к этой команде.");
    }

    isWaitingForMessage = true;
    await bot.sendMessage(
      chatId,
      "✉️ Введите сообщение для рассылки всем пользователям. Для отмены введите <b>-</b>.",
      { parse_mode: "HTML" }
    );
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;

    if (chatId !== ADMIN_ID || !isWaitingForMessage || msg.text.startsWith("/"))
      return;

    const text = msg.text.trim();

    if (text === "-") {
      isWaitingForMessage = false;
      return bot.sendMessage(chatId, "❌ Рассылка отменена.");
    }

    try {
      const users = await User.find({}, "telegramId");
      let successCount = 0;

      for (const user of users) {
        try {
          await bot.sendMessage(user.telegramId, text, { parse_mode: "HTML" });
          successCount++;
        } catch (error) {
          console.error(
            `Ошибка при отправке пользователю ${user.telegramId}:`,
            error
          );
        }
      }

      isWaitingForMessage = false;
      await bot.sendMessage(
        chatId,
        `✅ Сообщение отправлено <b>${successCount}</b> пользователям.`,
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("Ошибка при выполнении массовой рассылки:", error);
      bot.sendMessage(chatId, "Произошла ошибка при выполнении рассылки.");
    }
  });

  bot.onText(/\/plus (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    // Проверка на администратора
    if (chatId !== ADMIN_ID) {
      return bot.sendMessage(chatId, "У вас нет доступа к этой команде.");
    }

    try {
      const userId = parseInt(match[1], 10); // ID пользователя
      const spinsToAdd = parseInt(match[2], 10); // Количество спинов для добавления

      if (isNaN(userId) || isNaN(spinsToAdd) || spinsToAdd <= 0) {
        return bot.sendMessage(
          chatId,
          "❌ Укажите корректный ID пользователя и положительное количество спинов."
        );
      }

      // Поиск пользователя в базе данных
      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        return bot.sendMessage(
          chatId,
          `❌ Пользователь с ID ${userId} не найден.`
        );
      }

      // Добавление спинов
      user.spins += spinsToAdd;
      await user.save();

      return bot.sendMessage(
        chatId,
        `✅ Пользователю с ID ${userId} добавлено ${spinsToAdd} спинов. Текущее количество спинов: ${user.spins}.`
      );
    } catch (error) {
      console.error("Ошибка при выполнении команды /plus:", error);
      return bot.sendMessage(
        chatId,
        "❌ Произошла ошибка при выполнении команды. Попробуйте снова."
      );
    }
  });
};

module.exports = { setupAdminHandlers };
