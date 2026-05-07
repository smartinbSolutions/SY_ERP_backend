const listService = require("../../services/Tasks/list.service");

// ===============================
// CREATE LIST
// ===============================
exports.createList = async (req, res) => {
  try {
    const { companyId } = req.query;
    const { workspaceId } = req.params;

    const data = await listService.createList(
      {
        ...req.body,
        workspace: workspaceId, // 🔥 enforce from route
      },
      req.user._id,
      companyId,
    );

    res.status(201).json({
      success: true,
      message: "List created successfully",
      data,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// GET ALL LISTS (BY WORKSPACE)
// ===============================
exports.getLists = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { page, limit, search, companyId } = req.query;

    const result = await listService.getListsByWorkspace({
      page,
      limit,
      search,
      workspaceId,
      companyId,
      userId: req.user._id,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    res.status(403).json({
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
    const { listId } = req.params;
    const { companyId } = req.query;

    const data = await listService.getListById(listId, req.user._id, companyId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(404).json({
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
    const { listId } = req.params;
    const { companyId } = req.query;

    const data = await listService.updateList(
      listId,
      req.body,
      req.user._id,
      companyId,
    );

    res.status(200).json({
      success: true,
      message: "List updated successfully",
      data,
    });
  } catch (err) {
    res.status(400).json({
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
    const { listId } = req.params;
    const { companyId } = req.query;

    await listService.deleteList(listId, req.user._id, companyId);

    res.status(200).json({
      success: true,
      message: "List deleted successfully",
    });
  } catch (err) {
    res.status(404).json({
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
    const { listId } = req.params;
    const { companyId } = req.query;

    const data = await listService.addMember(
      listId,
      req.body.userId,
      req.body.role,
      req.user._id,
      companyId,
    );

    res.status(200).json({
      success: true,
      message: "Member added successfully",
      data,
    });
  } catch (err) {
    res.status(400).json({
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
    const { listId } = req.params;
    const { companyId } = req.query;

    const data = await listService.removeMember(
      listId,
      req.body.userId,
      req.user._id,
      companyId,
    );

    res.status(200).json({
      success: true,
      message: "Member removed successfully",
      data,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};
