const express = require("express");

const {
  getAllLeads,
  getOneLead,
  createLead,
  updateLead,
  deleteLead,
  qualifyLead,
} = require("../../controllers/CRM/lead.controller");

const { protect } = require("../../services/authService");

const router = express.Router();

router.use(protect);

router.route("/").get(getAllLeads).post(createLead);

router.route("/:id").get(getOneLead).put(updateLead).delete(deleteLead);

router.route("/:id/qualify").patch(qualifyLead);

module.exports = router;
