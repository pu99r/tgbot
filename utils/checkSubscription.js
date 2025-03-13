// utils/checkSubscription.js

const https = require("https");

/**
 * Checks if a user is subscribed to a given channel.
 * @param {string} botToken - Your bot's token (e.g. process.env.BOT_TOKEN).
 * @param {number} userTelegramId - The Telegram ID of the user to check.
 * @param {string} channelId - The ID or username of the channel (e.g. "@channelname" or a numeric ID).
 * @returns {Promise<boolean>} - Returns true if user is subscribed; otherwise false.
 */
async function checkSubscription(botToken, userTelegramId, channelId) {
  const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${channelId}&user_id=${userTelegramId}`;

  // https://api.telegram.org/bot7688745445:AAE4cOnNWghqnlNN29I4oQy-XT8fa3Mi0jc/getChatMember?chat_id=21002265070330&user_id=1370034279

  // Оборачиваем https-запрос в Promise, чтобы использовать async/await
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let rawData = "";

      // Читаем входящие данные по кусочкам
      res.on("data", (chunk) => {
        rawData += chunk;
      });

      // Когда ответ полностью получен
      res.on("end", () => {
        try {
          const data = JSON.parse(rawData);

          // Если запрос успешен и есть результат
          if (data.ok && data.result) {
            const membershipStatus = data.result.status;
            // Подписан ли (member, administrator, creator)
            if (["member", "administrator", "creator"].includes(membershipStatus)) {
              return resolve(true);
            }
          }
          // Если статус не подходит или запрос не ok — возвращаем false
          resolve(false);
        } catch (err) {
          console.error("Ошибка при парсинге ответа:", err);
          resolve(false);
        }
      });
    }).on("error", (err) => {
      console.error("Ошибка при запросе:", err);
      resolve(false);
    });
  });
}

module.exports = checkSubscription;
