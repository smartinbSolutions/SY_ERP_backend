const mongoose = require("mongoose");

const violationLogModel = require("../../../models/Hr/Deductions/violationLogModel");
const DeductionTypes = require("../../../models/Hr/Deductions/deductionTypesModel");
const ActionExecutionLog = require("../../../models/Hr/Deductions/actionExecutionLogModel");
const staffModel = require("../../../models/Hr/Staffs/staffModel");
const groupsModel = require("../../../models/Hr/Attendance/groupsModel");

const { getOccurrencePeriod } = require("../../../utils/getOccurrencePeriod");

require("../../../models/Hr/Settings/locationModel");
const createViolationAndProcess = async (data) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Create the violation
    const [violation] = await violationLogModel.create([data], { session });

    const { userId, companyId, violationType, violationDate } = violation;

    // Load employee
    const staff = await staffModel
      .findById(userId)
      .session(session)
      .lean();

    if (!staff) {
      throw new Error("STAFF_NOT_FOUND");
    }

    // Load employee group and location
    const group = await groupsModel
      .findById(staff.groupId)
      .populate("locationId")
      .session(session)
      .lean();

    if (!group) {
      throw new Error("GROUP_NOT_FOUND");
    }

    const location = group.locationId;

    // Find deduction rule
    const rule = await DeductionTypes.findOne({
      companyId,
      policyId: group.deductionPolicy,
      violationType,
    })
      .session(session)
      .lean();

    if (!rule) {
      await session.commitTransaction();
      return violation;
    }

    // Calculate occurrence period
    const { periodStart, periodEnd } = getOccurrencePeriod({
      frequency: rule.resetFrequency,
      violationDate,
      hireDate: staff.hireDate,
      timezone: location?.timezone,
    });

    // Count violations within the occurrence period
    const count = await violationLogModel
      .countDocuments({
        userId,
        companyId,
        violationType,
        isExcused: false,
        violationDate: {
          $gte: periodStart,
          $lt: periodEnd,
        },
      })
      .session(session);

    // Find matching stage
    let matchedStage = null;

    for (const stage of rule.stages || []) {
      const min = Number(stage.occurrence?.min);

      const max =
        stage.occurrence?.max == null
          ? null
          : Number(stage.occurrence?.max);

      if (count >= min && (max === null || count <= max)) {
        matchedStage = stage;
        break;
      }
    }

    if (!matchedStage) {
      await session.commitTransaction();
      return violation;
    }

    // Execute stage actions
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

      await ActionExecutionLog.create([payload], {
        session,
      });
    }

    await session.commitTransaction();

    return violation;
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (abortError) {}

    throw err;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createViolationAndProcess,
};