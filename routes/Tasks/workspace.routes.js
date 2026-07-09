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
// ROOT: /workspaces
// ======================================

// CREATE + GET ALL
router
  .route("/")
  .post(
    hrAuthServices.protectStaffOrERP,
    canCreateWorkspace,
  
    createWorkspace,
  )
  .get(hrAuthServices.protectStaffOrERP, getMyWorkspaces);

// WORKSPACE TREE
router.get("/tree", hrAuthServices.protectStaffOrERP, getUserWorkspaceTree);

// ======================================
// SINGLE WORKSPACE
// /workspaces/:workspaceId
// ======================================

router
  .route("/:workspaceId")
  .get(hrAuthServices.protectStaffOrERP, workspaceAccess, getWorkspace)
  .patch(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    checkPermission("update:workspace"),
    updateWorkspace,
  )
  .delete(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    checkPermission("delete:workspace"),
    deleteWorkspace,
  );

// ======================================
// MEMBERS MANAGEMENT
// ======================================

// ADD MEMBER
router.post(
  "/:workspaceId/members",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("manage:members"),
  addMember,
);

// REMOVE MEMBER
router.delete(
  "/:workspaceId/members/:userId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("manage:members"),
  removeMember,
);

module.exports = router;
