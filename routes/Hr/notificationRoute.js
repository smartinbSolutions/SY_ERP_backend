const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/Hr/notification.controller");
const authService = require("../../services/authService");

router.get("/", authService.protect, notificationController.getMyNotifications);

router.get(
  "/unread-count",
  authService.protect,
  notificationController.getUnreadCount,
);

router.patch(
  "/:id/read",
  authService.protect,
  notificationController.markAsRead,
);

module.exports = router;
