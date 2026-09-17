const express = require("express");

const {
  getAllOpportunities,
  getOneOpportunity,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} = require("../../controllers/CRM/opportunity.controller");
const { protect } = require("../../services/authService");

const router = express.Router();

router.use(protect);

router.route("/").get(getAllOpportunities).post(createOpportunity);

router
  .route("/:id")
  .get(getOneOpportunity)
  .put(updateOpportunity)
  .delete(deleteOpportunity);

module.exports = router;
