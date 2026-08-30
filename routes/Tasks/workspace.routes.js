const express = require("express");

const router = express.Router();

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
  workspaceAccess,
  canCreateWorkspace,
} = require("../../middlewares/Tasks/AccessMiddleware");

const checkPermission = require("../../middlewares/Tasks/permssionMiddleware");

const {
  getMyWorkspaces,
  getWorkspace,
  addMember,
  removeMember,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getUserWorkspaceTree,
} = require("../../controllers/Tasks/workspace.controller");

// ======================================
// GLOBAL AUTHENTICATION
// ======================================

router.use(hrAuthServices.protectStaffOrERP);

// ======================================
// WORKSPACE COLLECTION
// POST /workspaces
// GET  /workspaces
// ======================================

router
  .route("/")
  .post(canCreateWorkspace, createWorkspace)
  .get(getMyWorkspaces);

// ======================================
// WORKSPACE TREE
// GET /workspaces/tree
// يجب أن يبقى قبل /:workspaceId
// ======================================

router.get("/tree", getUserWorkspaceTree);

// ======================================
// SINGLE WORKSPACE
// GET    /workspaces/:workspaceId
// PATCH  /workspaces/:workspaceId
// DELETE /workspaces/:workspaceId
// ======================================

router
  .route("/:workspaceId")
  .get(workspaceAccess, checkPermission("read:workspace"), getWorkspace)
  .patch(workspaceAccess, checkPermission("update:workspace"), updateWorkspace)
  .delete(
    workspaceAccess,
    checkPermission("delete:workspace"),
    deleteWorkspace,
  );

// ======================================
// ADD WORKSPACE MEMBER
// POST /workspaces/:workspaceId/members
// ======================================

router.post(
  "/:workspaceId/members",
  workspaceAccess,
  checkPermission("manage:members"),
  addMember,
);

// ======================================
// REMOVE WORKSPACE MEMBER
// DELETE /workspaces/:workspaceId/members/:userId
// ======================================

router.delete(
  "/:workspaceId/members/:userId",
  workspaceAccess,
  checkPermission("manage:members"),
  removeMember,
);

module.exports = router;
