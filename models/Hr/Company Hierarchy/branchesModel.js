const mongoose = require("mongoose");

const branchesSchema = new mongoose.Schema(
  {
    name: String,
    AlternativeName: String,
    routers: [
      {
        name: { type: String },
        bssid: { type: String },
        isActive: { type: Boolean },
      },
    ],
    location: {
      name: String,
      latitude: {
        type: Number,
        // required: true,
      },
      longitude: {
        type: Number,
        // required: true,
      },
    },
    email: String,
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("branches", branchesSchema);
