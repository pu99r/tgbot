// models/User.js
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
    spins: { type: Number, default: 3 },
  },
  { timestamps: true }
);

// Индексы
UserSchema.index({ telegramId: 1 });

module.exports = mongoose.model("User", UserSchema);