const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    name: String,

    radius: {
      type: Number,
      default: 150,
    },

    timezone: {
      type: String,
      default: null,
    },
    longitude: {
      type: Number,
      required: true,
    },
    latitude: {
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
