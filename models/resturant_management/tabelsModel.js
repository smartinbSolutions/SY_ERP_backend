const mongoose = require("mongoose");

const tablesSchema = new mongoose.Schema(
  {
    tableNumber: { type: String, required: true },
    capacity: Number,
    status: String,
    location: String,
    qrCode: String,
    currentOrder: {
      type: mongoose.Schema.ObjectId,
      ref: "MenuOrder",
    },
    companyId: String,
    sync: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Table", tablesSchema);
