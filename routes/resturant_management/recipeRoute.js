const express = require("express");
const authService = require("../../services/authService");
const {
  createRecipe,
  updateRecipe,
  getAllRecipes,
  getOneRecipe,
  deleteRecipe,
} = require("../../services/resturant_management/recipeService");

const router = express.Router();
router.use(authService.protect);

router
  .route("/")
  .get(authService.allowedTo("recipes.read"), getAllRecipes)
  .post(authService.allowedTo("recipes.create"), createRecipe);
router
  .route("/:id")
  .get(authService.allowedTo("recipes.read"), getOneRecipe)
  .put(authService.allowedTo("recipes.update"), updateRecipe)
  .delete(authService.allowedTo("recipes.delete"), deleteRecipe);

module.exports = router;
