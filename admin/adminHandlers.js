// admin/adminHandlers.js
const fs = require("fs");
const path = require("path");
const ADMIN_ID = 1370034279; // ваш админский ID
const User = require("../models/User");

// Путь к файлу с купонами
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
      "✉️ Введите сообщение для рассылки всем пользователям. Для отмены введите <b>-</b>.",
      { parse_mode: "HTML" }
    );
  });

  // Команда /coupons_list — показывает, сколько купонов осталось
  bot.onText(/\/coupons_list/, async (msg) => {
    const chatId = msg.chat.id;
    if (chatId !== ADMIN_ID) {
      return bot.sendMessage(chatId, "У вас нет доступа к этой команде.");
    }

    try {
      // Считываем файл codes.txt
      const data = fs.readFileSync(codesFilePath, "utf8");
      // Разбиваем по строкам и убираем пустые
      const coupons = data
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "");

      const count = coupons.length;
      await bot.sendMessage(
        chatId,
        `📄 В файле осталось купонов: <b>${count}</b>`,
        { parse_mode: "HTML" }
      );
    } catch (error) {
      console.error("Ошибка при чтении файла купонов:", error);
      bot.sendMessage(chatId, "Произошла ошибка при чтении файла купонов.");
    }
  });

  // Команда /coupons_plus — добавление новых купонов
  bot.onText(/\/coupons_plus/, async (msg) => {
    const chatId = msg.chat.id;
    if (chatId !== ADMIN_ID) {
      return bot.sendMessage(chatId, "У вас нет доступа к этой команде.");
    }

    isWaitingForCoupons = true;
    await bot.sendMessage(
      chatId,
      "✏️ Введите новые купоны (каждый на новой строке). Для отмены введите <b>-</b>.",
      { parse_mode: "HTML" }
    );
  });

  // Общий обработчик сообщений (и для рассылки, и для добавления купонов)
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;

    // Если сообщение от не-админа — выходим
    if (chatId !== ADMIN_ID) return;

    // Если начинается с "/", считаем, что это другая команда
    if (msg.text && msg.text.startsWith("/")) return;

    // --- 1) Логика массовой рассылки ---
    if (isWaitingForMessage) {
      if (msg.text && msg.text.trim() === "-") {
        // Отмена рассылки
        isWaitingForMessage = false;
        return bot.sendMessage(chatId, "❌ Рассылка отменена.");
      }

      try {
        // Список пользователей
        const users = await User.find({}, "telegramId");
        let successCount = 0;

        // Если в сообщении есть фото
        if (msg.photo && msg.photo.length > 0) {
          const largestPhoto = msg.photo[msg.photo.length - 1].file_id;
          const caption = msg.caption || ""; // подпись к фото

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
        // Если есть только текст
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

        // Если ничего не введено
        if (newCoupons.length === 0) {
          return bot.sendMessage(
            chatId,
            "❌ Не найдено корректных купонов. Введите ещё раз или «-» для отмены."
          );
        }

        // Добавляем в конец файла
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