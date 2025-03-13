// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const TelegramBot = require("node-telegram-bot-api");
const cors = require("cors");
const path = require("path");

const {
  handleWebAppData,
  handleUpdateSpins,
  handleGift,
  handleTask,
  updateComplete,
} = require("./routes/appPostRoutes");
const { setupAdminHandlers } = require("./admin/adminHandlers");
const { setupBotHandlers } = require("./controllers/botController");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 3000;
const REQUIRED_ENV = [
  "TELEGRAM_TOKEN",
  "BOT_USERNAME",
  "MONGODB_URL",
  "WEB_APP_URL",
  "MAINCHANNEL",
  "OTZOVCHANNEL"
];

// Проверка переменных окружения
const missingEnv = REQUIRED_ENV.filter((env) => !process.env[env]);
if (missingEnv.length > 0) {
  logger.error(
    `Ошибка: отсутствуют переменные окружения: ${missingEnv.join(", ")}`
  );
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URL, {
    maxPoolSize: 10, // до 10 подключений
  })
  .then(() => logger.info("MongoDB подключена"))
  .catch((err) => {
    logger.error("Ошибка подключения к MongoDB:", err);
    process.exit(1);
  });

const app = express();
app.use(cors());
app.use(express.json()); // Вместо bodyParser
app.use(express.static(path.join(__dirname, "public"))); // Если нужна статика

// Основные маршруты
app.post("/webapp-data", handleWebAppData);
app.post("/update-spins", handleUpdateSpins);
app.post("/plusgift", handleGift);
app.post("/tasks", handleTask);
app.get("/update-complete", updateComplete);

// Обработка 404
app.use((req, res) => {
  res.status(404).send({ success: false, message: "Endpoint not found" });
});

// Запускаем HTTP-сервер на PORT
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// Инициализируем бота без webHook.port
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });


// Приём запросов на /bot<token>, пробрасываем в бота
app.post(`/bot${bot.token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Подключаем обработчики бота
setupBotHandlers(bot);

// Подключаем админские обработчики
setupAdminHandlers(bot);