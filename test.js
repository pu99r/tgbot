// test.js

require('dotenv').config(); // Загрузка переменных окружения из .env файла
const mongoose = require('mongoose');
const User = require('./models/User'); // Путь к вашей модели User

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Успешно подключено к MongoDB');
})
.catch((err) => {
  console.error('Ошибка подключения к MongoDB:', err);
  process.exit(1);
});

// Асинхронная функция для обновления даты регистрации
const updateRegistrationDate = async () => {
  try {
    const telegramId = 1370034279;
    const newDate = '25:12:2024_18:36:54';

    const user = await User.findOne({ telegramId });

    if (!user) {
      console.log(`Пользователь с telegramId = ${telegramId} не найден.`);
      return;
    }

    user.registrationDate = newDate;
    
    await user.save();

    console.log(`Дата регистрации для telegramId = ${telegramId} успешно обновлена на ${newDate}.`);
  } catch (error) {
    console.error('Ошибка при обновлении даты регистрации:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Запуск функции обновления
// updateRegistrationDate();

// Асинхронная функция для добавления рефералов
const addReferrals = async () => {
  try {
    const mainUserTelegramId = 1370034279;
    const mainUser = await User.findOne({ telegramId: mainUserTelegramId });

    if (!mainUser) {
      console.log(`Пользователь с telegramId = ${mainUserTelegramId} не найден.`);
      return;
    }

    // Генерация рефералов
    const referrals = [];
    for (let i = 1; i <= 20; i++) {
      const username = `referral_user_${i}`;
      const referral = new User({
        telegramId: mainUserTelegramId * 100 + i, // Уникальный telegramId для рефералов
        username,
        referredBy: mainUser._id,
      });
      await referral.save();
      referrals.push(referral._id);
    }

    // Обновление основного пользователя
    mainUser.referrals.push(...referrals);
    await mainUser.save();

    console.log('20 рефералов успешно добавлены.');
  } catch (error) {
    console.error('Ошибка при добавлении рефералов:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Запуск функции добавления рефералов
addReferrals();
