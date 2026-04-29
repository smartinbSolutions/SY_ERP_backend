const listService = require("../../services/Tasks/list.service");

// ===============================
// CREATE
// ===============================
exports.createList = async (req, res) => {
  try {
    const { companyId } = req.query;

    const data = await listService.createList(
      req.body,
      req.user._id,
      req.query.companyId,
    );

    res.status(201).json({
      message: "Created",
      data,
    });
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
};

// ===============================
// GET ALL
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

    res.json(result);
  } catch (err) {
    res.status(403).json({
      message: err.message,
    });
  }
};

// ===============================
// GET ONE
// ===============================
exports.getList = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.query;

    const data = await listService.getListById(id, req.user._id, companyId);

    res.json({ data });
  } catch (err) {
    res.status(403).json({
      message: err.message,
    });
  }
};

// ===============================
// UPDATE
// ===============================
exports.updateList = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.query;

    const data = await listService.updateList(
      id,
      req.body,
      req.user._id,
      companyId,
    );

    res.json({
      message: "Updated",
      data,
    });
  } catch (err) {
    res.status(403).json({
      message: err.message,
    });
  }
};

// ===============================
// DELETE
// ===============================
exports.deleteList = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.query;

    await listService.deleteList(id, req.user._id, companyId);

    res.json({
      message: "Deleted",
    });
  } catch (err) {
    res.status(403).json({
      message: err.message,
    });
  }
};

// ===============================
// ADD MEMBER
// ===============================
exports.addMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.query;

    const data = await listService.addMember(
      id,
      req.body.userId,
      req.body.role,
      req.user._id,
      companyId,
    );

    res.json({
      message: "Member added",
      data,
    });
  } catch (err) {
    res.status(403).json({
      message: err.message,
    });
  }
};
