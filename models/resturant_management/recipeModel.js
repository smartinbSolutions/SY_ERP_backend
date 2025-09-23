const mongoose = require("mongoose");

const recipeSchema = new mongoose.Schema(
  {
    name: String,
    recipeArray: [
      {
        _id: false,
        rawMatrialId: {
          type: mongoose.Schema.ObjectId,
          ref: "RawMaterial",
          required: true,
        },
        cost: {
          type: Number,
          default: 0,
        },
        unit: {
          type: mongoose.Schema.ObjectId,
          ref: "Unit",
        },
        quantity: {
          type: Number,
        },
        calories: String,
      },
    ],
    overAllCost: {
      type: Number,
      default: 0,
    },
    overAllCalories: String,
    sync: { type: Boolean, default: false },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
  { collection: "recipe" }
);

module.exports = mongoose.model("recipe", recipeSchema);
