const Notification = require("../../models/Notification/Notification");
const { getIo } = require("../../utils/socket");


exports.createNotification = async ({
  companyId,
  recipientId,
  actorId = null,
  type,
  title,
  message,
  entityType = null,
  entityId = null,
  metadata = {},
  idempotencyKey,
}) => {
  if (!companyId) {
    throw new Error("Notification companyId is required");
  }

  if (!recipientId) {
    throw new Error("Notification recipientId is required");
  }

  if (!type || !title || !message) {
    throw new Error("Notification type, title and message are required");
  }

  const notificationData = {
    companyId,
    recipientId,
    actorId,
    type,
    title,
    message,
    entityType,
    entityId,
    metadata,
    isRead: false,
  };

  // Used by the activity reminder cron to prevent duplicate reminders.
  if (idempotencyKey) {
    notificationData.idempotencyKey = idempotencyKey;
  }

  let notification;

  try {
    notification = await Notification.create(notificationData);
  } catch (error) {
    // A reminder with this key has already been created.
    if (idempotencyKey && error.code === 11000) {
      return null;
    }

    throw error;
  }

  try {
    const roomName = `user:${recipientId.toString()}`;
    const socketServer = getIo();

    socketServer
      .to(roomName)
      .emit("notification:new", notification.toObject());
  } catch (error) {
    // Realtime delivery failure does not affect notification creation.
  }

  return notification;
};

exports.getNotifications = async ({
  companyId,
  recipientId,
  page = 1,
  limit = 20,
  isRead,
}) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

  const filter = { companyId, recipientId };

  if (typeof isRead === "boolean") {
    filter.isRead = isRead;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .lean(),

    Notification.countDocuments(filter),

    Notification.countDocuments({
      companyId,
      recipientId,
      isRead: false,
    }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page: currentPage,
    limit: pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
};

exports.getNotificationById = async ({ id, companyId, recipientId }) => {
  const notification = await Notification.findOne({
    _id: id,
    companyId,
    recipientId,
  }).lean();

  return notification;
};

exports.updateNotification = async ({
  id,
  companyId,
  recipientId,
  updates,
}) => {
  const allowedFields = ["isRead", "title", "message", "metadata"];
  const payload = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      payload[field] = updates[field];
    }
  }

  if (typeof payload.isRead === "boolean") {
    payload.readAt = payload.isRead ? new Date() : null;
  }

  if (Object.keys(payload).length === 0) {
    const error = new Error("No valid fields to update");
    error.statusCode = 400;
    throw error;
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: id, companyId, recipientId },
    { $set: payload },
    { new: true, runValidators: true },
  );

  return notification;
};

exports.deleteNotification = async ({ id, companyId, recipientId }) => {
  const notification = await Notification.findOneAndDelete({
    _id: id,
    companyId,
    recipientId,
  });

  return notification;
};

exports.markAllNotificationsRead = async ({ companyId, recipientId }) => {
  const result = await Notification.updateMany(
    {
      companyId,
      recipientId,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    },
  );

  return result;
};
