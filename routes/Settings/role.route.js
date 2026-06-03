const express = require("express");
const roleRouter = express.Router();
const roleController = require("../../controllers/Settings/role.controller");
const authService = require("../../services/authService");

roleRouter.use(authService.protect);

roleRouter
  .route("/")
  .post(authService.allowedTo("roles.create"), roleController.createRole)
  .get(authService.allowedTo("roles.read"), roleController.getRoles);

roleRouter
  .route("/:id")
  .get(authService.allowedTo("roles.read"), roleController.getRole)
  .patch(authService.allowedTo("roles.update"), roleController.updateRole)
  .put(authService.allowedTo("roles.update"), roleController.updateRole)
  .delete(authService.allowedTo("roles.delete"), roleController.deleteRole);

module.exports = roleRouter;
