const express = require("express");

const authService = require("../../../services/authService");
const {
  getTags,
  createTag,
  getTag,
  updateTag,
  deleteTag,
  setDocTags,
} = require("../../../controllers/Settings/Definition/tag.controller");
const tagRout = express.Router();

tagRout.use(authService.protect);

tagRout
  .route("/")
  .get(authService.allowedTo("definition.read"), getTags)
  .post(
    authService.allowedTo("definition.create"),
    authService.checkCompanyEditable,
    createTag,
  );

tagRout
  .route("/:id")
  .get(authService.allowedTo("definition.read"), getTag)
  .put(
    authService.allowedTo("definition.update"),
    authService.checkCompanyEditable,
    updateTag,
  )
  .delete(
    authService.allowedTo("definition.delete"),
    authService.checkCompanyEditable,
    deleteTag,
  );

tagRout.put(
  "/assign/:refType/:docId",
  authService.allowedTo("definition.update"),
  authService.checkCompanyEditable,
  setDocTags,
);

module.exports = tagRout;
