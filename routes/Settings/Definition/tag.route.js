const express = require("express");

const authService = require("../../../services/authService");
const {
  getTags,
  createTag,
  getTag,
  updateTag,
  deleteTag,
} = require("../../../controllers/Settings/Definition/tag.controller");
const tagRout = express.Router();

tagRout.use(authService.protect);

tagRout
  .route("/")
  .get(getTags)
  .post(authService.checkCompanyEditable, createTag);

tagRout
  .route("/:id")
  .get(getTag)
  .put(authService.checkCompanyEditable, updateTag)
  .delete(authService.checkCompanyEditable, deleteTag);

module.exports = tagRout;
