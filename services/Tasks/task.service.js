const mongoose = require("mongoose");
const subTaskModel = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");
const staffModel = require("../../models/Hr/Staffs/staffModel");
const NotificationModel = require("../../models/Hr/NotificationModel");
const notificationHelper = require("./notificationHelper");
const activityLogModel = require("../../models/Tasks/activityLogModel");
const fs = require("fs");
const path = require("path");
const Comment = require("../../models/Tasks/CommentModel");
const Attachment = require("../../models/Tasks/AttachmentModel");
const TimeLog = require("../../models/Tasks/TimeTrackingModel");

// ======================================
// CREATE TASK (workspace aware)
// ======================================
exports.createTask = async (data, userId, list) => {
  if (!list) {
    throw new Error("List is required");
  }

  console.log("=== CREATE TASK START ===", {
    data,
    userId,
    listId: list._id,
  });

  await list.populate([{ path: "folder" }, { path: "workspace" }]);

  const taskData = { ...data };

  delete taskData.list;
  delete taskData.workspace;
  delete taskData.companyId;
  delete taskData.createdBy;

  const task = await Task.create({
    ...taskData,
    list: list._id,
    workspace: list.workspace._id,
    companyId: list.companyId,
    createdBy: userId,
  });

  const populatedTask = await Task.findById(task._id).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  // ======================================================
  // STEP 1: DIRECT NOTIFICATIONS (ASSIGNED USERS)
  // ======================================================

  console.log("STEP 1: ASSIGNED USERS NOTIFICATIONS");

  const assignedRecipients = [
    ...new Set(
      (task.assignedTo || [])
        .map((id) => String(id))
        .filter((id) => id !== String(userId)),
    ),
  ];

  console.log("STEP 1: ASSIGNED RECIPIENTS", assignedRecipients);

  if (assignedRecipients.length > 0) {
    const assignedNotifications = assignedRecipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "task.assigned",
      title: "Task Assigned",
      message: `You were assigned to task "${task.title}"`,
      entity: {
        taskId: task._id,
        listId: task.list,
        folderId: populatedTask.list?.folder,
        workspaceId: populatedTask.list?.workspace,
        model: "Task",
      },
    }));

    await NotificationModel.create(assignedNotifications);

    console.log(
      "STEP 1: ASSIGNED NOTIFICATIONS SENT",
      assignedNotifications.length,
    );
  } else {
    console.log("STEP 1: NO ASSIGNED RECIPIENTS");
  }

  const actor = await staffModel.findById(userId).select("fullName").lean();

  const actorName = actor?.fullName || "Someone";

  await activityLogModel.create({
    actor: userId,
    action: "task.created",
    entityType: "task",
    entityId: task._id,
    workspaceId: populatedTask.list?.workspace?._id,
    folderId: populatedTask.list?.folder?._id,
    listId: populatedTask.list?._id,
    taskId: task._id,
    message: `${actorName} created task "${task.title}"`,
  });

  const recipients = notificationHelper.getRecipients(
    populatedTask,
    userId,
    "task",
  );

  console.log("STEP 2: TREE RECIPIENTS", recipients);

  if (recipients.length > 0) {
    const notifications = recipients.map((recipientId) => ({
      recipient: recipientId,
      actor: userId,
      type: "task.created",
      title: "Task Created",
      message: `Task "${populatedTask.title}" was created by ${actorName}`,
      entity: {
        taskId: populatedTask._id,
        listId: populatedTask.list,
        folderId: populatedTask.list?.folder,
        workspaceId: populatedTask.list?.workspace,
        model: "Task",
      },
    }));

    await NotificationModel.create(notifications);

    console.log("STEP 2: TREE NOTIFICATIONS SENT", notifications.length);
  } else {
    console.log("STEP 2: NO TREE RECIPIENTS");
  }

  console.log("=== CREATE TASK END ===");

  return populatedTask;
};

// ======================================
// GET TASK BY ID
// ======================================
exports.getTaskById = async ({ taskId, listId, workspaceId, companyId }) => {
  if (!taskId || !listId || !workspaceId || !companyId) {
    throw new Error("Task hierarchy is required");
  }

  const task = await Task.findOne({
    _id: taskId,
    list: listId,
    workspace: workspaceId,
    companyId,
  })
    .populate({
      path: "list",
      populate: [{ path: "folder" }, { path: "workspace" }],
    })
    .populate("assignedTo", "fullName email")
    .populate("createdBy", "fullName email");

  if (!task) {
    throw new Error("Task not found in the specified list");
  }

  return task;
};

// ======================================
// GET ALL TASKS (workspace scoped)
// ======================================
exports.getAllTasks = async ({
  workspaceId,
  listId,
  companyId,
  status,
  priority,
  assignedTo,
  due,
}) => {
  if (!workspaceId || !listId || !companyId) {
    throw new Error("Workspace, list and company are required");
  }

  const filter = {
    workspace: workspaceId,
    list: listId,
    companyId,
    isArchived: false,
  };

  if (status) {
    filter.status = status;
  }

  if (priority) {
    filter.priority = priority;
  }

  // ===============================
  // ASSIGNED EMPLOYEE
  // ===============================
  if (assignedTo) {
    const employees = await staffModel
      .find({
        companyId,
        fullName: {
          $regex: assignedTo,
          $options: "i",
        },
      })
      .select("_id");

    filter.assignedTo = {
      $in: employees.map((employee) => employee._id),
    };
  }

  // ===============================
  // DUE DATE
  // ===============================
  if (due) {
    const start = new Date(due);
    start.setHours(0, 0, 0, 0);

    const end = new Date(due);
    end.setHours(23, 59, 59, 999);

    filter.dueDate = {
      $gte: start,
      $lte: end,
    };
  }

  // ===============================
  // ALL TASKS
  // ===============================
  const tasks = await Task.find(filter)
    .populate("assignedTo", "fullName email")
    .populate("createdBy", "fullName email")
    .sort({ createdAt: -1 });

  // ===============================
  // SUBTASKS
  // ===============================
  const taskIds = tasks.map((task) => task._id);

  const subTasks = await subTaskModel
    .find({
      task: { $in: taskIds },
    })
    .populate("assignedTo", "fullName email")
    .populate("createdBy", "fullName email")
    .lean();

  // ===============================
  // GROUP SUBTASKS
  // ===============================
  const subTasksMap = {};

  subTasks.forEach((subTask) => {
    const taskId = subTask.task.toString();

    if (!subTasksMap[taskId]) {
      subTasksMap[taskId] = [];
    }

    subTasksMap[taskId].push(subTask);
  });

  // ===============================
  // ATTACH SUBTASKS
  // ===============================
  return tasks.map((task) => ({
    ...task.toObject(),
    subTasks: subTasksMap[task._id.toString()] || [],
  }));
};

// ======================================
// UPDATE TASK
// ======================================
exports.updateTask = async (taskId, data, actor) => {
  const oldTask = await Task.findById(taskId);

  if (!oldTask) {
    throw new Error("Task not found");
  }

  const updateData = { ...data };

  delete updateData.list;
  delete updateData.workspace;
  delete updateData.companyId;
  delete updateData.createdBy;

  const updatedTask = await Task.findOneAndUpdate(
    {
      _id: taskId,
      list: oldTask.list,
      workspace: oldTask.workspace,
      companyId: oldTask.companyId,
    },
    updateData,
    {
      new: true,
      runValidators: true,
    },
  ).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  if (!updatedTask) {
    throw new Error("Task not found");
  }

  let action = "task.updated";

  let message = `Task "${updatedTask.title}" was updated by ${actor.fullName}`;

  if (data.title && data.title !== oldTask.title) {
    action = "task.renamed";
    message = `${actor.fullName} renamed task "${oldTask.title}" to "${data.title}"`;
  } else if (data.status && data.status !== oldTask.status) {
    action = "task.status_changed";

    message = `${actor.fullName} changed task "${updatedTask.title}" status to "${data.status}"`;
  } else if (data.priority && data.priority !== oldTask.priority) {
    action = "task.priority_changed";

    message = `${actor.fullName} changed priority of "${updatedTask.title}" to "${data.priority}"`;
  } else if (data.dueDate) {
    action = "task.due_date_changed";

    message = `${actor.fullName} updated due date for "${updatedTask.title}"`;
  } else if (data.assignedTo) {
    action = "task.assignees_changed";

    message = `${actor.fullName} updated assignees for "${updatedTask.title}"`;
  }

  // description changed
  else if (data.description) {
    action = "task.description_changed";

    message = `${actor.fullName} updated description of "${updatedTask.title}"`;
  } else if (data.checklist) {
    action = "task.checklist_changed";

    message = `${actor.fullName} updated checklist of "${updatedTask.title}"`;
  }

  await activityLogModel.create({
    companyId: updatedTask.companyId,
    actor: actor._id,
    action,
    entityType: "task",
    entityId: updatedTask._id,
    workspaceId: updatedTask.list?.workspace?._id,
    folderId: updatedTask.list?.folder?._id,
    listId: updatedTask.list?._id,
    taskId: updatedTask._id,
    message,
  });

  const recipients = notificationHelper.getRecipients(
    updatedTask,
    actor._id,
    "task",
  );

  if (recipients.length > 0) {
    const notifications = recipients.map((recipient) => ({
      recipient,
      actor: actor._id,
      type: "task.updated",
      title: "Task Updated",
      message,
      entity: {
        taskId: updatedTask._id,
        listId: updatedTask.list?._id,
        folderId: updatedTask.list?.folder?._id,
        workspaceId: updatedTask.list?.workspace?._id,
        model: "Task",
      },
    }));

    await NotificationModel.create(notifications);
  }
  return updatedTask;
};

// ======================================
// DELETE TASK
// ======================================
exports.deleteTask = async ({
  taskId,
  listId,
  workspaceId,
  folderId,
  companyId,
  actorId,
  actorName,
}) => {
  if (!taskId || !listId || !workspaceId || !companyId || !actorId) {
    throw new Error("Task hierarchy and actor are required");
  }

  const session = await mongoose.startSession();

  let attachmentFileNames = [];

  try {
    await session.withTransaction(async () => {
      // تأكيد أن الـTask داخل نفس الشجرة
      const task = await Task.findOne({
        _id: taskId,
        list: listId,
        workspace: workspaceId,
        companyId,
      }).session(session);

      if (!task) {
        throw new Error("Task not found in the specified list");
      }

      // جلب SubTasks قبل حذفها
      const subTasks = await subTaskModel
        .find({ task: task._id })
        .select("_id")
        .session(session)
        .lean();

      const subTaskIds = subTasks.map((subTask) => subTask._id);

      // يشمل العناصر المرتبطة مباشرة بالـTask
      // والعناصر المرتبطة بالـSubTasks التابعة لها
      const treeFilter = {
        $or: [{ task: task._id }, { subTask: { $in: subTaskIds } }],
      };

      // نحفظ أسماء الملفات قبل حذف سجلاتها
      const attachments = await Attachment.find(treeFilter)
        .select("fileName")
        .session(session)
        .lean();

      attachmentFileNames = attachments
        .map((attachment) => attachment.fileName)
        .filter(Boolean);

      // لا نستخدم Promise.all داخل Transaction
      await Comment.deleteMany(treeFilter, { session });

      await TimeLog.deleteMany(treeFilter, { session });

      await Attachment.deleteMany(treeFilter, { session });

      await subTaskModel.deleteMany({ task: task._id }, { session });

      // نحتفظ بالسجلات السابقة ونضيف سجل الحذف
      await activityLogModel.create(
        [
          {
            actor: actorId,
            action: "task.deleted",
            entityType: "task",
            entityId: task._id,
            workspaceId,
            folderId: folderId || null,
            listId,
            taskId: task._id,
            message: `${actorName || "Someone"} deleted task "${task.title}"`,
          },
        ],
        { session },
      );

      // حذف الـTask يكون آخر عملية داخل Transaction
      await Task.deleteOne({ _id: task._id }, { session });
    });
  } finally {
    await session.endSession();
  }

  // حذف الملفات بعد نجاح Transaction
  // حتى لا نحذف ملفاً ثم يحدث rollback للبيانات
  for (const fileName of attachmentFileNames) {
    const safeFileName = path.basename(fileName);

    const filePath = path.resolve("uploads", "taskAttachments", safeFileName);

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      // الملف غير موجود أصلاً
      if (error.code !== "ENOENT") {
        console.error("Failed to delete attachment file:", {
          fileName: safeFileName,
          error: error.message,
        });
      }
    }
  }

  return true;
};

const findTaskInTree = async ({ taskId, listId, workspaceId, companyId }) => {
  const task = await Task.findOne({
    _id: taskId,
    list: listId,
    workspace: workspaceId,
    companyId,
  });

  if (!task) {
    throw new Error("Task not found in the specified list");
  }

  return task;
};

exports.addChecklistItem = async ({
  taskId,
  listId,
  workspaceId,
  companyId,
  data,
}) => {
  const task = await findTaskInTree({
    taskId,
    listId,
    workspaceId,
    companyId,
  });

  task.checklist.push({
    title: data.title,
    isDone: false,
    completedAt: null,
  });

  await task.save();

  return task;
};

exports.updateChecklistItem = async ({
  taskId,
  itemId,
  listId,
  workspaceId,
  companyId,
  data,
}) => {
  const task = await findTaskInTree({
    taskId,
    listId,
    workspaceId,
    companyId,
  });

  const item = task.checklist.id(itemId);

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

  await task.save();

  return task;
};

exports.deleteChecklistItem = async ({
  taskId,
  itemId,
  listId,
  workspaceId,
  companyId,
}) => {
  const task = await findTaskInTree({
    taskId,
    listId,
    workspaceId,
    companyId,
  });

  const item = task.checklist.id(itemId);

  if (!item) {
    throw new Error("Checklist item not found");
  }

  task.checklist.pull(itemId);

  await task.save();

  return task;
};

exports.toggleChecklistItem = async ({
  taskId,
  itemId,
  listId,
  workspaceId,
  companyId,
}) => {
  const task = await findTaskInTree({
    taskId,
    listId,
    workspaceId,
    companyId,
  });

  const item = task.checklist.id(itemId);

  if (!item) {
    throw new Error("Checklist item not found");
  }

  item.isDone = !item.isDone;
  item.completedAt = item.isDone ? new Date() : null;

  await task.save();

  return task;
};
