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
updateRegistrationDate();
