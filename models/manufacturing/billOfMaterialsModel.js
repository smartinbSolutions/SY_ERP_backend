const mongoose = require("mongoose");

const billOfMaterialsModel = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
    },
    baseQuantity: {
      value: Number,
      unit: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
    },
    selectedUnit: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
    unitEqual: { type: Number, default: 1 },
    ingredients: [
      {
        rawMaterialId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "product",
        },
        quantity: {
          value: Number,
          unit: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
        },
        selectedUnit: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
        unitEqual: { type: Number, default: 1 },
        _id: false,
      },
    ],
    preparationSteps: [
      {
        _id: false,
        stepNumber: {
          type: Number,
          required: true,
          min: 1,
        },
        instruction: {
          type: String,
          required: true,
          trim: true,
        },
        ingredients: [
          {
            _id: false,
            rawMaterialId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "product",
              required: true,
            },
            quantity: {
              type: Number,
              required: true,
              min: 0,
            },
          },
        ],
        preparationTimeMinutes: {
          type: Number,
          min: 0,
          default: 0,
        },
      },
    ],
    isActive: { type: Boolean, default: true },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("billOfMaterials", billOfMaterialsModel);
