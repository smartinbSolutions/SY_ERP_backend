const express = require("express");
const router = express.Router({ mergeParams: true });

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
  workspaceAccess,
  listAccess,
} = require("../../middlewares/Tasks/AccessMiddleware");

const {
  createList,
  getLists,
  getList,
  updateList,
  deleteList,
  addMember,
} = require("../../controllers/Tasks/list.controller");

const checkPermission = require("../../middlewares/Tasks/permssionMiddleware");

// ======================================
// GLOBAL AUTH
// ======================================
router.use(hrAuthServices.protectStaffOrERP);

// ======================================
// CREATE LIST
// POST /api/workspaces/:workspaceId/lists
// ======================================
router.post("/", workspaceAccess, checkPermission("create:list"), createList);

// ======================================
// GET LISTS BY WORKSPACE
// GET /api/workspaces/:workspaceId/lists
// ======================================
router.get("/", workspaceAccess, getLists);

// ======================================
// GET SINGLE LIST
// GET /api/workspaces/:workspaceId/lists/:id
// ======================================
router.get("/:id", workspaceAccess, listAccess, getList);

// ======================================
// UPDATE LIST
// PATCH /api/workspaces/:workspaceId/lists/:id
// ======================================
router.patch(
  "/:id",
  workspaceAccess,
  listAccess,
  checkPermission("update:list"),
  updateList,
);

// ======================================
// DELETE LIST
// DELETE /api/workspaces/:workspaceId/lists/:id
// ======================================
router.delete(
  "/:id",
  workspaceAccess,
  listAccess,
  checkPermission("delete:list"),
  deleteList,
);

// ======================================
// ADD MEMBER TO LIST
// POST /api/workspaces/:workspaceId/lists/:id/members
// ======================================
router.post(
  "/:id/members",
  workspaceAccess,
  listAccess,
  checkPermission("manage:members"),
  addMember,
);

module.exports = router;
