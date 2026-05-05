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

// CREATE + GET ALL WORKSPACES

router
  .route("/")
  .post(hrAuthServices.protectStaffOrERP, createWorkspace)
  .get(hrAuthServices.protectStaffOrERP, getMyWorkspaces);

// WORKSPACE TREE

router.get("/tree", hrAuthServices.protectStaffOrERP, getUserWorkspaceTree);

// SINGLE WORKSPACE

router
  .route("/:id")
  .get(hrAuthServices.protectStaffOrERP, workspaceAccess, getWorkspace)
  .patch(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    checkPermission("update:workspace"),
    updateWorkspace,
  )
  //not for  now maybe will use in future
  .delete(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    checkPermission("delete:workspace"),
    deleteWorkspace,
  );

// MEMBERS MANAGEMENT

router.post(
  "/:id/members",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("manage:members"),
  addMember,
);

router.delete(
  "/:id/members/:userId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("manage:members"),
  removeMember,
);

module.exports = router;
