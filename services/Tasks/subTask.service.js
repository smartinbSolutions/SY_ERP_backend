const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const activityLogModel = require("../../models/Tasks/activityLogModel");
const NotificationModel = require("../../models/Hr/NotificationModel");
const staffModel = require("../../models/Hr/Staffs/staffModel");
const SubTask = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");
const Comment = require("../../models/Tasks/CommentModel");
const Attachment = require("../../models/Tasks/AttachmentModel");
const TimeLog = require("../../models/Tasks/TimeTrackingModel");
const notificationHelper = require("./notificationHelper");

const getActorName = async (actor) => {
  if (actor?.fullName) return actor.fullName;
  if (actor?.name) return actor.name;

  const actorId = actor?._id || actor;

  if (!actorId) return "Someone";

  const staff = await staffModel.findById(actorId).select("fullName").lean();

  return staff?.fullName || "Someone";
};

const getTaskTree = async (taskId, companyId, session = null) => {
  const query = Task.findOne({
    _id: taskId,
    companyId,
  }).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  if (session) query.session(session);

  const task = await query;

  if (!task) {
    throw new Error("Parent task not found");
  }

  return task;
};

const findSubTaskInTree = async ({ subTaskId, taskId, companyId }) => {
  if (!subTaskId || !taskId || !companyId) {
    throw new Error("SubTask hierarchy is required");
  }

  const subTask = await SubTask.findOne({
    _id: subTaskId,
    task: taskId,
    companyId,
  });

  if (!subTask) {
    throw new Error("SubTask not found in the specified task");
  }

  return subTask;
};

// ======================================
// CREATE SUBTASK
// ======================================
exports.createSubTask = async (data, userId, task) => {
  if (!task?._id || !task?.companyId) {
    throw new Error("Task context is required");
  }

  const subTaskData = { ...data };

  delete subTaskData.task;
  delete subTaskData.companyId;
  delete subTaskData.createdBy;

  const session = await mongoose.startSession();
  let createdSubTask;

  try {
    await session.withTransaction(async () => {
      const parentTask = await Task.findOne({
        _id: task._id,
        companyId: task.companyId,
      })
        .select("_id companyId")
        .session(session);

      if (!parentTask) {
        throw new Error("Parent task not found");
      }

      const [subTask] = await SubTask.create(
        [
          {
            ...subTaskData,
            task: parentTask._id,
            companyId: parentTask.companyId,
            createdBy: userId,
          },
        ],
        { session },
      );

      createdSubTask = subTask;

      await Task.updateOne(
        {
          _id: parentTask._id,
          companyId: parentTask.companyId,
        },
        {
          $addToSet: { subTasks: subTask._id },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  const populatedTask = await getTaskTree(task._id, task.companyId);

  const assignedRecipients = [
    ...new Set(
      (createdSubTask.assignedTo || [])
        .map((id) => String(id))
        .filter((id) => id !== String(userId)),
    ),
  ];

  if (assignedRecipients.length > 0) {
    const assignedNotifications = assignedRecipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "subtask.assigned",
      title: "SubTask Assigned",
      message: `You were assigned to subtask "${createdSubTask.title}"`,
      entity: {
        subTaskId: createdSubTask._id,
        taskId: populatedTask._id,
        listId: populatedTask.list?._id,
        folderId: populatedTask.list?.folder?._id,
        workspaceId: populatedTask.list?.workspace?._id,
        model: "SubTask",
      },
    }));

    await NotificationModel.create(assignedNotifications);
  }

  const actorName = await getActorName(userId);

  await activityLogModel.create({
    companyId: task.companyId,
    actor: userId,
    action: "subtask.created",
    entityType: "subtask",
    entityId: createdSubTask._id,
    workspaceId: populatedTask.list?.workspace?._id,
    folderId: populatedTask.list?.folder?._id,
    listId: populatedTask.list?._id,
    taskId: populatedTask._id,
    message: `${actorName} created subtask "${createdSubTask.title}"`,
  });

  const recipients = notificationHelper.getRecipients(
    populatedTask,
    userId,
    "task",
  );

  if (recipients.length > 0) {
    const notifications = recipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "subtask.created",
      title: "SubTask Created",
      message: `Subtask "${createdSubTask.title}" was created`,
      entity: {
        subTaskId: createdSubTask._id,
        taskId: populatedTask._id,
        listId: populatedTask.list?._id,
        folderId: populatedTask.list?.folder?._id,
        workspaceId: populatedTask.list?.workspace?._id,
        model: "SubTask",
      },
    }));

    await NotificationModel.create(notifications);
  }

  return createdSubTask;
};

// ======================================
// GET ALL SUBTASKS BY TASK
// ======================================
exports.getAllSubTasks = async ({ taskId, companyId }) => {
  if (!taskId || !companyId) {
    throw new Error("Task and company are required");
  }

  return SubTask.find({
    task: taskId,
    companyId,
  })
    .populate("assignedTo", "fullName email")
    .populate("createdBy", "fullName email")
    .populate("task", "title companyId")
    .sort({ order: 1, createdAt: 1 });
};

// ======================================
// GET SUBTASK BY ID
// ======================================
exports.getSubTaskById = async ({ subTaskId, taskId, companyId }) => {
  if (!subTaskId || !taskId || !companyId) {
    throw new Error("SubTask hierarchy is required");
  }

  const subTask = await SubTask.findOne({
    _id: subTaskId,
    task: taskId,
    companyId,
  })
    .populate("assignedTo", "fullName email")
    .populate("createdBy", "fullName email")
    .populate("task", "title companyId");

  if (!subTask) {
    throw new Error("SubTask not found in the specified task");
  }

  return subTask;
};

// ======================================
// UPDATE SUBTASK
// ======================================
exports.updateSubTask = async ({
  subTaskId,
  taskId,
  companyId,
  data,
  actor,
}) => {
  const oldSubTask = await SubTask.findOne({
    _id: subTaskId,
    task: taskId,
    companyId,
  });

  if (!oldSubTask) {
    throw new Error("SubTask not found in the specified task");
  }

  const updateData = { ...data };

  delete updateData.task;
  delete updateData.companyId;
  delete updateData.createdBy;

  const subTask = await SubTask.findOneAndUpdate(
    {
      _id: subTaskId,
      task: taskId,
      companyId,
    },
    updateData,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!subTask) {
    throw new Error("SubTask not found in the specified task");
  }

  const task = await getTaskTree(taskId, companyId);
  const actorId = actor?._id;

  if (!actorId) {
    throw new Error("Actor is required");
  }

  const actorName = await getActorName(actor);
  let message = `Subtask "${subTask.title}" was updated by ${actorName}`;

  if (updateData.title !== undefined && updateData.title !== oldSubTask.title) {
    message = `${actorName} renamed subtask "${oldSubTask.title}" to "${updateData.title}"`;
  } else if (
    updateData.status !== undefined &&
    updateData.status !== oldSubTask.status
  ) {
    message = `${actorName} changed subtask "${subTask.title}" status to "${updateData.status}"`;
  } else if (
    updateData.priority !== undefined &&
    updateData.priority !== oldSubTask.priority
  ) {
    message = `${actorName} changed priority of subtask "${subTask.title}" to "${updateData.priority}"`;
  } else if (Object.prototype.hasOwnProperty.call(updateData, "dueDate")) {
    message = `${actorName} updated due date for subtask "${subTask.title}"`;
  } else if (Object.prototype.hasOwnProperty.call(updateData, "assignedTo")) {
    message = `${actorName} updated assignees for subtask "${subTask.title}"`;
  } else if (Object.prototype.hasOwnProperty.call(updateData, "description")) {
    message = `${actorName} updated description of subtask "${subTask.title}"`;
  }

  await activityLogModel.create({
    companyId,
    actor: actorId,
    action: "subtask.updated",
    entityType: "subtask",
    entityId: subTask._id,
    workspaceId: task.list?.workspace?._id,
    folderId: task.list?.folder?._id,
    listId: task.list?._id,
    taskId: task._id,
    message,
  });

  const recipients = notificationHelper.getRecipients(task, actorId, "task");

  if (recipients.length > 0) {
    const notifications = recipients.map((recipient) => ({
      recipient,
      actor: actorId,
      type: "subtask.updated",
      title: "SubTask Updated",
      message,
      entity: {
        subTaskId: subTask._id,
        taskId: task._id,
        listId: task.list?._id,
        folderId: task.list?.folder?._id,
        workspaceId: task.list?.workspace?._id,
        model: "SubTask",
      },
    }));

    await NotificationModel.create(notifications);
  }

  return subTask;
};

// ======================================
// DELETE SUBTASK
// ======================================
exports.deleteSubTask = async ({ subTaskId, taskId, companyId, actor }) => {
  const actorId = actor?._id;

  if (!subTaskId || !taskId || !companyId || !actorId) {
    throw new Error("SubTask hierarchy and actor are required");
  }

  const session = await mongoose.startSession();
  let attachmentFileNames = [];

  try {
    await session.withTransaction(async () => {
      const subTask = await SubTask.findOne({
        _id: subTaskId,
        task: taskId,
        companyId,
      }).session(session);

      if (!subTask) {
        throw new Error("SubTask not found in the specified task");
      }

      const task = await getTaskTree(taskId, companyId, session);

      const attachments = await Attachment.find({
        subTask: subTask._id,
      })
        .select("fileName")
        .session(session)
        .lean();

      attachmentFileNames = attachments
        .map((attachment) => attachment.fileName)
        .filter(Boolean);

      await Comment.deleteMany({ subTask: subTask._id }, { session });
      await TimeLog.deleteMany({ subTask: subTask._id }, { session });
      await Attachment.deleteMany({ subTask: subTask._id }, { session });

      await Task.updateOne(
        {
          _id: task._id,
          companyId,
        },
        {
          $pull: { subTasks: subTask._id },
        },
        { session },
      );

      const actorName = await getActorName(actor);

      await activityLogModel.create(
        [
          {
            companyId,
            actor: actorId,
            action: "subtask.deleted",
            entityType: "subtask",
            entityId: subTask._id,
            workspaceId: task.list?.workspace?._id,
            folderId: task.list?.folder?._id,
            listId: task.list?._id,
            taskId: task._id,
            message: `${actorName} deleted subtask "${subTask.title}"`,
          },
        ],
        { session },
      );

      await SubTask.deleteOne({ _id: subTask._id }, { session });
    });
  } finally {
    await session.endSession();
  }

  for (const fileName of attachmentFileNames) {
    const safeFileName = path.basename(fileName);
    const filePath = path.resolve("uploads", "taskAttachments", safeFileName);

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Failed to delete subtask attachment file:", {
          fileName: safeFileName,
          error: error.message,
        });
      }
    }
  }

  return true;
};

// ======================================
// ADD CHECKLIST ITEM
// ======================================
exports.addChecklistItem = async ({ subTaskId, taskId, companyId, data }) => {
  const subTask = await findSubTaskInTree({
    subTaskId,
    taskId,
    companyId,
  });

  subTask.checklist.push({
    title: data.title,
    isDone: false,
    completedAt: null,
  });

  await subTask.save();

  return subTask;
};

// ======================================
// UPDATE CHECKLIST ITEM
// ======================================
exports.updateChecklistItem = async ({
  subTaskId,
  itemId,
  taskId,
  companyId,
  data,
}) => {
  const subTask = await findSubTaskInTree({
    subTaskId,
    taskId,
    companyId,
  });

  const item = subTask.checklist.id(itemId);

  if (!item) {
    throw new Error("Checklist item not found");
  }

  if (data.title !== undefined) {
    item.title = data.title;
  }

  if (data.isDone !== undefined) {
    item.isDone = data.isDone;
    item.completedAt = data.isDone ? new Date() : null;
  }

  await subTask.save();

  return subTask;
};

// ======================================
// DELETE CHECKLIST ITEM
// ======================================
exports.deleteChecklistItem = async ({
  subTaskId,
  itemId,
  taskId,
  companyId,
}) => {
  const subTask = await findSubTaskInTree({
    subTaskId,
    taskId,
    companyId,
  });

  const item = subTask.checklist.id(itemId);

  if (!item) {
    throw new Error("Checklist item not found");
  }

  subTask.checklist.pull(itemId);

  await subTask.save();

  return subTask;
};

// ======================================
// TOGGLE CHECKLIST ITEM
// ======================================
exports.toggleChecklistItem = async ({
  subTaskId,
  itemId,
  taskId,
  companyId,
}) => {
  const subTask = await findSubTaskInTree({
    subTaskId,
    taskId,
    companyId,
  });

  const item = subTask.checklist.id(itemId);

  if (!item) {
    throw new Error("Checklist item not found");
  }

  item.isDone = !item.isDone;
  item.completedAt = item.isDone ? new Date() : null;

  await subTask.save();

  return subTask;
};
