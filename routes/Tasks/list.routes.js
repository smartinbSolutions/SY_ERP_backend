const express = require("express");
const router = express.Router();

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

router.post(
  "/",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("create"),
  createList,
);

router.get(
  "/:workspaceId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  getLists,
);

router.get(
  "/single/:id",
  hrAuthServices.protectStaffOrERP,
  listAccess,
  getList,
);

router.patch(
  "/:id",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  listAccess,
  checkPermission("update"),
  updateList,
);

router.delete(
  "/:id",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  listAccess,
  checkPermission("delete"),
  deleteList,
);

router.post(
  "/:id/members",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  listAccess,
  checkPermission("manage"),
  addMember,
);

module.exports = router;
