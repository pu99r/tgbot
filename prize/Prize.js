// prize/Prize.js
const User = require("../models/User");
const prizesData = require("../tasks/prizes");
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

const getRandomPrize = async (telegramId, spins, offers) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      console.error(`Пользователь с ID ${telegramId} не найден.`);
      return null;
    }

    const gameSportGroupName =
      user.webmaster === "alex" ? "gamesport_alex" : "gamesport";
    // Для отладки, если когда-то захотим жёстко указать группу/приз:
    let groupname = null;
    let nameingroupname = null;

    // Регулируемые шансы выпадения %
    const chances = {
      zero: 20,
      prize: 50,
      star: 10,
      spin: 20,
    };

    // Регулируемые шансы выпадения разных звезд %
    const starChances = {
      star10: 70,
      star50: 20,
      star100: 10,
      star300: 0,
    };

    function getRandomByChance(chances) {
      const total = Object.values(chances).reduce((sum, val) => sum + val, 0);
      const rand = Math.random() * total;
      let cumulative = 0;

      for (const [key, value] of Object.entries(chances)) {
        cumulative += value;
        if (rand < cumulative) {
          return key;
        }
      }
    }
    // Тип приза
    let prizeType;
    if (spins == 1) {
      prizeType = "0";
    }
    if (spins == 2) {
      prizeType = "spin";
    }
    if (spins == 3) {
      prizeType = "star";
    }
    if (spins == 4) {
      prizeType = "prize";
    }

    if (offers && offers.length > 0 && spins >= 5) {
      const parsedOffers = offers.map((o) => JSON.parse(o));
      const gameSportOffers = parsedOffers.filter(
        (o) => o.group === gameSportGroupName
      );
      if (gameSportOffers.length) {
        const hasSale = gameSportOffers.some(
         (offer) => offer.status === "first_buy"
       );
        if (hasSale) {
          chances.zero = 40;
          chances.prize = 0;
          chances.star = 20;
          chances.spin = 40;
          starChances.star10 = 100;
          starChances.star50 = 0;
          starChances.star100 = 0;
          starChances.star300 = 0;
        }

        const regOffers = gameSportOffers.filter(
          (offer) => offer.status === "registration"
        );
        if (regOffers.length) {
          const isIphoneReg = regOffers.some(
            (offer) => offer.name === "iphone"
          );
          const is5000Reg = regOffers.some((offer) => offer.name === "5.000");
          if (isIphoneReg && is5000Reg) {
            groupname = gameSportGroupName;
            nameingroupname = Math.random() < 0.5 ? "iphone" : "5.000";
          } else if (isIphoneReg) {
            groupname = gameSportGroupName;
            nameingroupname = "5.000";
          } else if (is5000Reg) {
            groupname = gameSportGroupName;
            nameingroupname = "iphone";
          }
        }
      }
    }
    //рандомный приз
    if (spins >= 5) {
      prizeType = getRandomByChance(chances);
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
          const foundPrize = foundGroup.prizes.find(
            (p) => p.name === nameingroupname
          );
          if (foundPrize) {
            finalPrizeData = foundPrize;
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
      const selectedStar = getRandomByChance(starChances);
      const balanceToAdd = parseInt(selectedStar.replace("star", ""));
      user.balance += balanceToAdd;
      selectedPrize.name = selectedStar;
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

    const randomOffset = Math.floor(Math.random() * 8);
    const sign = Math.random() < 0.5 ? -1 : 1;
    degree += sign * randomOffset;
    return { value: selectedPrize.name, degree, link: prizeLink };
  } catch (error) {
    console.error("Ошибка в getRandomPrize:", error);
    return null;
  }
};

module.exports = getRandomPrize;
