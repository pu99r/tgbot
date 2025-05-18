// routes/appPostRoutes.js
const checkSubscription = require("../utils/checkSubscription");
const User = require("../models/User");
const projects = require("../tasks/tasks");
const getRandomPrize = require("../prize/Prize");

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

//помощник подписок
const checkSubscriptionsForUser = async (telegramId) => {
  const user = await User.findOne({ telegramId });
  if (!user) {
    // Если нужно, можно выбрасывать ошибку, пусть наверху ловится
    throw new Error("Пользователь не найден для checkSubscriptionsForUser");
  }

  const botToken = process.env.TELEGRAM_TOKEN;
  const tasksToShow = [];

  for (const project of projects) {
    // Если этот проект уже был выполнен, пропускаем
    if (user.complete.includes(project.shortName)) {
      continue;
    }

    // Проверяем, есть ли у проекта id (значит, нужно проверять подписку)
    if (project.id) {
      const isSubscribed = await checkSubscription(
        botToken,
        telegramId,
        project.id
      );
      if (isSubscribed) {
        // Пользователь подписан → добавляем проект в "complete"
        user.complete.push(project.shortName);

        // Начисляем награду
        switch (project.prize) {
          case "spins3":
            user.spins += 3;
            break;
          case "balance3":
            user.balance += 3;
            break;
          default:
            break;
        }
      } else {
        // Пользователь ещё не подписан → выводим этот проект
        tasksToShow.push({ ...project });
      }
    } else {
      // Если у проекта нет id, подписку не проверяем, просто выводим
      tasksToShow.push({ ...project });
    }
  }

  // Сохраняем обновлённые данные о пользователе
  await user.save();

  // Возвращаем список «незавершенных» заданий
  return tasksToShow;
};

//Получение доступных заданий для пользователя (сравнение с user.complete)
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
    // Вызываем чистую функцию
    const tasksToShow = await checkSubscriptionsForUser(telegramId);

    return res.status(200).json({ success: true, projects: tasksToShow });
  } catch (error) {
    console.error("Ошибка /tasks:", error);
    return res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера." });
  }
};

//Обновление количества спинов (вращений)
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

    if (user.spins <= 0) {
      return res.json({
        success: false,
        message: `Нет спинов`,
      });
    }

    // if (operation === "plus") { ... }
    if (operation === "minus") {
      user.spins -= 1;
      user.spentSpins += 1;
    }

    // Если 3 спина израсходовал — бонус рефереру
    if (user.spentSpins === 3) {
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        referrer.balance += 10;
        referrer.spins += 1;
        const referralToUpdate = referrer.referrals.find(
          (r) => r.user.toString() === user._id.toString()
        );
        if (referralToUpdate) {
          referralToUpdate.status = true;
        }
        await referrer.save();
      }
    }
    await user.save();

    // Выдаём приз
    const prize = await getRandomPrize(
      telegramId,
      user.spentSpins,
      user.offercomplete
    );

    return res.json({
      success: true,
      spins: user.spins,
      spentSpins: user.spentSpins,
      balance: user.balance,
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

//Добавление подарочного спина и установка даты регистрации
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

//Добавялет задачу или группу user.complete https://bestx.cam/update-complete/?telegramid=1370034279&group=group&name=name&status=status
const updateComplete = async (req, res) => {
  try {
    const { telegramid, group, name, status } = req.query;

    // Проверяем, что переданы обязательные параметры
    if (!telegramid || !group || !name || !status) {
      return res.status(400).json({
        success: false,
        message:
          "Необходимо передать параметры: telegramid, group, name, status",
      });
    }

    // Ищем пользователя по Telegram ID
    const user = await User.findOne({ telegramId: telegramid });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Пользователь не найден." });
    }

    // Преобразуем текущее содержимое offercomplete в массив объектов
    const currentOffers = user.offercomplete.map((item) => {
      try {
        return JSON.parse(item);
      } catch (err) {
        return null;
      }
    });

    // Пытаемся найти уже существующую запись
    const existingOffer = currentOffers.find(
      (o) => o && o.group === group && o.name === name
    );

    if (existingOffer) {
      // Обновляем status
      existingOffer.status = status;
    } else {
      // Если это новая запись, добавляем её в массив
      currentOffers.push({ group, name, status });
    }

    // Стрингифицируем все объекты обратно
    user.offercomplete = currentOffers.map((o) => JSON.stringify(o));

    await user.save();

    return res.json({
      success: true,
      message: "Запись обновлена/добавлена в offercomplete",
      offercomplete: user.offercomplete,
    });
  } catch (error) {
    console.error("Ошибка updateOfferComplete:", error);
    return res
      .status(500)
      .json({ success: false, message: "Внутренняя ошибка сервера." });
  }
};

//Все о пользователе
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

    // Сначала проверяем подписки (аналогично тому, что делает handleTask)
    await checkSubscriptionsForUser(telegramId);

    // Теперь находим пользователя и формируем ответ
    const user = await User.findOne({ telegramId }).populate(
      "referrals",
      "username"
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Пользователь не найден." });
    }

    // Ре-феральный код
    const userReferralCode = `ref_${user.telegramId}`;

    // Список приглашённых с их статусами
    const getAllReferrals = async (userDoc) => {
      return Promise.all(
        userDoc.referrals.map(async (referral) => {
          const { user: referralUserId, status } = referral;
          const referrerUser = await User.findById(referralUserId);
          if (referrerUser) {
            return {
              username: referrerUser.username,
              status: status,
            };
          }
          return null;
        })
      );
    };

    const referralList = await getAllReferrals(user);
    const linkForUser =
      user.webmaster === "alex"
        ? `https://justonesec.ru/stream/cpruearn204aa?cid=${user.click_id}&sub1=${user.telegramId}&sub2=prize`
        : `https://onesecgo.ru/stream/iphone_wbprize?cid=${user.click_id}&sub1=${user.telegramId}&sub2=prize`;

    return res.send({
      success: true,
      referralCode: userReferralCode,
      botUsername: process.env.BOT_USERNAME,
      spins: user.spins,
      registrationDate: user.registrationDate,
      balance: user.balance,
      referralList,
      spentSpins: user.spentSpins,
      link: linkForUser
    });
  } catch (error) {
    console.error("Ошибка /webapp-data:", error);
    res.status(500).json({
      success: false,
      message: "Внутренняя ошибка сервера.",
    });
  }
};

module.exports = {
  handleWebAppData,
  handleUpdateSpins,
  handleGift,
  handleTask,
  updateComplete,
};
