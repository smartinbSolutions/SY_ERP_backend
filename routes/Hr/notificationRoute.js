const express = require("express");
const router = express.Router();

const notificationController = require("../../controllers/Hr/notification.controller");
const authService = require("../../services/authService");
const staffAuthService = require("../../services/Hr/hrAuthServices");


router.get("/", staffAuthService.protectStaff, notificationController.getMyNotifications);

router.get(
  "/unread-count",
  staffAuthService.protectStaff,
  notificationController.getUnreadCount,
);

router.patch(
  "/:id/read",
  staffAuthService.protectStaff,
  notificationController.markAsRead,
);
router.patch(
  "/read-all",
  staffAuthService.protectStaff,
  notificationController.markAllAsRead
);

module.exports = router;
