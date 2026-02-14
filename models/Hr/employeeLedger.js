const mongoose = require("mongoose");

const employeeLedgerSchema = new mongoose.Schema(
  {
    // الموظف
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
      index: true,
    },

    // الشركة
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    // النظام التابع له
    module: {
      type: String,
      enum: ["leave", "overtime", "advance", "salary", "penalty"],
      required: true,
      index: true,
    },

    // مرجع العملية (LeaveRequest / OvertimeRequest ...)
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },

    // نوع الحركة
    transactionType: {
      type: String,
      enum: ["credit", "debit", "adjustment"],
      required: true,
    },

    // القيمة
    amount: {
      type: Number,
      required: true,
    },

    // وحدة القياس
    unit: {
      type: String,
      enum: ["day", "hour", "money"],
      required: true,
    },

    // الرصيد بعد العملية (اختياري الآن، مهم لاحقًا)
    balanceAfter: {
      type: Number,
    },

    // شرح
    description: {
      type: String,
      trim: true,
    },

    // من نفذ
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
    },

    // المصدر
    source: {
      type: String,
      enum: ["system", "manager", "admin", "employee"],
      default: "system",
    },

    // حالة العملية
    status: {
      type: String,
      enum: ["active", "reversed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("EmployeeLedger", employeeLedgerSchema);
