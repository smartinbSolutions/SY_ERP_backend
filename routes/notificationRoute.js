
const express = require("express");

const notificationController = require("../controllers/notificationController");
const authService = require("../services/authService");

const notificationRoute = express.Router();

notificationRoute.use(
  authService.protect,
  authService.checkPlanFeatures("crm"),
);

notificationRoute
  .route("/")
  .get(notificationController.getNotifications)
  .post(notificationController.createNotification);

notificationRoute
  .route("/unread-count")
  .get(notificationController.getUnreadCount);

notificationRoute
  .route("/read-all")
  .patch(notificationController.markAllNotificationsRead);

notificationRoute
  .route("/:id")
  .get(notificationController.getNotificationById)
  .patch(notificationController.updateNotification)
  .delete(notificationController.deleteNotification);

module.exports = notificationRoute;
