const express = require("express");

const router = express.Router({ mergeParams: true });

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
  workspaceAccess,
  folderAccess,
  listAccess,
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
// GLOBAL AUTHENTICATION
// ======================================

router.use(hrAuthServices.protectStaffOrERP);

// ======================================
// CREATE LIST
// POST /workspaces/:workspaceId/folders/:folderId/lists
// ======================================

router.post(
  "/",
  workspaceAccess,
  folderAccess,
  checkPermission("create:list"),
  createList,
);

// ======================================
// GET LISTS INSIDE FOLDER
// GET /workspaces/:workspaceId/folders/:folderId/lists
// ======================================

router.get(
  "/",
  workspaceAccess,
  folderAccess,
  checkPermission("read:list"),
  getLists,
);

// ======================================
// GET SINGLE LIST
// GET /workspaces/:workspaceId/folders/:folderId/lists/:listId
// ======================================

router.get("/:listId", listAccess, checkPermission("read:list"), getList);

// ======================================
// UPDATE LIST
// PATCH /workspaces/:workspaceId/folders/:folderId/lists/:listId
// ======================================

router.patch(
  "/:listId",
  listAccess,
  checkPermission("update:list"),
  updateList,
);

// ======================================
// DELETE LIST
// DELETE /workspaces/:workspaceId/folders/:folderId/lists/:listId
// ======================================

router.delete(
  "/:listId",
  listAccess,
  checkPermission("delete:list"),
  deleteList,
);

// ======================================
// ADD LIST MEMBER
// POST /workspaces/:workspaceId/folders/:folderId/lists/:listId/members
// ======================================

router.post(
  "/:listId/members",
  listAccess,
  checkPermission("manage:members"),
  addMember,
);

// ======================================
// REMOVE LIST MEMBER
// DELETE /workspaces/:workspaceId/folders/:folderId/lists/:listId/members/:userId
// ======================================

router.delete(
  "/:listId/members/:userId",
  listAccess,
  checkPermission("manage:members"),
  removeMember,
);

module.exports = router;
