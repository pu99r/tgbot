const fs = require("fs").promises;
const path = require("path");
const User = require("./models/User");
const prizesData = require("./prizes");
const { sendHello } = require("./sendprize");

const round = [
  "prize",
  "0",
  "star10",
  "star300",
  "0",
  "star50",
  "prize",
  "spin",
  "star10",
  "star100",
  "0",
  "star50",
];

const getRandomPrize = async (telegramId, spins) => {
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

    // Тип приза
    let prizeType;
    const randomChance = Math.floor(Math.random() * 100) + 1;
    if (randomChance <= chances.zero) {
      prizeType = "0";
    } else if (randomChance <= chances.zero + chances.prize) {
      prizeType = "prize";
    } else if (randomChance <= chances.zero + chances.prize + chances.stars) {
      prizeType = "star";
    } else {
      prizeType = "spin";
    }

    // инициализация приза
    let selectedPrize = { name: "0", link: null, caption: null };

    const completedGroups = user.offercomplete || [];
    let selectedGroup = prizesData.find(
      (group) => !completedGroups.includes(group.group)
    );
    if (!selectedGroup) {
      selectedGroup = prizesData.length > 0 ? prizesData[0] : null;
      if (!selectedGroup) {
        console.error("Ошибка: отсутствуют призовые группы.");
        return null;
      }
    }
    console.log(selectedGroup)

    const groupPrizes = selectedGroup.prizes.map((prize) => prize.name);

    //Действия для кажого типа
    if (prizeType === "star") {
      const starPool = Object.entries(starChances).flatMap(([star, weight]) =>
        Array(weight).fill(star)
      );
      selectedPrize.name =
        starPool[Math.floor(Math.random() * starPool.length)];
      const balanceToAdd = parseInt(selectedPrize.name.replace("star", ""));
      user.balance += balanceToAdd;
      await user.save();
    }
    if (prizeType === "prize") {
      const prizeName =
        groupPrizes[Math.floor(Math.random() * groupPrizes.length)];
      const prizeData = selectedGroup.prizes.find((p) => p.name === prizeName);
      if (prizeData) {
        selectedPrize = {
          name: prizeData.name,
          link: prizeData.link,
          caption: prizeData.caption,
        };
      }
    }
    if (prizeType === "spin") {
      user.spins += 1;
      await user.save();
      selectedPrize.name = "spin";
    }
    if (prizeType === "prize") {
      let prizeLink = selectedPrize.link;
      prizeLink = prizeLink
        .replace("{click_id}", encodeURIComponent(user.click_id))
        .replace("{telegram_id}", encodeURIComponent(telegramId));
      await sendHello(
        telegramId,
        selectedPrize.name,
        prizeLink,
        selectedPrize.caption
      );
    }

    let Index0 = round.indexOf(selectedPrize.name);
    let degree = Index0 !== -1 ? 360 - Index0 * 30 : 0;
    return { value: selectedPrize.name, degree, link: prizeLink };
  } catch (error) {
    console.error("Ошибка в getRandomPrize:", error);
    return null;
  }
};

module.exports = getRandomPrize;
