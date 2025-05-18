// models/User.js
const mongoose = require("mongoose");

const formatDate = (date) => {
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(date.getDate())}:${pad(date.getMonth() + 1)}:${date.getFullYear()}_${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const UserSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, unique: true, required: true }, // Телеграм ID
    username: { type: String, required: true }, // Телеграм ник
    referrals: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: { type: Boolean, default: false },
      },
    ],  // Все о рефераллах
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Кто привел
    registrationDate: {
      type: String,
      default: () => formatDate(new Date()),
    }, // Регистрация и обновление раз в 24 часа
    spins: { type: Number, default: 0 }, // спины на балнасе
    spentSpins: { type: Number, default: 0 }, // Сколько раз прокручено колесо
    balance: { type: Number, default: 0 }, // Баланс звезд
    complete: { type: [String], default: [] }, // Выполненные задания
    offercomplete: { type: [String], default: [] }, // Все об офферах на колесе
    click_id: { type: String, default: "none" }, //click_id из трекера
    webmaster: { type: String, default: "none" },
    s1: { type: String, default: null }, // доп1
    s2: { type: String, default: null }, // доп2
    s3: { type: String, default: null }, // доп3
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);