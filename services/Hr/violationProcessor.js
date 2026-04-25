const ViolationLog = require("../../models/Hr/violationLogModel");
const groupsModel = require("../../models/Hr/groupsModel");
const staffModel = require("../../models/Hr/staffModel");
const DeductionTypes = require("../../models/Hr/deductionTypesModel");
const ActionExecutionLog = require("../../models/Hr/actionExecutionLogModel");

const createViolationAndProcess = async (data) => {
  try {
    /* ===============================
       1. CREATE VIOLATION
    =============================== */
    const violation = await ViolationLog.create(data);

    const { userId, companyId, violationType, violationDate } = violation;

    /* ===============================
       2. GET STAFF + GROUP
    =============================== */
    const staff = await staffModel.findById(userId).lean();
    if (!staff) return violation;

    const group = await groupsModel.findById(staff.groupId).lean();
    if (!group) return violation;

    /* ===============================
       3. GET RULE
    =============================== */
    const rule = await DeductionTypes.findOne({
      companyId,
      policyId: group.deductionPolicy,
    }).lean();

    if (!rule) return violation;

    /* ===============================
       4. PERIOD (MONTH)
    =============================== */
    const date = new Date(violationDate);

    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    /* ===============================
       5. COUNT VIOLATIONS
    =============================== */
    const count = await ViolationLog.countDocuments({
      userId,
      companyId,
      violationType,
      isExcused: false,
      violationDate: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    });

    /* ===============================
       6. FIND MATCHING STAGE
    =============================== */
    let matchedStage = null;

    for (const stage of rule.stages || []) {
      const min = Number(stage.occurrence?.min);
      const max =
        stage.occurrence?.max == null ? null : Number(stage.occurrence?.max);

      if (count >= min && (max === null || count <= max)) {
        matchedStage = stage;
        break;
      }
    }

    if (!matchedStage) return violation;

    /* ===============================
       7. EXECUTE ACTIONS
    =============================== */
    for (const action of matchedStage.actions || []) {
      let payload = {
        userId,
        companyId,
        violationType,
        actionType: action.actionType,
        occurrenceCount: count,
        periodStart: startOfMonth,
        periodEnd: endOfMonth,
      };

      if (action.actionType === "deduction") {
        payload.deduction = {
          unit: action.deductionUnit,
          value: action.deductionValue,
        };
      }

      try {
        await ActionExecutionLog.create(payload);
      } catch (err) {
        if (err.code === 11000) {
          console.warn("⚠️ Duplicate action prevented");
        } else {
          console.error("❌ Action log error:", err.message);
        }
      }
    }


    console.log(`✅ Violation processed | user: ${userId} | count: ${count}`);

    return violation;
  } catch (err) {
    console.error("❌ Violation processing failed:", err.message);
    throw err;
  }
};

module.exports = {
  createViolationAndProcess,
};
