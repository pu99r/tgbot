const fs = require("fs").promises;
const path = require("path");
const User = require("./models/User");
const prizesData = require("./prizes");
const { sendHello } = require("./sendprize");

const chance0 = 50;
const chanceGroup2 = 30;
const chanceGroup3 = 20;

// Проверяем сумму вероятностей
if (chance0 + chanceGroup2 + chanceGroup3 !== 100) {
  throw new Error("Сумма вероятностей должна быть 100!");
}

const round = [
  "iphone", "0", "10.000", "5.000", "0",
  "star100", "30.000", "0", "star200",
  "5.000", "0", "star300",
];

const getRandomPrize = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      console.error(`Пользователь с ID ${telegramId} не найден.`);
      return null;
    }
    const completedGroups = user.offercomplete || [];

    let selectedGroup = prizesData.find(group => !completedGroups.includes(group.group));

    if (!selectedGroup) {
      if (prizesData.length > 0) {
        selectedGroup = prizesData[0];
      } else {
        console.error("Ошибка: отсутствуют призовые группы.");
        return null;
      }
    }

    const groupPrizes = selectedGroup.prizes.map(prize => prize.name);
    const randomChance = Math.floor(Math.random() * 100) + 1;
    let prizeTypeGroup = randomChance <= chance0 ? "0"
                      : randomChance <= chance0 + chanceGroup2 ? "group"
                      : "star";

    let selectedPrize = { name: "0", link: null, caption: null };

    if (prizeTypeGroup === "star") {
      const group3 = ["star100", "star200", "star300"];
      selectedPrize.name = group3[Math.floor(Math.random() * group3.length)];
    } else if (prizeTypeGroup === "group") {
      const prizeName = groupPrizes[Math.floor(Math.random() * groupPrizes.length)];
      const prizeData = selectedGroup.prizes.find(p => p.name === prizeName);
      if (prizeData) {
        selectedPrize = { name: prizeData.name, link: prizeData.link, caption: prizeData.caption };
      }
    }

    let firstOccurrenceIndex = round.indexOf(selectedPrize.name);
    if (selectedPrize.name.startsWith("star")) {
      firstOccurrenceIndex = round.indexOf("star100");
    }

    let degree = firstOccurrenceIndex !== -1 ? firstOccurrenceIndex * 30 + 15 : 0;

    const sub1 = user.click_id;
    const sub2 = telegramId;
    let prizeLink = selectedPrize.link;
    if (!prizeLink || prizeLink === "none") {
      prizeLink = null;
    } else {
      prizeLink += `?sub1=${encodeURIComponent(sub1)}&sub2=${encodeURIComponent(sub2)}`;
    }

    // Отправляем приз пользователю
    // await sendHello(telegramId, selectedPrize.name, prizeLink, selectedPrize.caption);

    return { value: selectedPrize.name, degree, link: prizeLink };
  } catch (error) {
    console.error("Ошибка в getRandomPrize:", error);
    return null;
  }
};

module.exports = getRandomPrize;