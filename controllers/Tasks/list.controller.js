const listService = require("../../services/Tasks/list.service");

// ===============================
// CREATE LIST
// ===============================
exports.createList = async (req, res) => {
  try {
    const data = await listService.createList(
      req.body,
      req.user._id,
      req.folder,
      req.workspace,
    );

    return res.status(201).json({
      success: true,
      message: "List created successfully",
      data,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// GET ALL LISTS BY FOLDER
// ===============================
exports.getLists = async (req, res) => {
  try {
    const { workspaceId, folderId } = req.params;
    const { page, limit, search } = req.query;

    const result = await listService.getListsByWorkspace({
      page,
      limit,
      search,
      workspaceId,
      folderId,
      companyId: req.companyId,
      userId: req.user._id,
      workspaceRole: req.workspaceRole,
      folderRole: req.folderRole,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// GET SINGLE LIST
// ===============================
exports.getList = async (req, res) => {
  try {
    const data = await listService.getListById(req.params.listId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// UPDATE LIST
// ===============================
exports.updateList = async (req, res) => {
  try {
    const data = await listService.updateList(
      req.params.listId,
      req.body,
      req.user._id,
      req.companyId,
    );

    return res.status(200).json({
      success: true,
      message: "List updated successfully",
      data,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// DELETE LIST
// ===============================
exports.deleteList = async (req, res) => {
  try {
    await listService.deleteList(req.params.listId);

    return res.status(200).json({
      success: true,
      message: "List deleted successfully",
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// ADD MEMBER TO LIST
// ===============================
exports.addMember = async (req, res) => {
  try {
    const data = await listService.addMember(
      req.params.listId,
      req.body.userId,
      req.body.role,
      req.user._id,
      req.companyId,
    );

    return res.status(200).json({
      success: true,
      message: "Member added successfully",
      data,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// REMOVE MEMBER FROM LIST
// ===============================
exports.removeMember = async (req, res) => {
  try {
    const data = await listService.removeMember(
      req.params.listId,
      req.params.userId,
      req.user._id,
    );

    return res.status(200).json({
      success: true,
      message: "Member removed successfully",
      data,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};
