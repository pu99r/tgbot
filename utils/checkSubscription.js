// utils/checkSubscription.js

const fetch = require("node-fetch");

/**
 * Checks if a user is subscribed to a given channel.
 * @param {string} botToken - Your bot's token (e.g. process.env.BOT_TOKEN).
 * @param {number} userTelegramId - The Telegram ID of the user to check.
 * @param {string} channelId - The ID or username of the channel (e.g. "@channelname" or a numeric ID).
 * @returns {Promise<boolean>} - Returns true if user is subscribed; otherwise false.
 */
async function checkSubscription(botToken, userTelegramId, channelId) {
  const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${channelId}&user_id=${userTelegramId}`;
  try {
    const response = await fetch(url);
    const data = await response.json();

    // If request is successful and we have the result
    if (data.ok && data.result) {
      const membershipStatus = data.result.status;
      // Consider these statuses as "subscribed"
      if (["member", "administrator", "creator"].includes(membershipStatus)) {
        return true;
      }
    }
    // If data.ok is false or membership not in the set, return false
    return false;
  } catch (err) {
    console.error("Ошибка при проверке подписки:", err);
    return false;
  }
}

module.exports = checkSubscription;