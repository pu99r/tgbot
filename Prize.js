const fs = require("fs").promises;
const path = require("path");
const User = require("./models/User");
const prizesData = require("./prizes");
const { sendHello } = require("./sendprize");

const chance0 = 0; // Выпадет 0
const chanceGroup2 = 50; // Выпадет 5000 или iphone
const chanceGroup3 = 50; // Выпадают звезды

// Проверяем сумму вероятностей
if (chance0 + chanceGroup2 + chanceGroup3 !== 100) {
  throw new Error("Сумма вероятностей должна быть 100!");
}

const round = [
  "iphone",
  "0",
  "10.000",
  "5.000",
  "0",
  "star100",
  "30.000",
  "0",
  "star200",
  "5.000",
  "0",
  "star300",
];

const getRandomPrize = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      console.error(`Пользователь с ID ${telegramId} не найден.`);
      return null;
    }
    const completedGroups = user.offercomplete || [];

    let selectedGroup = prizesData.find(
      (group) => !completedGroups.includes(group.group)
    );

    if (!selectedGroup) {
      if (prizesData.length > 0) {
        selectedGroup = prizesData[0];
      } else {
        console.error("Ошибка: отсутствуют призовые группы.");
        return null;
      }
    }

    const groupPrizes = selectedGroup.prizes.map((prize) => prize.name);
    const randomChance = Math.floor(Math.random() * 100) + 1;
    let prizeTypeGroup =
      randomChance <= chance0
        ? "0"
        : randomChance <= chance0 + chanceGroup2
        ? "group"
        : "star";

    let selectedPrize = { name: "0", link: null, caption: null };

    if (prizeTypeGroup === "star") {
      const group3 = ["star100", "star200", "star300"];
      selectedPrize.name = group3[Math.floor(Math.random() * group3.length)];
      let balanceToAdd = 0;
      switch (selectedPrize.name) {
        case "star100":
          balanceToAdd = 100;
          break;
        case "star200":
          balanceToAdd = 200;
          break;
        case "star300":
          balanceToAdd = 300;
          break;
      }
      if (balanceToAdd > 0) {
        user.balance += balanceToAdd;
        await user.save();
      }
    } else if (prizeTypeGroup === "group") {
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

    let firstOccurrenceIndex = round.indexOf(selectedPrize.name);

    let degree =
      firstOccurrenceIndex !== -1 ? firstOccurrenceIndex * 30 + 15 : 0;

    const sub1 = user.click_id;
    const sub2 = telegramId;
    let prizeLink = selectedPrize.link;
    if (prizeLink && prizeLink !== "none") {
      prizeLink = prizeLink
        .replace("{click_id}", encodeURIComponent(sub1))
        .replace("{telegram_id}", encodeURIComponent(sub2));
    } else {
      prizeLink = null;
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
