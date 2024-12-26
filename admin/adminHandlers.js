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
      "✉️ Введите сообщение для рассылки всем пользователям. " +
        "Для отмены введите <b>-</b>.",
      { parse_mode: "HTML" }
    );
  });

  // Общий обработчик сообщений
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;

    // Если сообщение от не-админа или мы не в режиме ожидания, выходим
    if (chatId !== ADMIN_ID || !isWaitingForMessage) return;

    // Если сообщение начинается с "/", значит это, скорее всего, другая команда — игнорируем
    if (msg.text && msg.text.startsWith("/")) return;

    // Проверка на отмену
    if (msg.text && msg.text.trim() === "-") {
      isWaitingForMessage = false;
      return bot.sendMessage(chatId, "❌ Рассылка отменена.");
    }

    // Пытаемся разослать сообщение всем
    try {
      // Список пользователей
      const users = await User.find({}, "telegramId");
      let successCount = 0;

      // Если в сообщении есть фото
      if (msg.photo && msg.photo.length > 0) {
        const largestPhoto = msg.photo[msg.photo.length - 1].file_id;
        const caption = msg.caption || ""; // подпись к фото (может быть пустой)

        for (const user of users) {
          try {
            await bot.sendPhoto(user.telegramId, largestPhoto, {
              caption: caption,
              parse_mode: "HTML",
            });
            successCount++;
          } catch (error) {
            console.error(
              `Ошибка при отправке фото пользователю ${user.telegramId}:`,
              error
            );
          }
        }
      }
      // Иначе, если есть текст
      else if (msg.text) {
        const text = msg.text;
        for (const user of users) {
          try {
            await bot.sendMessage(user.telegramId, text, {
              parse_mode: "HTML",
            });
            successCount++;
          } catch (error) {
            console.error(
              `Ошибка при отправке сообщения пользователю ${user.telegramId}:`,
              error
            );
          }
        }
      } else {
        // Если пришел другой тип сообщения (например, видео, документ) — можно дописать логику
        await bot.sendMessage(
          chatId,
          "Сейчас поддерживается рассылка только текста и фото. " +
            "Добавьте обработку, если хотите другие типы вложений."
        );
        return;
      }

      // Завершаем рассылку
      isWaitingForMessage = false;
      await bot.sendMessage(
        chatId,
        `✅ Сообщение(я) отправлены <b>${successCount}</b> пользователям.`,
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("Ошибка при выполнении массовой рассылки:", error);
      bot.sendMessage(chatId, "Произошла ошибка при выполнении рассылки.");
    }
  });

  // Команда /plus для добавления спинов (пример из вашего кода)
  bot.onText(/\/plus (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    if (chatId !== ADMIN_ID) {
      return bot.sendMessage(chatId, "У вас нет доступа к этой команде.");
    }

    try {
      const userId = parseInt(match[1], 10); // ID пользователя
      const spinsToAdd = parseInt(match[2], 10); // Количество спинов

      if (isNaN(userId) || isNaN(spinsToAdd) || spinsToAdd <= 0) {
        return bot.sendMessage(
          chatId,
          "❌ Укажите корректный ID пользователя и положительное количество спинов."
        );
      }

      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        return bot.sendMessage(
          chatId,
          `❌ Пользователь с ID ${userId} не найден.`
        );
      }

      user.spins += spinsToAdd;
      await user.save();

      return bot.sendMessage(
        chatId,
        `✅ Пользователю с ID ${userId} добавлено ${spinsToAdd} спинов. ` +
          `Текущее количество спинов: ${user.spins}.`
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