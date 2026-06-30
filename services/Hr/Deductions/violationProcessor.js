const mongoose = require("mongoose");
const ViolationLog = require("../../../models/Hr/Deductions/violationLogModel");
const groupsModel = require("../../../models/Hr/Attendance/groupsModel");
const staffModel = require("../../../models/Hr/Staffs/staffModel");
const DeductionTypes = require("../../../models/Hr/Deductions/deductionTypesModel");
const ActionExecutionLog = require("../../../models/Hr/Deductions/actionExecutionLogModel");
const { getOccurrencePeriod } = require("../../../utils/getOccurrencePeriod");

const createViolationAndProcess = async (data) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    /* =========================
       1. CREATE VIOLATION
    ========================= */
    const [violation] = await ViolationLog.create([data], { session });

    const { userId, companyId, violationType, violationDate } = violation;

    /* =========================
       2. STAFF
    ========================= */
    const staff = await staffModel.findById(userId).session(session).lean();

    if (!staff) {
      throw new Error("STAFF_NOT_FOUND");
    }

    /* =========================
       3. GROUP + LOCATION
    ========================= */
    const group = await groupsModel
      .findById(staff.groupId)
      .populate("locationId")
      .session(session)
      .lean();

    if (!group) {
      throw new Error("GROUP_NOT_FOUND");
    }

    const location = group.locationId;

    /* =========================
       4. RULE
    ========================= */
    const rule = await DeductionTypes.findOne({
      companyId,
      policyId: group.deductionPolicy,
      violationType,
    })
      .session(session)
      .lean();

    // no rule → just save violation
    if (!rule) {
      await session.commitTransaction();
      return violation;
    }

    /* =========================
       5. OCCURRENCE PERIOD
    ========================= */
    const { periodStart, periodEnd } = getOccurrencePeriod({
      frequency: rule.resetFrequency,
      violationDate,
      hireDate: staff.hireDate,
      timezone: location?.timezone,
    });

    /* =========================
       6. COUNT VIOLATIONS
    ========================= */
    const count = await ViolationLog.countDocuments({
      userId,
      companyId,
      violationType,
      isExcused: false,
      violationDate: {
        $gte: periodStart,
        $lt: periodEnd,
      },
    }).session(session);

    /* =========================
       7. FIND STAGE
    ========================= */
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

    if (!matchedStage) {
      await session.commitTransaction();
      return violation;
    }

    /* =========================
       8. EXECUTE ACTIONS
    ========================= */
    for (const action of matchedStage.actions || []) {
      const payload = {
        userId,
        companyId,
        violationType,
        actionType: action.actionType,
        occurrenceCount: count,
        periodStart,
        periodEnd,
        sourceRuleId: rule._id,
      };

      if (action.actionType === "deduction") {
        payload.deduction = {
          unit: action.deductionUnit,
          value: action.deductionValue,
        };
      }

      await ActionExecutionLog.create([payload], { session });
    }

    /* =========================
       SUCCESS
    ========================= */
    await session.commitTransaction();

    return violation;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = {
  createViolationAndProcess,
};
