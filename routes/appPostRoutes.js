const User = require("../models/User");

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
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Пользователь не найден." });
    }

    const referralsCount = await User.countDocuments({ referredBy: user._id });
    const userReferralCode = `ref_${user.telegramId}`;

    res.send({
      success: true,
      referralCode: userReferralCode,
      botUsername: process.env.BOT_USERNAME,
      referralsCount,
      spins: user.spins,
    });
  } catch (error) {
    console.error("Ошибка /webapp-data:", error);
    res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера." });
  }
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

    if (operation === "plus") {
      user.spins += 1;
    } else {
      user.spins = Math.max(user.spins - 1, 0);
    }

    await user.save();

    return res.json({
      success: true,
      spins: user.spins,
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

module.exports = {
  handleWebAppData,
  handleUpdateSpins,
};