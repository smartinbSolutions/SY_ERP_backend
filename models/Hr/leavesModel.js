const mongoose = require("mongoose");

const LeaveSchema = new mongoose.Schema({
  
  /* ===== Policy Relation ===== */
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LeavePolicy",
    required: true,
  },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  /* ===== Leave Type ===== */

   typeKey: {
    type: String,
    required: true,
    enum: [
      "annual",      
      "maternity",   
      "sick",      
      "paternity",   
      "marriage",    
      "bereavement", 
      "hajj",        
      "unpaid",      
    ],
  },

  requiresAttachment: {
    type: Boolean,
    default: false,
  },

  /* ===== Annual Leave Rules ===== */
  annualRules: [
    {

      categoryName: String,
      servicePeriod: {
        from: {
          value: Number,
          unit: String,
        },
        to: {
          value: Number,
          unit: String,
        },
      },

      days: Number,
      payPercentage: Number,
    },
  ],

  sickRules: [
    {
      stageName: String,
      days: Number,
      payPercentage: Number,
      requiresMedicalReport: Boolean,
      dependsOnPreviousStage: Boolean,
    },
  ],

  maternityRules: [
    {
      childOrder: Number,
      days: Number,
      payPercentage: Number,
      gender: {
        type: String,
        enum: ["Male", "Female"],
      },
    },
  ],

  singleRules: {
    days: Number,
    payPercentage: Number,
    minServicePeriod: {
      value: Number,
      unit: String,
    },
  },

  /* ===== Meta ===== */
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Leave", LeaveSchema);
