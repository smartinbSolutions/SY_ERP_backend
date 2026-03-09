const mongoose = require("mongoose");

const overtimeTypeSchema = new mongoose.Schema(
  {
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OvertimePolicy",
      required: true,
    },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    typeKey: {
      type: String,
      required: true,
      enum: ["normal", "holiday"],
    },
    rateMultiplier: {
      type: Number,
      required: true,
    },
    weeklyLimit: {
      type: Number,
      default: null,
    },
    dailyLimit: {
      type: Number,
      default: null,
    },
    givesLeaveBalance: {
      type: Boolean,
      default: false,
    },
    leaveMultiplier: {
      type: Number,
      default: 0,
    },
    requiresAttachment: {
      type: Boolean,
      default: false,
    },
    applicableDayType: {
      type: String,
      enum: ["workday", "holiday", "both"],
      default: "workday",
    },
  },
  {
    timestamps: true,
  },
);

overtimeTypeSchema.index({ policyId: 1, typeKey: 1 }, { unique: true });

overtimeTypeSchema.pre("save", function (next) {
  if (
    this.weeklyLimit != null &&
    this.dailyLimit != null &&
    this.weeklyLimit < this.dailyLimit
  ) {
    return next(
      new Error("Weekly limit must be greater than or equal to daily limit"),
    );
  }
  next();
});

overtimeTypeSchema.pre("findOneAndUpdate", function (next) {
  this.options.runValidators = true; 
  const update = this.getUpdate();

  const weekly = update.weeklyLimit ?? update.$set?.weeklyLimit;
  const daily = update.dailyLimit ?? update.$set?.dailyLimit;

  if (weekly != null && daily != null && weekly < daily) {
    return next(
      new Error("Weekly limit must be greater than or equal to daily limit"),
    );
  }

  next();
});

module.exports = mongoose.model("OvertimeType", overtimeTypeSchema);
