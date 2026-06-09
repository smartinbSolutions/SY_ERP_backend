const express = require("express");
const router = express.Router({ mergeParams: true });

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
  listAccess,
  folderAccess,
} = require("../../middlewares/Tasks/AccessMiddleware");

const {
  createList,
  getLists,
  getList,
  updateList,
  deleteList,
  addMember,
  removeMember,
} = require("../../controllers/Tasks/list.controller");

const checkPermission = require("../../middlewares/Tasks/permssionMiddleware");

// ======================================
// GLOBAL AUTH
// ======================================
router.use(hrAuthServices.protectStaffOrERP);

// ======================================
// CREATE LIST
// POST /workspaces/:workspaceId/lists
// ======================================
router.post(
  "/",
  folderAccess,
  checkPermission("create:list"),
  createList,
);

// ======================================
// GET LISTS
// GET /workspaces/:workspaceId/lists
// ======================================
router.get("/", folderAccess, getLists);

// ======================================
// GET SINGLE LIST
// GET /workspaces/:workspaceId/lists/:listId
// ======================================
router.get("/:listId", listAccess, getList);

// ======================================
// UPDATE LIST
// PATCH /workspaces/:workspaceId/lists/:listId
// ======================================
router.patch(
  "/:listId",
  folderAccess,
  listAccess,
  checkPermission("update:list"),
  updateList,
);

// ======================================
// DELETE LIST
// DELETE /workspaces/:workspaceId/lists/:listId
// ======================================
router.delete(
  "/:listId",

  folderAccess,
  listAccess,
  checkPermission("delete:list"),
  deleteList,
);

// ======================================
// ADD MEMBER TO LIST
// POST /workspaces/:workspaceId/lists/:listId/members
// ======================================
router.post(
  "/:listId/members",

  folderAccess,
  listAccess,
  checkPermission("manage:members"),
  addMember,
);

// ======================================
// REMOVE MEMBER FROM LIST
// DELETE /workspaces/:workspaceId/lists/:listId/members
// ======================================
router.delete(
  "/:listId/members/:userId",

  folderAccess,
  listAccess,
  checkPermission("manage:members"),
  removeMember,
);

module.exports = router;
