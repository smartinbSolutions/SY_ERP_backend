const activityModel = require("../../models/CRM/activityModel");
const { createNotification } = require("./notificationService");

const REMINDER_WINDOW_MINUTES = 7.5;
const REMINDER_WINDOW_MS = REMINDER_WINDOW_MINUTES * 60 * 1000;

const REMINDER_STAGES = [
  {
    key: "24h",
    offsetMs: 24 * 60 * 60 * 1000,
    title: "Activity due in 24 hours",
    getMessage: (subject) => `Your activity "${subject}" is due in 24 hours.`,
  },
  {
    key: "1h",
    offsetMs: 60 * 60 * 1000,
    title: "Activity due in 1 hour",
    getMessage: (subject) => `Your activity "${subject}" is due in 1 hour.`,
  },
  {
    key: "at_time",
    offsetMs: 0,
    title: "Activity due now",
    getMessage: (subject) => `Your activity "${subject}" is due now.`,
  },
];

const formatDate = (date) => {
  if (!date) return null;

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "INVALID_DATE";
  }

  return parsedDate.toISOString();
};

const getReminderIdempotencyKey = (activityId, dueDate, stage) =>
  `crm-activity-reminder:${activityId}:${new Date(dueDate).getTime()}:${stage}`;

const isWithinReminderWindow = (scheduledAt, now) => {
  const difference = now.getTime() - scheduledAt.getTime();

  return Math.abs(difference) <= REMINDER_WINDOW_MS;
};

const getStageWindowInfo = (scheduledAt, now) => {
  const differenceMs = now.getTime() - scheduledAt.getTime();

  return {
    scheduledAt: formatDate(scheduledAt),
    currentTime: formatDate(now),
    differenceMinutes: Number((differenceMs / 60000).toFixed(2)),
    windowMinutes: REMINDER_WINDOW_MINUTES,
    windowStart: formatDate(
      new Date(scheduledAt.getTime() - REMINDER_WINDOW_MS),
    ),
    windowEnd: formatDate(new Date(scheduledAt.getTime() + REMINDER_WINDOW_MS)),
    eligible: isWithinReminderWindow(scheduledAt, now),
  };
};

const sendActivityReminder = async ({ activity, stage, now }) => {
  const activityId = String(activity._id);

  const currentActivity = await activityModel
    .findOne({
      _id: activity._id,
      companyId: activity.companyId,
      deletedAt: null,
      status: "pending",
    })
    .select("_id companyId subject ownerId dueDate status deletedAt")
    .lean();

  if (!currentActivity) {
    return {
      sent: false,
      reason: "activity_inactive",
    };
  }

  if (
    !currentActivity.dueDate ||
    new Date(currentActivity.dueDate).getTime() !==
      new Date(activity.dueDate).getTime()
  ) {
    return {
      sent: false,
      reason: "due_date_changed",
    };
  }

  if (!currentActivity.ownerId) {
    return {
      sent: false,
      reason: "missing_owner",
    };
  }

  const scheduledAt = new Date(
    new Date(currentActivity.dueDate).getTime() - stage.offsetMs,
  );

  const currentTime = new Date();
  const windowInfo = getStageWindowInfo(scheduledAt, currentTime);

  if (!windowInfo.eligible) {
    return {
      sent: false,
      reason:
        currentTime.getTime() < scheduledAt.getTime()
          ? "scheduled_time_outside_future_window"
          : "scheduled_time_outside_past_window",
    };
  }

  const idempotencyKey = getReminderIdempotencyKey(
    currentActivity._id,
    currentActivity.dueDate,
    stage.key,
  );

  const dueDateIso = new Date(currentActivity.dueDate).toISOString();

  const notification = await createNotification({
    companyId: currentActivity.companyId,
    recipientId: currentActivity.ownerId,
    type: "crm.activity.reminder",
    title: stage.title,
    message: stage.getMessage(currentActivity.subject || "Untitled activity"),
    entityType: "Activity",
    entityId: currentActivity._id,
    idempotencyKey,
    metadata: {
      activityType: "reminder",
      reminderStage: stage.key,
      subject: currentActivity.subject,
      dueDate: dueDateIso,
      scheduledAt: scheduledAt.toISOString(),
    },
  });

  if (!notification) {
    return {
      sent: false,
      reason: "already_sent",
    };
  }

  return {
    sent: true,
    stage: stage.key,
    notificationId: String(notification._id),
  };
};

const processActivityRemindersService = async () => {
  const startedAt = new Date();

  const minDueDate = new Date(startedAt.getTime() - REMINDER_WINDOW_MS);

  const maxDueDate = new Date(
    startedAt.getTime() + 24 * 60 * 60 * 1000 + REMINDER_WINDOW_MS,
  );

  const stats = {
    checked: 0,
    eligibleStages: 0,
    sent: 0,
    alreadySent: 0,
    inactive: 0,
    dueDateChanged: 0,
    missingOwner: 0,
    outsideWindow: 0,
    errors: 0,
  };

  try {
    const cursor = activityModel
      .find({
        status: "pending",
        deletedAt: null,
        dueDate: {
          $gte: minDueDate,
          $lte: maxDueDate,
        },
      })
      .select("_id companyId subject ownerId dueDate status deletedAt")
      .lean()
      .cursor();

    for await (const activity of cursor) {
      stats.checked += 1;

      const activityId = String(activity._id);

      if (!activity.dueDate) {
        continue;
      }

      for (const stage of REMINDER_STAGES) {
        const now = new Date();

        const scheduledAt = new Date(
          new Date(activity.dueDate).getTime() - stage.offsetMs,
        );

        if (!isWithinReminderWindow(scheduledAt, now)) {
          stats.outsideWindow += 1;
          continue;
        }

        stats.eligibleStages += 1;

        try {
          const result = await sendActivityReminder({
            activity,
            stage,
            now,
          });

          if (result.sent) {
            stats.sent += 1;
          } else {
            switch (result.reason) {
              case "already_sent":
                stats.alreadySent += 1;
                break;

              case "activity_inactive":
                stats.inactive += 1;
                break;

              case "due_date_changed":
                stats.dueDateChanged += 1;
                break;

              case "missing_owner":
                stats.missingOwner += 1;
                break;

              case "scheduled_time_outside_future_window":
              case "scheduled_time_outside_past_window":
                stats.outsideWindow += 1;
                break;

              default:
                break;
            }
          }
        } catch (error) {
          stats.errors += 1;
        }
      }
    }

    const finishedAt = new Date();

    const summary = {
      ...stats,
      startedAt: formatDate(startedAt),
      finishedAt: formatDate(finishedAt),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };

    return summary;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  processActivityRemindersService,
};
