//apppostroutes
const User = require("../models/User");
const projects = require('./tasks');
const getRandomPrize = require("../Prize");

const parseInitData = (initData) => {
  try {
    const params = new URLSearchParams(initData);
    const userParam = params.get("user");
    return userParam ? JSON.parse(decodeURIComponent(userParam)) : null;
  } catch (error) {
    console.error("Ошибка парсинга initData:", error);
    return null;
  }
};

const formatDate = (date) => {
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(date.getDate())}:${pad(
    date.getMonth() + 1
  )}:${date.getFullYear()}_${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
};

const handleUpdateSpins = async (req, res) => {
  try {
    const { initData, operation } = req.body;

    if (!initData || !operation) {
      return res.status(400).json({
        success: false,
        message: "Необходимо передать initData и operation (plus/minus).",
      });
    }

    if (!["plus", "minus"].includes(operation)) {
      return res.status(400).json({
        success: false,
        message: "operation должно быть 'plus' или 'minus'.",
      });
    }

    const userObj = parseInitData(initData);
    if (!userObj) {
      return res
        .status(400)
        .json({ success: false, message: "Невалидный initData." });
    }

    const telegramId = userObj.id;
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Пользователь не найден." });
    }

    let spinslef = user.spins
    // console.log(spinslef)
    if ( spinslef <= 0 ) {
      return res.json({
        success: false,
        message: `Нет спинов`,
      });
    }

    if (operation === "plus") {
      user.spins += 1;
    } else {
      if (user.spins > 0) {
        user.spentSpins += 1; 
      }
      user.spins = Math.max(user.spins - 1, 0);
    }

    await user.save();
    const spins = user.spentSpins
    const prize = await getRandomPrize(telegramId, spins);

    return res.json({
      success: true,
      spins: user.spins,
      spentSpins: user.spentSpins,
      prize: prize,
      message: `Spins успешно ${
        operation === "plus" ? "увеличены" : "уменьшены"
      }.`,
    });
  } catch (error) {
    console.error("Ошибка /update-spins:", error);
    return res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера." });
  }
};

const handleGift = async (req, res) => {
  try {
    const { initData } = req.body;

    if (!initData) {
      return res
        .status(400)
        .json({ success: false, message: "initData не передан." });
    }

    const userObj = parseInitData(initData);
    if (!userObj) {
      return res
        .status(400)
        .json({ success: false, message: "Невалидный initData." });
    }

    const telegramId = userObj.id;
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Пользователь не найден." });
    }

    // Обновление поля registrationDate
    user.registrationDate = formatDate(new Date());
    user.spins = (user.spins || 0) + 1;

    await user.save();

    return res.json({
      success: true,
      message: "Дата регистрации и количество вращений обновлены успешно.",
      registrationDate: user.registrationDate,
      spins: user.spins,
    });
  } catch (error) {
    console.error("Ошибка /plusgift:", error);
    return res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера." });
  }
};

const handleTask = async (req, res) => {
  try {
    const { initData } = req.body;

    if (!initData) {
      return res
        .status(400)
        .json({ success: false, message: "initData не передан." });
    }

    const userObj = parseInitData(initData);
    if (!userObj) {
      return res
        .status(400)
        .json({ success: false, message: "Невалидный initData." });
    }

    const telegramId = userObj.id;
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Пользователь не найден." });
    }

    const userComplete = user.complete || [];
    const filteredProjects = projects.filter((project) => {
      return !userComplete.some((completeText) =>
        completeText.includes(project.shortName)
      );
    });

    res.status(200).json({ success: true, projects: filteredProjects });
  } catch (error) {
    console.error("Ошибка /tasks:", error);
    res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера." });
  }
};

const updateComplete = async (req, res) => {
  try {
    const { telegramid, shortname } = req.query;

    // Проверяем, что все необходимые данные пришли
    if (!telegramid || !shortname) {
      return res
        .status(400)
        .json({ success: false, message: "Не переданы telegramid или shortname" });
    }

    // Ищем пользователя по Telegram ID
    const user = await User.findOne({ telegramId: telegramid });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Пользователь не найден." });
    }

    if (!user.complete.includes(shortname)) {
      user.complete.push(shortname);
      await user.save();
    }

    return res.json({
      success: true,
      message: `Shortname «${shortname}» успешно добавлен в complete.`,
      complete: user.complete,
    });
  } catch (error) {
    console.error("Ошибка /update-complete:", error);
    return res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера." });
  }
};

const handleWebAppData = async (req, res) => {
  try {
    const { initData } = req.body;
    if (!initData) {
      return res
        .status(400)
        .json({ success: false, message: "initData не передан." });
    }

    const userObj = parseInitData(initData);
    if (!userObj) {
      return res
        .status(400)
        .json({ success: false, message: "Невалидный initData." });
    }

    const telegramId = userObj.id;
    const user = await User.findOne({ telegramId }).populate("referrals", "username");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Пользователь не найден." });
    }

    const referralsCount = user.referrals.length;
    const userReferralCode = `ref_${user.telegramId}`;
    const allReferrals = user.referrals.map((ref) => ref.username); // Извлекаем только username рефералов

    res.send({
      success: true,
      referralCode: userReferralCode,
      botUsername: process.env.BOT_USERNAME,
      referralsCount,
      spins: user.spins,
      registrationDate: user.registrationDate,
      spentSpins: user.spentSpins,
      codes: user.codes,
      referralList: allReferrals, // Добавляем массив username рефералов
    });
  } catch (error) {
    console.error("Ошибка /webapp-data:", error);
    res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера." });
  }
};

module.exports = {
  handleWebAppData,
  handleUpdateSpins,
  handleGift,
  handleTask,
  updateComplete
};
