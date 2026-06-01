const express = require("express");
const {
  createRoleVlaidator,
  updateRoleVlaidator,
  getRolVlaidator,
  deleteRoleVlaidator,
} = require("../utils/validators/roleValidator");
const {
  getRole,
  createRole,
  getRoles,
  updataRole,
  deleteRole,
} = require("../services/roleServices");

const authService = require("../services/authService");

const roleRout = express.Router();

roleRout
  .route("/")
  .get(authService.protect, authService.allowedTo("roles.read"), getRoles)
  .post(
    authService.protect,
    authService.allowedTo("roles.create"),
    authService.checkCompanyEditable,
    createRoleVlaidator,
    createRole,
  );

roleRout
  .route("/:id")
  .get(authService.protect, authService.allowedTo("roles.read"), getRolVlaidator, getRole)
  .put(
    authService.protect,
    authService.allowedTo("roles.update"),
    authService.checkCompanyEditable,
    updateRoleVlaidator,
    updataRole,
  )
  .delete(
    authService.protect,
    authService.allowedTo("roles.delete"),
    authService.checkCompanyEditable,
    deleteRoleVlaidator,
    deleteRole,
  );
module.exports = roleRout;
