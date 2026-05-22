const express = require("express");
const {
  getDashboardAllStats,
  getDashboardGroup1Stats,
  refreshDashboardGroup1Stats,
  getDashboardGroup2Stats,
  refreshDashboardGroup2Stats,
  getDashboardGroup3Stats,
  refreshDashboardGroup3Stats,
  getDashboardGroup4Stats,
  refreshDashboardGroup4Stats,
} = require("../services/dashboardStatsServices");
const authService = require("../services/authService");

const router = express.Router();

router.use(authService.protect);

router.route("/").get(getDashboardAllStats);
router.route("/group-1").get(getDashboardGroup1Stats);
router.route("/group-1/refresh").post(refreshDashboardGroup1Stats);
router.route("/group-2").get(getDashboardGroup2Stats);
router.route("/group-2/refresh").post(refreshDashboardGroup2Stats);
router.route("/group-3").get(getDashboardGroup3Stats);
router.route("/group-3/refresh").post(refreshDashboardGroup3Stats);
router.route("/group-4").get(getDashboardGroup4Stats);
router.route("/group-4/refresh").post(refreshDashboardGroup4Stats);

module.exports = router;
