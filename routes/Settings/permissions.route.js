const express = require("express");
const router = express.Router();

const permissionController = require("../../controllers/Settings/permissions.controller");
// const { protect } = require("../../services/authService");

// router.use(protect);

router.get("/", permissionController.getPermissions);

module.exports = router;
