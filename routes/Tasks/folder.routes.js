const express = require("express");
const router = express.Router();

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
  createFolder,
  updateFolder,
  deleteFolder,
  getFolders,
} = require("../../controllers/Tasks/folder.controller");

const { folderAccess } = require("../../middlewares/Tasks/folderAccess");
router.post("/", hrAuthServices.protectStaffOrERP, createFolder);

router.get(
  "/workspace/:workspaceId",
  hrAuthServices.protectStaffOrERP,
  getFolders,
);

router.patch(
  "/:id",
  hrAuthServices.protectStaffOrERP,
  folderAccess,
  updateFolder,
);

router.delete(
  "/:id",
  hrAuthServices.protectStaffOrERP,
  folderAccess,
  deleteFolder,
);

module.exports = router;
