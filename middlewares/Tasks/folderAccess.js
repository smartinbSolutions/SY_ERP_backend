const Workspace = require("../../models/Tasks/WorkspaceModel");
const Folder = require("../../models/Tasks/FolderModel");

exports.folderAccess = async (req, res, next) => {
  try {
    const folderId = req.params.id; // ✅ FIX HERE

    const folder = await Folder.findById(folderId);

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    const workspace = await Workspace.findOne(
      {
        _id: folder.workspace,
        "members.user": req.user._id,
        "members.status": "active",
      },
      { _id: 1, members: 1 },
    );

    if (!workspace) {
      return res.status(403).json({ message: "Access denied" });
    }

    req.folder = folder;
    req.workspace = workspace;

    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
