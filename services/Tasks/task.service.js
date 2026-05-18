const mongoose = require("mongoose");
const subTaskModel = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");
const ListModel = require("../../models/Tasks/ListModel");
const staffModel = require("../../models/Hr/staffModel");
const NotificationModel = require("../../models/Hr/NotificationModel");


const getTaskRecipients = async (task, actorId) => {
  const map = new Map();

  console.log("🟡 TASK INPUT:", task);
  console.log("🟡 ACTOR ID:", actorId);

  const addMembers = (members = [], source = "unknown") => {
    console.log(`\n🔵 ADDING MEMBERS FROM: ${source}`);
    console.log("MEMBERS:", members);

    for (const m of members) {
      console.log("➡️ MEMBER:", m);

      if (!m?.user) {
        console.log("⚠️ SKIPPED MEMBER (no user):", m);
        continue;
      }

      const key = String(m.user);
      const enabled = m.notificationsEnabled;

      console.log(`   user=${key} | notificationsEnabled=${enabled}`);

      map.set(key, enabled);
    }
  };

  const list = task?.list;
  const folder = list?.folder;
  const workspace = list?.workspace;

  console.log("\n🟣 RESOLVED STRUCTURE:");
  console.log("LIST:", list);
  console.log("FOLDER:", folder);
  console.log("WORKSPACE:", workspace);

  if (workspace?.members) addMembers(workspace.members, "workspace");
  if (folder?.members) addMembers(folder.members, "folder");
  if (list?.members) addMembers(list.members, "list");

  console.log("\n🟠 MAP BEFORE FILTER:");
  console.log([...map.entries()]);

  // remove actor
  map.delete(String(actorId));

  console.log("\n🔴 MAP AFTER REMOVING ACTOR:");
  console.log([...map.entries()]);

  const result = [...map.entries()]
    .filter(([_, enabled]) => enabled === true)
    .map(([userId]) => userId);

  console.log("\n🟢 FINAL RECIPIENTS:");
  console.log(result);

  return result;
};

// ====================================== 
// CREATE TASK (workspace aware)
// ======================================
exports.createTask = async (data, userId) => {
  if (!data.list) throw new Error("List is required");

  const list = await ListModel.findById(data.list);

  if (!list) {
    throw new Error("Invalid list");
  }

  return await Task.create({
    ...data,
    workspace: list.workspace,
    companyId: list.companyId,
    createdBy: userId,
  });
};

// ======================================
// GET TASK BY ID
// ======================================
exports.getTaskById = async (taskId) => {
  const task = await Task.findById(taskId)
    .populate({
      path: "list",
      populate: [{ path: "folder" }, { path: "workspace" }],
    })
    .populate("assignedTo", "fullName email")
    .populate("createdBy", "fullName email");

  if (!task) throw new Error("Task not found");

  return task;
};

// ======================================
// GET ALL TASKS (workspace scoped)
// ======================================
exports.getAllTasks = async ({
  workspaceId,
  userId,

  page = 1,
  limit = 10,

  status,
  priority,
  listId,

  assignedTo,
  due,
}) => {
  const filter = {
    workspace: workspaceId,
    isArchived: false,
  };

  // ===============================
  // LIST FILTER
  // ===============================
  if (listId && mongoose.Types.ObjectId.isValid(listId)) {
    filter.list = listId;
  }

  // ===============================
  // STATUS
  // ===============================
  if (status) {
    filter.status = status;
  }

  // ===============================
  // PRIORITY
  // ===============================
  if (priority) {
    filter.priority = priority;
  }

  // ===============================
  // ASSIGNED TO (BY NAME)
  // ===============================
  if (assignedTo) {
    console.log(assignedTo);

    const employees = await staffModel
      .find({
        fullName: {
          $regex: assignedTo,
          $options: "i",
        },
      })
      .select("_id");
    console.log(employees);

    const employeeIds = employees.map((e) => e._id);
    console.log(employeeIds);

    filter.assignedTo = {
      $in: employeeIds,
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

  const skip = (page - 1) * limit;

  // ===============================
  // TASKS
  // ===============================
  const tasks = await Task.find(filter)
    .populate("assignedTo", "fullName email")
    .populate("createdBy", "fullName email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Task.countDocuments(filter);

  // ===============================
  // SUBTASKS
  // ===============================
  const taskIds = tasks.map((t) => t._id);

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
  const map = {};

  subTasks.forEach((st) => {
    const key = st.task.toString();

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(st);
  });

  // ===============================
  // ATTACH SUBTASKS
  // ===============================
  const result = tasks.map((task) => ({
    ...task.toObject(),
    subTasks: map[task._id.toString()] || [],
  }));

  return {
    result,

    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  };
};
// ======================================
// UPDATE TASK
// ======================================
exports.updateTask = async (taskId, data, actorId) => {
  const task = await Task.findByIdAndUpdate(taskId, data, {
    new: true,
  }).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  if (!task) throw new Error("Task not found");

  // =========================
  // NOTIFICATIONS LOGIC
  // =========================

  const recipients = await getTaskRecipients(task, actorId);

  if (recipients.length > 0) {
    const notifications = recipients.map((userId) => ({
      recipient: userId,
      actor: actorId,
      type: "task.updated",
      title: "Task Updated",
      message: `Task "${task.title}" was updated`,
      entity: {
        id: task._id,
        model: "Task",
      },
    }));

    await NotificationModel.create(notifications);
  }

  return task;
};

// ======================================
// DELETE TASK
// ======================================
exports.deleteTask = async (taskId) => {
  const task = await Task.findByIdAndDelete(taskId);

  if (!task) throw new Error("Task not found");

  return task;
};

exports.addChecklistItem = async (taskId, data, workspaceId) => {
  const task = await Task.findOne({
    _id: taskId,
    workspace: workspaceId,
  });

  if (!task) throw new Error("Task not found");

  task.checklist.push({
    title: data.title,
    isDone: false,
    completedAt: null,
  });

  await task.save();
  return task;
};

//  UPDATE ITEM
exports.updateChecklistItem = async (taskId, itemId, data, workspaceId) => {
  const task = await Task.findOne({
    _id: taskId,
    workspace: workspaceId,
  });

  if (!task) throw new Error("Task not found");

  const item = task.checklist.id(itemId);
  if (!item) throw new Error("Checklist item not found");

  if (data.title !== undefined) item.title = data.title;

  if (data.isDone !== undefined) {
    item.isDone = data.isDone;
    item.completedAt = data.isDone ? new Date() : null;
  }

  await task.save();
  return task;
};

//  DELETE ITEM
exports.deleteChecklistItem = async (taskId, itemId, workspaceId) => {
  const task = await Task.findOne({
    _id: taskId,
    workspace: workspaceId,
  });

  if (!task) throw new Error("Task not found");

  const item = task.checklist.id(itemId);
  if (!item) throw new Error("Checklist item not found");

  task.checklist.pull(itemId);

  await task.save();
  return task;
};

exports.toggleChecklistItem = async (taskId, itemId, workspaceId) => {
  const task = await Task.findOne({
    _id: taskId,
    workspace: workspaceId,
  });

  if (!task) throw new Error("Task not found");

  const item = task.checklist.id(itemId);
  if (!item) throw new Error("Checklist item not found");

  item.isDone = !item.isDone;
  item.completedAt = item.isDone ? new Date() : null;

  await task.save();
  return task;
};
