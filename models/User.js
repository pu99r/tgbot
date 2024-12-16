// models/User.js
const mongoose = require("mongoose");

const formatDate = (date) => {
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(date.getDate())}:${pad(date.getMonth() + 1)}:${date.getFullYear()}_${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const UserSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, unique: true, required: true },
    username: { type: String, required: true },
    referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    spins: { type: Number },
    registrationDate: { 
      type: String, 
      default: () => formatDate(new Date()) // Формат: DD:MM:YYYY_HH:mm:ss
    },
    spentSpins: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Индексы
UserSchema.index({ telegramId: 1 });

module.exports = mongoose.model("User", UserSchema);