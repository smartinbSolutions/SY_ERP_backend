const Workspace = require("../../models/Tasks/WorkspaceModel");
const Folder = require("../../models/Tasks/FolderModel");

exports.folderAccess = async (req, res, next) => {
  try {
    const folderId = req.params.id || req.params.folderId;

    const folder = await Folder.findById(folderId);

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    const workspace = await Workspace.findById(folder.workspace);

    const isMember = workspace.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: "Access denied" });
    }

    req.folder = folder;
    req.workspace = workspace;

    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};