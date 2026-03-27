const mongoose = require("mongoose");

const productionLogModel = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
    },
    bomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "billOfMaterials",
    },
    consumedMaterials: [
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
    producedQuantity: {
      value: Number,
      unit: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
    },
    selectedUnit: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
    unitEqual: { type: Number, default: 1 },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    counter: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("productionLog", productionLogModel);
