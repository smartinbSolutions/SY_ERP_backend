const express = require("express");

const {
  getAllActivities,
  getOneActivity,
  createActivity,
  updateActivity,
  deleteActivity,
} = require("../../controllers/CRM/activity.controller");

const { protect } = require("../../services/authService");

const router = express.Router();

router.use(protect);

router.route("/").get(getAllActivities).post(createActivity);

router
  .route("/:id")
  .get(getOneActivity)
  .put(updateActivity)
  .delete(deleteActivity);

module.exports = router;
