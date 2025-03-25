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
    // Для отладки, если когда-то захотим жёстко указать группу/приз:
    let groupname = null;
    let nameingroupname = null;

    // Регулируемые шансы выпадения %
    const chances = {
      zero: 20,
      prize: 50,
      stars: 10,
      spin: 20,
    };

    // Регулируемые шансы выпадения разных звезд %
    const starChances = {
      star10: 70,
      star50: 20,
      star100: 10,
      star300: 0,
    };



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
      const gameSportOffers = parsedOffers.filter((o) => o.group === "gamesport");
      if (gameSportOffers.length) {
        const hasSale = gameSportOffers.some((offer) => offer.status === "subscribe");
        if (hasSale) {
          chances.zero = 40;
          chances.prize = 0;
          chances.stars = 20;
          chances.spin = 40;
          starChances.star10 = 100;
          starChances.star50 = 0;
          starChances.star100 = 0;
          starChances.star300 = 0;
        }

        const regOffers = gameSportOffers.filter((offer) => offer.status === "registration");
        if (regOffers.length) {
          const isIphoneReg = regOffers.some((offer) => offer.name === "iphone");
          const is5000Reg = regOffers.some((offer) => offer.name === "5.000");
          if (isIphoneReg && is5000Reg) {
            groupname = "gamesport";
            nameingroupname = Math.random() < 0.5 ? "iphone" : "5.000";
          } else if (isIphoneReg) {

            groupname = "gamesport";
            nameingroupname = "5.000";
          } else if (is5000Reg) {
            groupname = "gamesport";
            nameingroupname = "iphone";
          }
        }
      }
    }

    //рандомный приз
    if (spins >= 5) {
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

    const randomOffset = Math.floor(Math.random() * 8);
    const sign = Math.random() < 0.5 ? -1 : 1;
    degree += sign * randomOffset;
    console.log(selectedPrize.name)
    return { value: selectedPrize.name, degree, link: prizeLink };
  } catch (error) {
    console.error("Ошибка в getRandomPrize:", error);
    return null;
  }
};

module.exports = getRandomPrize;
