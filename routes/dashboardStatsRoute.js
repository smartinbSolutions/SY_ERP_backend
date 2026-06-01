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

router.route("/").get(authService.allowedTo("dashboard.read"), getDashboardAllStats);
router.route("/group-1").get(authService.allowedTo("dashboard.read"), getDashboardGroup1Stats);
router.route("/group-1/refresh").post(authService.allowedTo("dashboard.read"), refreshDashboardGroup1Stats);
router.route("/group-2").get(authService.allowedTo("dashboard.read"), getDashboardGroup2Stats);
router.route("/group-2/refresh").post(authService.allowedTo("dashboard.read"), refreshDashboardGroup2Stats);
router.route("/group-3").get(authService.allowedTo("dashboard.read"), getDashboardGroup3Stats);
router.route("/group-3/refresh").post(authService.allowedTo("dashboard.read"), refreshDashboardGroup3Stats);
router.route("/group-4").get(authService.allowedTo("dashboard.read"), getDashboardGroup4Stats);
router.route("/group-4/refresh").post(authService.allowedTo("dashboard.read"), refreshDashboardGroup4Stats);

module.exports = router;
