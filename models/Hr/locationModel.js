const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    name: String,
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },

  { timestamps: true },
);

module.exports = mongoose.model("hrlocation", locationSchema);
