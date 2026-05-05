const Comment = require("../../models/Tasks/CommentModel");

exports.createComment = async (data, companyId, userId) => {
  if (!data.task && !data.subTask) {
    throw new Error("Comment must belong to a task or subtask");
  }
console.log(userId);

  if (!companyId) {
    throw new Error("Company ID is required");
  }

  const comment = await Comment.create({
    content: data.content,
    task: data.task || null,
    subTask: data.subTask || null,
    createdBy: userId,
    mentions: data.mentions || [],
    companyId,
  });

  return comment;
};

exports.getComments = async (filter) => {
  const query = {};

  if (filter.taskId) query.task = filter.taskId;
  if (filter.subTaskId) query.subTask = filter.subTaskId;

  const comments = await Comment.find(query)
    .populate("createdBy", "fullName email")
    .sort({ createdAt: -1 });

  return comments;
};

exports.updateComment = async (commentId, userId, data) => {
  const comment = await Comment.findById(commentId);

  if (!comment) throw new Error("Comment not found");

  // ❗ فقط صاحب التعليق يعدل
  if (comment.createdBy.toString() !== userId.toString()) {
    throw new Error("Unauthorized");
  }

  comment.content = data.content || comment.content;

  await comment.save();

  return comment;
};

exports.deleteComment = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);

  if (!comment) throw new Error("Comment not found");

  if (comment.createdBy.toString() !== userId.toString()) {
    throw new Error("Unauthorized");
  }

  await comment.deleteOne();

  return true;
};
