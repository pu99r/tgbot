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
    telegramId: { type: Number, unique: true, required: true },
    username: { type: String, required: true },
    referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    spins: { type: Number, default: 0 },
    registrationDate: {
      type: String,
      default: () => formatDate(new Date()),
    },
    spentSpins: { type: Number, default: 0 },
    complete: { type: [String], default: [] },
    offercomplete: { type: [String], default: [] },
    balance: { type: Number, default: 0 },
    activated: { type: Boolean, default: false },
    click_id: { type: String, default: "none" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);