const express = require("express");

const {
  getAllReferences,
  getOneReference,
  createReference,
  updateReference,
  deleteReference,
} = require("../../controllers/CRM/reference.controller");

const { protect } = require("../../services/authService");

const router = express.Router();

router.use(protect);

router.route("/").get(getAllReferences).post(createReference);

router
  .route("/:id")
  .get(getOneReference)
  .put(updateReference)
  .delete(deleteReference);

module.exports = router;
