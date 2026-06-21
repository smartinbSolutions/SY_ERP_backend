const mongoose = require("mongoose");

const payrollEmployeeLineSchema = new mongoose.Schema(
  {
    payrollPeriodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollPeriod",
      required: true,
    },

    payrollEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployeePayroll",
      required: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },

    category: {
      type: String,
      enum: ["earning", "deduction", "info"],
      required: true,
    },

    type: {
      type: String,
      enum: [
        "base_salary",
        "leave_deduction",
        "fixed_allowance",
        "attendance_summary",
        "overtime",
        "bonus",
        "lateness_deduction",
        "absence_deduction",
        "early_leave_deduction",
        "loan_installment",
        "advance_installment",
        "penalty",
        "manual_adjustment",
      ],
      required: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    label: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: null,
    },

    quantity: {
      type: Number,
      default: null,
    },

    unit: {
      type: String,
      enum: ["hour", "minute", "day", "fixed", "installment"],
      required: false,
    },

    rate: {
      type: Number,
      default: null,
    },

    multiplier: {
      type: Number,
      default: null,
    },

    Originalamount: {
      type: Number,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    affectsNetSalary: {
      type: Boolean,
      default: true,
    },

    sourceType: {
      type: String,
      enum: [
        "attendance",
        "overtime_request",
        "leave_request",
        "loan",
        "advance",
        "bonus",
        "penalty",
        "manual",
        "compensation_profile",
      ],
      default: null,
    },

    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    sourceRef: {
      type: String,
      default: null,
    },

    effectiveDate: {
      type: Date,
      default: null,
    },

    isManual: {
      type: Boolean,
      required: true,
      default: false,
    },

    isSystemGenerated: {
      type: Boolean,
      required: true,
      default: true,
    },
    status: {
      type: String,
      enum: ["success", "failed", "skipped"],
      default: "success",
    },
    errorMessage: String,
  },
  {
    timestamps: true,
  },
);

// indexes for performance
payrollEmployeeLineSchema.index({ payrollPeriodId: 1 });
payrollEmployeeLineSchema.index({ payrollEmployeeId: 1 });
payrollEmployeeLineSchema.index({ employeeId: 1 });

module.exports = mongoose.model(
  "PayrollEmployeeLine",
  payrollEmployeeLineSchema,
);
