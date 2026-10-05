const express = require("express");

const {
  getAllLeads,
  getOneLead,
  createLead,
  updateLead,
  deleteLead,
  convertLead,
  qualifyLead,
  markLeadAsLost,
} = require("../../controllers/CRM/lead.controller");

const { protect } = require("../../services/authService");

const router = express.Router();

router.use(protect);

router.route("/").get(getAllLeads).post(createLead);

router.route("/:id").get(getOneLead).put(updateLead).delete(deleteLead);
router.patch("/:id/qualify", qualifyLead);
router.patch("/:id/lost", markLeadAsLost);
router.post("/:id/convert", convertLead);

module.exports = router;
