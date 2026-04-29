const mongoose = require("mongoose");
const subTaskModel = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");

// CREATE
exports.createTask = async (data, userId) => {
  return await Task.create({
    ...data,
    createdBy: userId,
  });
};

// GET ONE
exports.getTaskById = async (taskId) => {
  const task = await Task.findById(taskId)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name");

  if (!task) throw new Error("Task not found");

  return task;
};

exports.getAllTasks = async ({
  userId,
  type,
  listId,
  includeSubTasks,
  page = 1,
  limit = 10,
  status,
  priority,
}) => {



  const filter = { isArchived: false };

  // ===============================
  // TYPE FILTER
  // ===============================
  // if (type === "my") {
  //   filter.assignedTo = userId;
  //   console.log("Filter applied: assignedTo =", userId);
  // }

  // if (type === "team") {
  //   filter.createdBy = userId;
  //   console.log("Filter applied: createdBy =", userId);
  // }

  // ===============================
  // LIST FILTER
  // ===============================

  if (listId) {
    const isValid = mongoose.Types.ObjectId.isValid(listId);
    console.log("Is listId valid ObjectId?", isValid);

    if (isValid) {
      filter.list = new mongoose.Types.ObjectId(listId); 
      console.log("Filter applied: list =", listId);
    } else {
      console.log("Invalid listId provided, skipping list filter");
    }

  }

  // ===============================
  // EXTRA FILTERS
  // ===============================
  if (status) {
    filter.status = status;
    console.log("Filter applied: status =", status);
  }

  if (priority) {
    filter.priority = priority;
    console.log("Filter applied: priority =", priority);
  }


  const skip = (page - 1) * limit;

  // ===============================
  // MAIN QUERY
  // ===============================
  const tasks = await Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  console.log("Tasks fetched:", tasks.length);

  const total = await Task.countDocuments(filter);

  console.log("Total count:", total);

  // ===============================
  // WITHOUT SUBTASKS
  // ===============================
  if (includeSubTasks !== "true") {
    console.log("Returning WITHOUT subTasks");

    console.log("==== END DEBUG ====");

    return {
      tasks,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ===============================
  // WITH SUBTASKS
  // ===============================
  console.log("Including subTasks...");

  const taskIds = tasks.map((t) => t._id);
  console.log("Task IDs:", taskIds);

  const subTasks = await subTaskModel
    .find({ task: { $in: taskIds } })
    .lean();

  console.log("SubTasks fetched:", subTasks.length);

  const map = {};

  subTasks.forEach((st) => {
    const key = st.task.toString();
    if (!map[key]) map[key] = [];
    map[key].push(st);
  });

  const result = tasks.map((task) => ({
    ...task.toObject(),
    subTasks: map[task._id.toString()] || [],
  }));

  console.log("Final result with subTasks:", result.length);

  console.log("==== END DEBUG ====");

  return {
    result,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  };
};

// UPDATE
exports.updateTask = async (taskId, data) => {
  const task = await Task.findByIdAndUpdate(taskId, data, {
    new: true,
  });

  if (!task) throw new Error("Task not found");

  return task;
};

// DELETE
exports.deleteTask = async (taskId) => {
  const task = await Task.findByIdAndDelete(taskId);

  if (!task) throw new Error("Task not found");

  return task;
};
