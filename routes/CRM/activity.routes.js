const express = require("express");

const {
  getAllActivities,
  getOneActivity,
  createActivity,
  updateActivity,
  deleteActivity,
} = require("../../controllers/CRM/activity.controller");

const router = express.Router();

router.route("/").get(getAllActivities).post(createActivity);

router
  .route("/:id")
  .get(getOneActivity)
  .put(updateActivity)
  .delete(deleteActivity);

module.exports = router;

