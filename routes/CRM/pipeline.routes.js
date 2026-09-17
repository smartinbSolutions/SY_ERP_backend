const express = require("express");

const {
  getAllPipelines,
  getOnePipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
} = require("../../controllers/CRM/pipeline.controller");

const { protect } = require("../../services/authService");
const router = express.Router();

router.use(protect);

router.route("/").get(getAllPipelines).post(createPipeline);

router
  .route("/:id")
  .get(getOnePipeline)
  .put(updatePipeline)
  .delete(deletePipeline);

module.exports = router;
