const express = require("express");
const {
  getLabels,
  createLabel,
  getLabel,
  updataLabel,
  deleteLabel,
} = require("../services/labelsServices");

const authService = require("../services/authService");
const LabelRout = express.Router();
// authService.allowedTo("label"),
LabelRout.route("/")
  .get(getLabels)
  .post(authService.protect, authService.checkCompanyEditable, createLabel);

LabelRout.route("/:id")
  .get(getLabel)
  .put(authService.protect, authService.checkCompanyEditable, updataLabel)
  .delete(authService.protect, authService.checkCompanyEditable, deleteLabel);

module.exports = LabelRout;
