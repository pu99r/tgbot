const mongoose = require("mongoose");

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
    registrationDate: { type: Date, default: Date.now }, // Дата и время регистрации
    spentSpins: { type: Number, default: 0 }, // Количество потраченных спинов
  },
  { timestamps: true }
);

// Индексы
UserSchema.index({ telegramId: 1 });

module.exports = mongoose.model("User", UserSchema);
