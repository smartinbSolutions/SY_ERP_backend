const express = require("express");
const router = express.Router();

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const { workspaceAccess } = require("../../middlewares/Tasks/AccessMiddleware");
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
  .post(
    hrAuthServices.protectStaffOrERP,
    checkPermission("create"),
    createWorkspace,
  )
  .get(hrAuthServices.protectStaffOrERP, getMyWorkspaces);

// WORKSPACE TREE (USER VIEW)

router.get("/tree", hrAuthServices.protectStaffOrERP, getUserWorkspaceTree);

// SINGLE WORKSPACE

router
  .route("/:id")
  .get(hrAuthServices.protectStaffOrERP, workspaceAccess, getWorkspace)
  .patch(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    checkPermission("update"),
    updateWorkspace,
  )
  .delete(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    checkPermission("delete"),
    deleteWorkspace,
  );

// MEMBERS MANAGEMENT

router.post(
  "/:id/members",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("manage"),
  addMember,
);

router.delete(
  "/:id/members/:userId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("manage"),
  removeMember,
);

module.exports = router;
