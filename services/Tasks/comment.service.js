const Comment = require("../../models/Tasks/CommentModel");
const NotificationModel = require("../../models/Hr/NotificationModel");
const Task = require("../../models/Tasks/TaskModel");

const { getTaskRecipients } = require("../../services/Tasks/task.service");

// ======================================
// CREATE COMMENT
// ======================================

exports.createComment = async (data, companyId, userId) => {
  if (!data.task && !data.subTask) {
    throw new Error("Comment must belong to a task or subtask");
  }

  if (!companyId) {
    throw new Error("Company ID is required");
  }

  // =========================
  // CREATE COMMENT
  // =========================
  const comment = await Comment.create({
    content: data.content,
    task: data.task || null,
    subTask: data.subTask || null,
    createdBy: userId,
    mentions: data.mentions || [],
    companyId,
  });

  // =========================
  // RESOLVE TASK ID
  // =========================
  const taskId = data.task || data.subTask;

  if (!taskId) {
    return comment;
  }

  // =========================
  // FETCH TASK
  // =========================
  const task = await Task.findById(taskId).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  if (!task) {
    return comment;
  }

  // =========================
  // GET RECIPIENTS
  // =========================
  const recipients = await getTaskRecipients(task, userId);

  if (!recipients || recipients.length === 0) {
    return comment;
  }

  const uniqueRecipients = [
    ...new Set(recipients.map((id) => String(id))),
  ].filter((id) => id !== String(userId));

  if (uniqueRecipients.length === 0) {
    return comment;
  }
  // =========================
  // CREATE NOTIFICATIONS
  // =========================
  const notifications = uniqueRecipients.map((recipient) => ({
    recipient,
    actor: userId,
    type: "comment.created",
    title: "New Comment",
    message: `New comment added to task "${task.title}"`,
    entity: {
      id: task._id,
      model: "Task",
    },
  }));

  await NotificationModel.create(notifications);

  return comment;
};

// ======================================
// GET COMMENTS
// ======================================

exports.getComments = async (filter) => {
  const query = {};

  if (filter.taskId) query.task = filter.taskId;
  if (filter.subTaskId) query.subTask = filter.subTaskId;

  return await Comment.find(query)
    .populate("createdBy", "fullName email")
    .sort({ createdAt: -1 });
};

// ======================================
// UPDATE COMMENT
// ======================================

exports.updateComment = async (commentId, userId, data) => {
  const comment = await Comment.findById(commentId);

  if (!comment) throw new Error("Comment not found");

  if (comment.createdBy.toString() !== userId.toString()) {
    throw new Error("Unauthorized");
  }

  comment.content = data.content || comment.content;

  await comment.save();

  return comment;
};

// ======================================
// DELETE COMMENT
// ======================================

exports.deleteComment = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);

  if (!comment) throw new Error("Comment not found");

  if (comment.createdBy.toString() !== userId.toString()) {
    throw new Error("Unauthorized");
  }

  await comment.deleteOne();

  return true;
};
