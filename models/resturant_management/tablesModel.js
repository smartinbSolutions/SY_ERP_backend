const mongoose = require("mongoose");

const tablesSchema = new mongoose.Schema(
  {
    tableNumber: { type: String, required: true },
    capacity: Number,
    status: String,
    location: String,
    qrCode: String,
    companyId: String,
    sync: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Table", tablesSchema);
