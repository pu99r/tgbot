const fs = require("fs").promises;
const path = require("path");
const User = require("./models/User");
const prizesData = require("./prizes");
const { sendHello } = require("./sendprize");

const round = [
  "prize", "0", "star10", "star300",
  "0", "star50", "prize", "spin",
  "star10", "star100", "0", "star50"
];

const getRandomPrize = async (telegramId) => {

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      console.error(`Пользователь с ID ${telegramId} не найден.`);
      return null;
    }

    // Регулируемые шансы выпадения %
    const chances = {
      zero: 25,
      prize: 25,
      stars: 25,
      spin: 25,
    };
    
    // Регулируемые шансы выпадения разных звезд %
    const starChances = {
      star10: 25,
      star50: 25,
      star100: 25,
      star300: 25,
    };

    const completedGroups = user.offercomplete || [];
    let selectedGroup = prizesData.find(group => !completedGroups.includes(group.group));

    if (!selectedGroup) {
      selectedGroup = prizesData.length > 0 ? prizesData[0] : null;
      if (!selectedGroup) {
        console.error("Ошибка: отсутствуют призовые группы.");
        return null;
      }
    }

    const groupPrizes = selectedGroup.prizes.map(prize => prize.name);
    const randomChance = Math.floor(Math.random() * 100) + 1;
    let prizeType;

    if (randomChance <= chances.zero) {
      prizeType = "0";
    } else if (randomChance <= chances.zero + chances.prize) {
      prizeType = "prize";
    } else if (randomChance <= chances.zero + chances.prize + chances.stars) {
      prizeType = "star";
    } else {
      prizeType = "spin";
    }

    let selectedPrize = { name: "0", link: null, caption: null };

    if (prizeType === "star") {
      const starPool = Object.entries(starChances).flatMap(([star, weight]) => Array(weight).fill(star));
      selectedPrize.name = starPool[Math.floor(Math.random() * starPool.length)];
      const balanceToAdd = parseInt(selectedPrize.name.replace("star", ""));
      user.balance += balanceToAdd;
      await user.save();
    } else if (prizeType === "prize") {
      const prizeName = groupPrizes[Math.floor(Math.random() * groupPrizes.length)];
      const prizeData = selectedGroup.prizes.find(p => p.name === prizeName);
      if (prizeData) {
        selectedPrize = {
          name: prizeData.name,
          link: prizeData.link,
          caption: prizeData.caption,
        };
      }
      
    } else if (prizeType === "spin") {
      user.spins += 1;
      await user.save();
      selectedPrize.name = "spin";
    }

    let firstOccurrenceIndex = round.indexOf(selectedPrize.name);
    let degree = firstOccurrenceIndex !== -1 ? 360 - (firstOccurrenceIndex * 30) : 0;

    let prizeLink = selectedPrize.link;
    if (prizeLink && prizeLink !== "none") {
      prizeLink = prizeLink
        .replace("{click_id}", encodeURIComponent(user.click_id))
        .replace("{telegram_id}", encodeURIComponent(telegramId));
    } else {
      prizeLink = null;
    }
    
    if (prizeType === "prize") {
      await sendHello(
        telegramId, 
        selectedPrize.name, 
        selectedPrize.link, 
        selectedPrize.caption
      );
    }

    return { value: selectedPrize.name, degree, link: prizeLink };
  } catch (error) {
    console.error("Ошибка в getRandomPrize:", error);
    return null;
  }
};

module.exports = getRandomPrize;