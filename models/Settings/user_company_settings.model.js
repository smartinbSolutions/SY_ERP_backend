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

    tagIds: [{ type: mongoose.Schema.ObjectId, ref: "Tag" }],
    expenseTagIds: [{ type: mongoose.Schema.ObjectId, ref: "Tag" }],
    purchaseTagIds: [{ type: mongoose.Schema.ObjectId, ref: "Tag" }],
    salesTagIds: [{ type: mongoose.Schema.ObjectId, ref: "Tag" }],

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
  { timestamps: true },
);

UserCompanySettingsSchema.index({ companyId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model(
  "UserCompanySettings",
  UserCompanySettingsSchema,
);
