const mongoose = require("mongoose");

const ShortageSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "company",
      required: true,
      index: true,
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "warehouse",
      required: true,
    },

    currentQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    minimumQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    neededQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,

      enum: ["pending", "approved", "ordered", "received", "cancelled"],

      default: "pending",
    },

    source: {
      type: String,
      enum: [
        "system", // تم اكتشافه تلقائيا
        "manual", // إضافة يدوية
        "purchase", // من فاتورة شراء
        "sale", // من مبيعات
        "inventory",
      ],
      default: "system",
    },

    reference: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "referenceModel",
    },

    referenceModel: {
      type: String,
      enum: ["purchaseInvoice", "saleInvoice", "inventory"],
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    detectedAt: {
      type: Date,
      default: Date.now,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },

  {
    timestamps: true,
  },
);

ShortageSchema.index({
  companyId: 1,
  status: 1,
  productId: 1,
});

ShortageSchema.index({
  companyId: 1,
  warehouseId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Shortage", ShortageSchema);
