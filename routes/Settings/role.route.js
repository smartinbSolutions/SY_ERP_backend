const express = require("express");
const roleRouter = express.Router();
const roleController = require("../../controllers/Settings/role.controller");
const authService = require("../../services/authService");

roleRouter.use(authService.protect);

roleRouter
  .route("/")
  .post(roleController.createRole)
  .get(roleController.getRoles);

roleRouter
  .route("/:id")
  .get(roleController.getRole)
  .patch(roleController.updateRole)
  .delete(roleController.deleteRole);

module.exports = roleRouter;
