const express = require("express");

const {
  getAllOpportunities,
  getOneOpportunity,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} = require("../../controllers/CRM/opportunity.controller");

const router = express.Router();

router.route("/").get(getAllOpportunities).post(createOpportunity);

router
  .route("/:id")
  .get(getOneOpportunity)
  .put(updateOpportunity)
  .delete(deleteOpportunity);

module.exports = router;
