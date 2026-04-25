const List = require("../../models/Tasks/ListModel");
const Workspace = require("../../models/Tasks/WorkspaceModel");

exports.listAccess = async (req, res, next) => {
  try {
    const listId = req.params.id;

    const list = await List.findById(listId);

    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    const workspace = await Workspace.findById(list.workspace);

    const isWorkspaceMember = workspace.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!isWorkspaceMember) {
      return res.status(403).json({ message: "Workspace access denied" });
    }

    if (list.visibility === "private") {
      const isListMember = list.members.some(
        (m) => m.user.toString() === req.user._id.toString()
      );

      if (!isListMember) {
        return res.status(403).json({ message: "List access denied" });
      }
    }

    req.list = list;
    req.workspace = workspace;

    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};