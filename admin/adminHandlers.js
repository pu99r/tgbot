// admin/adminHandlers.js
const fs = require("fs");
const path = require("path");
const ADMIN_ID = 1370034279; // ваш админский ID
const User = require("../models/User");

const codesFilePath = path.join(__dirname, "../codes.txt");

// Флаги ожидания
let isWaitingForMessage = false; // для массовой рассылки
let isWaitingForCoupons = false; // для добавления купонов

const setupAdminHandlers = (bot) => {
  // Команда /stats — показывает общее число пользователей
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
  // Команда /mes — начать рассылку
  bot.onText(/\/mes/, async (msg) => {
    const chatId = msg.chat.id;
    if (chatId !== ADMIN_ID) {
      return bot.sendMessage(chatId, "У вас нет доступа к этой команде.");
    }

    isWaitingForMessage = true;
    await bot.sendMessage(
      chatId,
      "✉️ Введите сообщение для рассылки всем пользователям. " +
        "Вы можете добавить кнопку с ссылкой, указав:\n" +
        "`LinkTitle=ТекстКнопки`\n" +
        "`LinkUrl=https://...`\n\n" +
        "Для отмены введите <b>-</b>.",
      { parse_mode: "HTML" }
    );
  });
  // Общий обработчик сообщений
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    // Если сообщение от не-админа — пропускаем
    if (chatId !== ADMIN_ID) return;
    // Если текст начинается с "/", значит это другая команда
    if (msg.text && msg.text.startsWith("/")) return;

    // --- 1) Логика массовой рассылки ---
    if (isWaitingForMessage) {
      // Проверка на отмену
      if (msg.text && msg.text.trim() === "-") {
        isWaitingForMessage = false;
        return bot.sendMessage(chatId, "❌ Рассылка отменена.");
      }

      try {
        // Список пользователей
        const users = await User.find({}, "telegramId");
        let successCount = 0;

        // Если в сообщении есть фото (приоритетно обрабатываем фото)
        if (msg.photo && msg.photo.length > 0) {
          // Если хотим поддержать кнопку и при фото, нужно учитывать caption
          // Парсим caption для кнопки или текста
          const caption = msg.caption || "";

          // Для кнопок создаём переменные
          let linkTitle = null;
          let linkUrl = null;

          // Можно попробовать парсить caption по переносам строк
          const lines = caption.split("\n").map((line) => line.trim());
          // Соберём всё в отдельные переменные
          let finalCaption = [];

          for (const line of lines) {
            if (line.startsWith("LinkTitle=")) {
              linkTitle = line.replace("LinkTitle=", "").trim();
            } else if (line.startsWith("LinkUrl=")) {
              linkUrl = line.replace("LinkUrl=", "").trim();
            } else {
              finalCaption.push(line);
            }
          }

          // Собираем caption обратно в строку
          const messageText = finalCaption.join("\n");

          // Формируем опции для отправки
          const sendOptions = {
            parse_mode: "HTML",
          };

          // Если у нас есть и title, и url, добавляем inline-кнопку
          if (linkTitle && linkUrl) {
            sendOptions.reply_markup = {
              inline_keyboard: [
                [
                  {
                    text: linkTitle,
                    url: linkUrl,
                  },
                ],
              ],
            };
          }

          // Рассылаем фото
          for (const user of users) {
            try {
              await bot.sendPhoto(user.telegramId, msg.photo[msg.photo.length - 1].file_id, {
                caption: messageText,
                ...sendOptions,
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
        // Если есть только текст
        else if (msg.text) {
          // Парсим текст на предмет кнопки
          const lines = msg.text.split("\n").map((line) => line.trim());
          let linkTitle = null;
          let linkUrl = null;
          let finalTextLines = [];

          for (const line of lines) {
            if (line.startsWith("LinkTitle=")) {
              linkTitle = line.replace("LinkTitle=", "").trim();
            } else if (line.startsWith("LinkUrl=")) {
              linkUrl = line.replace("LinkUrl=", "").trim();
            } else {
              finalTextLines.push(line);
            }
          }

          const messageText = finalTextLines.join("\n");

          // Формируем опции для отправки
          const sendOptions = {
            parse_mode: "HTML",
          };

          // Если есть кнопка
          if (linkTitle && linkUrl) {
            sendOptions.reply_markup = {
              inline_keyboard: [
                [
                  {
                    text: linkTitle,
                    url: linkUrl,
                  },
                ],
              ],
            };
          }

          // Рассылаем
          for (const user of users) {
            try {
              await bot.sendMessage(user.telegramId, messageText, sendOptions);
              successCount++;
            } catch (error) {
              console.error(
                `Ошибка при отправке сообщения пользователю ${user.telegramId}:`,
                error
              );
            }
          }
        } else {
          // Если пришёл другой тип сообщения
          await bot.sendMessage(
            chatId,
            "Сейчас поддерживается рассылка только текста и фото. " +
              "Добавьте обработку, если хотите другие типы вложений."
          );
          return;
        }

        // Завершение рассылки
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
    }
    // --- 2) Логика добавления купонов ---
    else if (isWaitingForCoupons) {
      // Проверка на отмену
      if (msg.text && msg.text.trim() === "-") {
        isWaitingForCoupons = false;
        return bot.sendMessage(chatId, "❌ Добавление купонов отменено.");
      }

      try {
        // Берём строки из сообщения, убираем пустые
        const newCoupons = msg.text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "");

        if (newCoupons.length === 0) {
          return bot.sendMessage(
            chatId,
            "❌ Не найдено корректных купонов. Введите ещё раз или «-» для отмены."
          );
        }

        fs.appendFileSync(codesFilePath, "\n" + newCoupons.join("\n"));

        isWaitingForCoupons = false;
        await bot.sendMessage(
          chatId,
          `✅ Добавлено купонов: <b>${newCoupons.length}</b>`,
          { parse_mode: "HTML" }
        );
      } catch (error) {
        console.error("Ошибка при добавлении купонов:", error);
        bot.sendMessage(chatId, "Произошла ошибка при добавлении купонов.");
      }
    }
  });
  // Команда /plus для добавления спинов
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
        `✅ Пользователю с ID ${userId} добавлено ${spinsToAdd} спинов. Текущее количество: ${user.spins}.`
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