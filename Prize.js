// Prize.js
const fs = require("fs").promises;
const path = require("path");
const User = require("./models/User");
const prizesData = require("./prizes"); // Импортируем данные из prizes.js
const { sendHello } = require("./sendprize"); // Убедитесь, что экспортируете sendHello корректно

const chance0 = 2; // Вероятность ничего не выиграть
const chance500 = 49; // Вероятность выиграть купон на 500₽
const chanceGroupPrize = 49; // Вероятность выиграть приз из группы

const round = [
  "iphone",
  "0",
  "10.000",
  "5.000",
  "0",
  "500",
  "30.000",
  "0",
  "500",
  "5.000",
  "0",
  "500",
];

const getRandomPrize = async (telegramId, spins) => {
  try {
    // Получаем пользователя
    const user = await User.findOne({ telegramId });
    if (!user) {
      console.error(`Пользователь с ID ${telegramId} не найден.`);
      return null;
    }
    const refweb = user.refweb;
    // Определяем, какие группы уже завершены
    const completedGroups = user.offercomplete || [];

    // Ищем первую не завершенную группу
    let selectedGroup = null;
    for (const group of prizesData) {
      if (!completedGroups.includes(group.group)) {
        selectedGroup = group;
        break;
      }
    }

    // Если все группы завершены, выбираем первую группу по умолчанию
    if (!selectedGroup) {
      selectedGroup = prizesData[0];
    }

    // Получаем все призы из выбранной группы
    const groupPrizes = selectedGroup.prizes.map(prize => prize.name);

    // Определяем тип приза на основе шансов
    const randomChance = Math.floor(Math.random() * 100) + 1; // Число от 1 до 100
    let prizeType = null;

    if (randomChance <= chance0) {
      prizeType = "0";
    } else if (randomChance <= chance0 + chance500) {
      prizeType = "500";
    } else {
      prizeType = "group";
    }

    let selectedPrize = null;

    if (prizeType === "0") {
      selectedPrize = {
        name: "0",
        link: null,
        caption: null
      };
    } else if (prizeType === "500") {
      // Приз "500" — купон на 500₽
      const codesFilePath = path.join(__dirname, "codes.txt");
      try {
        const data = await fs.readFile(codesFilePath, "utf8");
        const lines = data.split("\n").filter(line => line.trim() !== "");
        if (lines.length === 0) {
          console.log("Нет доступных кодов для приза 500. Выбираем другой приз.");
          // Если кодов нет, рекурсивно вызываем функцию для выбора другого приза
          return await getRandomPrize(telegramId, spins, refweb);
        }

        // Извлекаем первый доступный код
        const code = lines.shift();

        // Записываем оставшиеся коды обратно в файл
        await fs.writeFile(codesFilePath, lines.join("\n"));

        // Добавляем код пользователю
        user.codes.push(code.trim());
        await user.save();

        // Находим приз в выбранной группе, если он там есть
        const prizeData = selectedGroup.prizes.find(p => p.name === "500") || {
          name: "500",
          link: "none",
          caption: "🎉 Поздравляем! Вы выиграли купон на 500₽ для пополнения в Wildberries! 💳"
        };

        selectedPrize = {
          name: prizeData.name,
          link: prizeData.link,
          caption: prizeData.caption
        };
      } catch (err) {
        console.error("Ошибка при обработке файла codes.txt:", err);
        // В случае ошибки рекурсивно вызываем функцию для выбора другого приза
        return await getRandomPrize(telegramId, spins, refweb);
      }
    } else if (prizeType === "group") {
      // Приз из группы — выбираем случайный приз из выбранной группы
      const randomPrizeIndex = Math.floor(Math.random() * groupPrizes.length);
      const prizeName = groupPrizes[randomPrizeIndex];

      const prizeData = selectedGroup.prizes.find(p => p.name === prizeName);
      if (prizeData) {
        selectedPrize = {
          name: prizeData.name,
          link: prizeData.link,
          caption: prizeData.caption
        };
      } else {
        // Если приз не найден в группе, присваиваем "0"
        selectedPrize = {
          name: "0",
          link: null,
          caption: null
        };
      }
    }

    // Рассчитываем угол вращения на основе массива round
    const firstOccurrenceIndex = round.indexOf(selectedPrize.name);
    let degree = 0;
    if (firstOccurrenceIndex !== -1) {
      degree = firstOccurrenceIndex * 30 + 15;
    } else {
      // Если приз не найден в 'round', выбираем случайный угол
      degree = Math.floor(Math.random() * 360);
    }

    // Формируем ссылку с параметрами sub1 и sub2
    const sub1 = refweb || "none"; 
    const sub2 = telegramId;
    let prizeLink = selectedPrize.link;

    if (prizeLink && prizeLink !== "none") {
      prizeLink += `?sub1=${encodeURIComponent(sub1)}&sub2=${encodeURIComponent(sub2)}`;
    }

    // Отправляем сообщение пользователю
    await sendHello(telegramId, selectedPrize.name, prizeLink, selectedPrize.caption);

    return {
      value: selectedPrize.name,
      degree: degree,
      link: prizeLink,
    };
  } catch (error) {
    console.error("Ошибка в getRandomPrize:", error);
    return null;
  }
};

module.exports = getRandomPrize;