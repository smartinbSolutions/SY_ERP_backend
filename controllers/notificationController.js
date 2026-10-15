const notificationService = require("../services/Notification/notificationService");

const getUserContext = (req) => ({
  companyId: req.companyId,
  recipientId: req.user?._id || req.user?.id,
});

const handleError = (res, error) => {
  const statusCode =
    error.statusCode || (error.name === "CastError" ? 400 : 500);

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Internal server error" : error.message,
  });
};

exports.createNotification = async (req, res) => {
  try {
    const { companyId } = getUserContext(req);
    const recipientId = req.body.recipientId;

    if (!companyId || !recipientId) {
      return res.status(400).json({
        success: false,
        message: "Company and recipient are required",
      });
    }

    const notification = await notificationService.createNotification({
      companyId,
      recipientId,
      actorId: req.user?._id || req.user?.id || null,
      type: req.body.type,
      title: req.body.title,
      message: req.body.message,
      entityType: req.body.entityType,
      entityId: req.body.entityId,
      metadata: req.body.metadata,
    });

    return res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const { companyId, recipientId } = getUserContext(req);

    if (!companyId || !recipientId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let isRead;

    if (req.query.isRead === "true") isRead = true;
    if (req.query.isRead === "false") isRead = false;

    const data = await notificationService.getNotifications({
      companyId,
      recipientId,
      page: req.query.page,
      limit: req.query.limit,
      isRead,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getNotificationById = async (req, res) => {
  try {
    const { companyId, recipientId } = getUserContext(req);

    if (!companyId || !recipientId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const notification = await notificationService.getNotificationById({
      id: req.params.id,
      companyId,
      recipientId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateNotification = async (req, res) => {
  try {
    const { companyId, recipientId } = getUserContext(req);

    if (!companyId || !recipientId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const notification = await notificationService.updateNotification({
      id: req.params.id,
      companyId,
      recipientId,
      updates: req.body,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { companyId, recipientId } = getUserContext(req);

    if (!companyId || !recipientId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const notification = await notificationService.deleteNotification({
      id: req.params.id,
      companyId,
      recipientId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const { companyId, recipientId } = getUserContext(req);

    if (!companyId || !recipientId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await notificationService.markAllNotificationsRead({
      companyId,
      recipientId,
    });

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const { companyId, recipientId } = getUserContext(req);

    if (!companyId || !recipientId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const data = await notificationService.getNotifications({
      companyId,
      recipientId,
      page: 1,
      limit: 1,
    });

    return res.status(200).json({
      success: true,
      data: { unreadCount: data.unreadCount },
    });
  } catch (error) {
    return handleError(res, error);
  }
};
