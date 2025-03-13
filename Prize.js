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

    // Для отладки, если когда-то захотим жёстко указать группу/приз:
    let groupname = null;
    let nameingroupname = null;

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

    // Инициализация приза
    let selectedPrize = { name: "0", link: null, caption: null };
    let prizeLink = null;
    
    //расчет для каждого
    if (prizeType === "prize") {
      let finalPrizeData = null;
      if (groupname && nameingroupname) {
        const foundGroup = prizesData.find((g) => g.group === groupname);
        if (foundGroup) {
          // Ищем приз по имени внутри найденной группы
          const foundPrize = foundGroup.prizes.find(
            (p) => p.name === nameingroupname
          );
          if (foundPrize) {
            finalPrizeData = foundPrize; // Если всё совпало, сохраняем
          }
        }
      }
      if (!finalPrizeData) {
        const randomGroupIndex = Math.floor(Math.random() * prizesData.length);
        const randomGroup = prizesData[randomGroupIndex];
        const randomPrizeIndex = Math.floor(
          Math.random() * randomGroup.prizes.length
        );
        finalPrizeData = randomGroup.prizes[randomPrizeIndex];
      }
      if (finalPrizeData) {
        prizeLink = finalPrizeData.link
          .replace("{click_id}", encodeURIComponent(user.click_id))
          .replace("{telegram_id}", encodeURIComponent(user.telegramId));
        selectedPrize = {
          name: finalPrizeData.name,
          link: prizeLink,
          caption: finalPrizeData.caption,
        };
        await sendHello(
          user.telegramId,
          selectedPrize.name,
          selectedPrize.link,
          selectedPrize.caption
        );
      }
    }

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

    if (prizeType === "spin") {
      user.spins += 1;
      await user.save();
      selectedPrize.name = "spin";
    }

    //Расчет угла и отправка
    let Index0 = round.indexOf(selectedPrize.name);
    let degree = Index0 !== -1 ? 360 - Index0 * 30 : 0;
    console.log(selectedPrize)
    return { value: selectedPrize.name, degree, link: prizeLink };
  } catch (error) {
    console.error("Ошибка в getRandomPrize:", error);
    return null;
  }
};

module.exports = getRandomPrize;
