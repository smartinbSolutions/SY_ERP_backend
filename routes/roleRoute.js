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
  .get(authService.protect, getRoles)
  .post(
    authService.protect,
    authService.checkCompanyEditable,
    createRoleVlaidator,
    createRole,
  );

roleRout
  .route("/:id")
  .get(authService.protect, getRolVlaidator, getRole)
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    updateRoleVlaidator,
    updataRole,
  )
  .delete(
    authService.protect,
    authService.checkCompanyEditable,
    deleteRoleVlaidator,
    deleteRole,
  );
module.exports = roleRout;
