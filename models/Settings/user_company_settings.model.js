const { default: mongoose } = require("mongoose");

const UserCompanySettingsSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, index: true },
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    salesPoint: { type: mongoose.Schema.ObjectId, ref: "salesPoints" },

    tagIds: [{ type: mongoose.Schema.ObjectId, ref: "Tags" }],
    expenseTagIds: [{ type: mongoose.Schema.ObjectId, ref: "Tags" }],
    purchaseTagIds: [{ type: mongoose.Schema.ObjectId, ref: "Tags" }],
    salesTagIds: [{ type: mongoose.Schema.ObjectId, ref: "Tags" }],

    selectedQuickActions: { type: [String], default: [] },

    stocks: [
      {
        stockId: { type: mongoose.Schema.ObjectId, ref: "Stock" },
        _id: false,
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "terminated", "suspended"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

UserCompanySettingsSchema.index({ companyId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model(
  "UserCompanySettings",
  UserCompanySettingsSchema
);
