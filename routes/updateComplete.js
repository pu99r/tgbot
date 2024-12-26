// routes/updateComplete.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.get("/", async (req, res) => {
  try {
    const { telegramid, shortname } = req.query;

    if (!telegramid || !shortname) {
      throw new Error("Необходимо передать telegramId и shortName.");
    }

    console.log("Получен telegramId:", telegramid);
    console.log("Получен shortName:", shortname);

    const user = await User.findOne({ telegramId: telegramid });
    if (!user) {
      throw new Error("Пользователь не найден.");
    }

    if (!user.complete.includes(shortname)) {
      user.complete.push(shortname);
      await user.save();
    }

    // Отправляем JSON-ответ, если всё ОК
    return res.status(200).json({ status: "ok", message: "успех" });
  } catch (err) {
    // Возвращаем ошибку при любых проблемах
    return res.status(400).json({ status: "error", message: err.message });
  }
});

module.exports = router;
