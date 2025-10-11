const mongoose = require("mongoose");

const SalesPointSchema = new mongoose.Schema(
  {
    name: String,
    stock: { id: String, name: String, _id: false },
    salesPointType: String,
    funds: [{ id: String, name: String, _id: false }],
    sold: Number,
    isOpen: { type: Boolean, default: false },
    location: String,
    salesPointCurrency: { type: mongoose.Schema.ObjectId, ref: "Currency" },
    tags: [
      {
        id: String,
        name: String,
        color: String,
        _id: false,
      },
    ],
    description: String,
    allowRounding: { type: Boolean, default: false },
    roundingType: { type: String, default: "" },
    sync: { type: Boolean, default: false },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },

  { timestamps: true }
);

module.exports = mongoose.model("salesPoints", SalesPointSchema);
