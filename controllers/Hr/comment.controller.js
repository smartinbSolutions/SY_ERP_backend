const commentService = require("../../services/Hr/commentService");

exports.createComment = async (req, res) => {
  try {
    const comment = await commentService.createComment(req.body, req.user._id);

    res.status(201).json(comment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getComments = async (req, res) => {
  try {
    const comments = await commentService.getComments({
      taskId: req.query.taskId,
      subTaskId: req.query.subTaskId,
    });

    res.json(comments);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const comment = await commentService.updateComment(
      req.params.id,
      req.user._id,
      req.body,
    );

    res.json(comment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    await commentService.deleteComment(req.params.id, req.user._id);

    res.json({ message: "Comment deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
