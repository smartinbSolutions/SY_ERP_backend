const mongoose = require("mongoose");
const opportunityModel = require("../../models/CRM/opportunityModel");
const pipelineModel = require("../../models/CRM/piplineModel");
const contactModel = require("../../models/CRM/contactModel");
const leadModel = require("../../models/CRM/leadModel");
const ApiError = require("../../utils/apiError");
const { generateCrmNumber } = require("../../utils/crmhelpers");
const activityModel = require("../../models/CRM/activityModel");

// The contact, with the CRM company it belongs to (the opportunity does not
// store the company; it is read from the contact).
const contactPopulate = () => ({
  path: "contactId",
  select: "fullName email phone crmCompanyId",
  populate: { path: "crmCompanyId", select: "name email" },
});

// ============ FILTER HELPERS ============

const OPPORTUNITY_STATUSES = ["open", "won", "lost"];

const hasValue = (value) =>
  value !== undefined && value !== null && value !== "";

const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "a,b" or ["a", "b"] -> ["a", "b"]
const toList = (value) =>
  (Array.isArray(value) ? value : String(value ?? "").split(","))
    .map((item) => String(item).trim())
    .filter(Boolean);

const toIdList = (value, label) => {
  const ids = toList(value);

  if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw new ApiError(`Invalid ${label}`, 400);
  }

  return ids;
};

const toNumber = (value, label) => {
  const number = Number(value);

  if (Number.isNaN(number)) {
    throw new ApiError(`Invalid ${label}`, 400);
  }

  return number;
};

// A date-only value ("2026-11-30") used as an upper bound covers that whole day.
const toDate = (value, label, endOfDay = false) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(`Invalid ${label}`, 400);
  }

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
};

// ============ GET ALL ============
//
// Filters (all optional, combined with AND). Id filters accept one id or a
// comma-separated list:
//   keyword                    title, description or number
//   status                     open | won | lost
//   pipelineId, ownerId, leadId
//   contactId                  the opportunity's contact
//   crmCompanyId               the CRM company of the opportunity's contact
//   probabilityMin / Max       0 - 100
//   closeFrom / closeTo        expected close date (YYYY-MM-DD)
exports.getAllOpportunities = async (req) => {
  const companyId = req.companyId;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const {
    keyword,
    status,
    pipelineId,
    ownerId,
    leadId,
    contactId,
    crmCompanyId,
    probabilityMin,
    probabilityMax,
    closeFrom,
    closeTo,
  } = req.query;

  const query = {
    companyId,
    deletedAt: null,
  };

  if (keyword) {
    const pattern = escapeRegex(keyword);

    query.$or = [
      { title: { $regex: pattern, $options: "i" } },
      { description: { $regex: pattern, $options: "i" } },
      { number: { $regex: pattern, $options: "i" } },
    ];
  }

  if (hasValue(status)) {
    const statuses = toList(status);

    if (statuses.some((item) => !OPPORTUNITY_STATUSES.includes(item))) {
      throw new ApiError("Invalid status", 400);
    }

    if (statuses.length) query.status = { $in: statuses };
  }

  if (hasValue(pipelineId)) {
    query.pipelineId = { $in: toIdList(pipelineId, "pipeline ID") };
  }

  if (hasValue(ownerId)) {
    query.ownerId = { $in: toIdList(ownerId, "owner ID") };
  }

  if (hasValue(leadId)) {
    query.leadId = { $in: toIdList(leadId, "lead ID") };
  }

  // Contact and company: the company is read from the contact, so a company
  // filter first finds that company's contacts. Both filters together
  // keep only the contacts that match both.
  if (hasValue(contactId) || hasValue(crmCompanyId)) {
    let contactIds = hasValue(contactId)
      ? toIdList(contactId, "contact ID")
      : null;

    if (hasValue(crmCompanyId)) {
      const companyContacts = await contactModel
        .find({
          companyId,
          deletedAt: null,
          crmCompanyId: { $in: toIdList(crmCompanyId, "company ID") },
        })
        .select("_id")
        .lean();

      const fromCompanies = companyContacts.map((item) => String(item._id));

      contactIds = contactIds
        ? contactIds.filter((id) => fromCompanies.includes(id))
        : fromCompanies;
    }

    query.contactId = { $in: contactIds };
  }

  if (hasValue(probabilityMin) || hasValue(probabilityMax)) {
    query.probability = {};

    if (hasValue(probabilityMin)) {
      query.probability.$gte = toNumber(probabilityMin, "probabilityMin");
    }

    if (hasValue(probabilityMax)) {
      query.probability.$lte = toNumber(probabilityMax, "probabilityMax");
    }
  }

  if (hasValue(closeFrom) || hasValue(closeTo)) {
    query.expectedCloseDate = {};

    if (hasValue(closeFrom)) {
      query.expectedCloseDate.$gte = toDate(closeFrom, "closeFrom");
    }

    if (hasValue(closeTo)) {
      query.expectedCloseDate.$lte = toDate(closeTo, "closeTo", true);
    }
  }

  const [total, opportunities] = await Promise.all([
    opportunityModel.countDocuments(query),

    opportunityModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email")
      .populate("pipelineId", "name")
      .populate("leadId", "LeadName email")
      .populate("currency")
      .populate(contactPopulate())
      .lean(),
  ]);

  /* ---------- last / next activity (2 queries for the whole page) ---------- */

  const opportunityIds = opportunities.map((o) => o._id);

  const pickPerOpportunity = (match, sort) =>
    activityModel.aggregate([
      {
        $match: {
          companyId,
          deletedAt: null,
          "relatedTo.type": "Opportunity",
          "relatedTo.id": { $in: opportunityIds },
          ...match,
        },
      },
      { $sort: sort },
      { $group: { _id: "$relatedTo.id", activity: { $first: "$$ROOT" } } },
      {
        $project: {
          "activity._id": 1,
          "activity.number": 1,
          "activity.type": 1,
          "activity.subject": 1,
          "activity.status": 1,
          "activity.priority": 1,
          "activity.outcome": 1,
          "activity.dueDate": 1,
          "activity.completedAt": 1,
        },
      },
    ]);

  const [lastRows, nextRows] = await Promise.all([
    // last: most recently completed
    pickPerOpportunity(
      { status: "completed", completedAt: { $ne: null } },
      { completedAt: -1 },
    ),
    // next: earliest planned activity that has a due date (overdue included)
    pickPerOpportunity(
      { status: "planned", dueDate: { $ne: null } },
      { dueDate: 1 },
    ),
  ]);

  const toMap = (rows) => new Map(rows.map((r) => [String(r._id), r.activity]));

  const lastMap = toMap(lastRows);
  const nextMap = toMap(nextRows);

  const data = opportunities.map((o) => ({
    ...o,
    lastActivity: lastMap.get(String(o._id)) || null,
    nextActivity: nextMap.get(String(o._id)) || null,
  }));

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: data.length,
    total,
    data,
  };
};

// ============ GET ONE ============
exports.getOneOpportunity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const opportunity = await opportunityModel
    .findOne({
      _id: id,
      companyId,
      deletedAt: null,
    })
    .populate("ownerId", "name email")
    .populate("tags", "name")
    .populate("pipelineId", "name stages settings")
    .populate(contactPopulate())
    .populate("leadId", "LeadName email")
    .populate("currency")
    .populate("interestedIn", "name")
    .populate({
      path: "stageHistory.movedBy",
      select: "name email",
    });

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  return opportunity;
};

// ============ HELPERS ============

const validatePipeline = async (pipelineId, companyId) => {
  const pipeline = await pipelineModel.findOne({
    _id: pipelineId,
    companyId,
    deletedAt: null,
    isActive: true,
  });

  if (!pipeline) {
    throw new ApiError(
      "Pipeline not found, inactive, deleted, or does not belong to this company",
      404,
    );
  }

  if (!pipeline.stages || pipeline.stages.length === 0) {
    throw new ApiError("Pipeline has no stages", 400);
  }

  return pipeline;
};

const getPipelineStage = (pipeline, stageKey) => {
  const stage = pipeline.stages.find(
    (item) => item.key === String(stageKey).toLowerCase(),
  );

  if (!stage) {
    throw new ApiError(
      `Stage "${stageKey}" does not exist in this pipeline`,
      400,
    );
  }

  return stage;
};

const validateStageOrder = (stage, currentStageOrder) => {
  if (Number(currentStageOrder) !== Number(stage.order)) {
    throw new ApiError(
      `Stage order does not match the selected stage. Expected ${stage.order}`,
      400,
    );
  }
};

// The contact is required and is the only link to the CRM company.
const validateContact = async (contactId, companyId) => {
  if (!contactId) {
    throw new ApiError("Contact is required", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(contactId)) {
    throw new ApiError("Invalid contact ID", 400);
  }

  const contact = await contactModel.findOne({
    _id: contactId,
    companyId,
    deletedAt: null,
  });

  if (!contact) {
    throw new ApiError(
      "Contact not found, deleted, or does not belong to this company",
      404,
    );
  }

  return contact;
};

// Currency is an id of one of the company's currencies.
const validateCurrency = (currency) => {
  if (!currency || !mongoose.Types.ObjectId.isValid(currency)) {
    throw new ApiError("A valid currency is required", 400);
  }
};

const validateLead = async (leadId, companyId) => {
  if (!leadId) return null;

  const lead = await leadModel.findOne({
    _id: leadId,
    companyId,
    deletedAt: null,
  });

  if (!lead) {
    throw new ApiError(
      "Lead not found, deleted, or does not belong to this company",
      404,
    );
  }

  return lead;
};

const getCurrentUserId = (req) => {
  return req.user?._id || req.user?.id || null;
};

const createInitialStageHistory = (stage, userId) => {
  return [
    {
      stageKey: stage.key,
      stageName: stage.name,
      enteredAt: new Date(),
      movedBy: userId || undefined,
    },
  ];
};

exports.createExitCriteriaStatus = (stage) => {
  return (stage.exitCriteria || []).map((criteria) => ({
    criteria,
    isCompleted: false,
    completedAt: null,
  }));
};

exports.createRequiredActionsStatus = (stage) => {
  return (stage.requiredActions || []).map((action) => ({
    type: action.type,
    title: action.title,
    isMandatory: action.isMandatory,
    isCompleted: false,
    completedAt: null,
  }));
};

const calculateDurationDays = (enteredAt, exitedAt) => {
  const milliseconds = exitedAt.getTime() - enteredAt.getTime();

  return Math.max(0, milliseconds / (1000 * 60 * 60 * 24));
};

const validateStageExit = (opportunity, currentStage, pipeline) => {
  if (!pipeline.settings?.requireExitCriteria) {
    return;
  }

  const incompleteCriteria = (opportunity.exitCriteriaStatus || []).filter(
    (item) => !item.isCompleted,
  );

  if (incompleteCriteria.length) {
    throw new ApiError(
      "Cannot move to the next stage. All exit criteria must be completed first.",
      400,
    );
  }

  const incompleteMandatoryActions = (
    opportunity.requiredActionsStatus || []
  ).filter((item) => item.isMandatory && !item.isCompleted);

  if (incompleteMandatoryActions.length) {
    throw new ApiError(
      "Cannot move to the next stage. All mandatory actions must be completed first.",
      400,
    );
  }
};

const validateStageTransition = (
  opportunity,
  currentStage,
  newStage,
  pipeline,
) => {
  if (currentStage.key === newStage.key) {
    return;
  }

  validateStageExit(opportunity, currentStage, pipeline);

  if (pipeline.settings?.allowSkipStages !== true) {
    if (Number(newStage.order) !== Number(currentStage.order) + 1) {
      throw new ApiError("You cannot skip stages in this pipeline", 400);
    }
  }
};

const buildStageHistory = (opportunity, newStage, userId) => {
  const history = [...(opportunity.stageHistory || [])];

  const now = new Date();

  const lastHistory = history[history.length - 1];

  if (lastHistory && !lastHistory.exitedAt) {
    lastHistory.exitedAt = now;

    lastHistory.durationDays = calculateDurationDays(
      new Date(lastHistory.enteredAt),
      now,
    );
  }

  history.push({
    stageKey: newStage.key,
    stageName: newStage.name,
    enteredAt: now,
    movedBy: userId || undefined,
  });

  return history;
};

const handleStatusChange = (updateData) => {
  if (!Object.prototype.hasOwnProperty.call(updateData, "status")) {
    return;
  }

  const status = updateData.status;

  if (status === "won") {
    updateData.actualCloseDate = new Date();

    delete updateData.lostReason;
    delete updateData.lostReasonCategory;

    return;
  }

  if (status === "lost") {
    const hasLostReason =
      Boolean(updateData.lostReason) || Boolean(updateData.lostReasonCategory);

    if (!hasLostReason) {
      throw new ApiError(
        "lostReason or lostReasonCategory is required when opportunity is lost",
        400,
      );
    }

    updateData.actualCloseDate = new Date();

    return;
  }

  if (status === "open") {
    updateData.actualCloseDate = null;
  }
};

// Sync opportunity status based on pipeline stage
const syncOpportunityStatusWithStage = (updateData, newStage) => {
  if (newStage.key === "closed_won") {
    updateData.status = "won";
    updateData.actualCloseDate = new Date();

    delete updateData.lostReason;
    delete updateData.lostReasonCategory;
  } else if (newStage.key === "closed_lost") {
    if (!updateData.lostReason && !updateData.lostReasonCategory) {
      throw new ApiError(
        "Lost reason is required before moving to closed lost",
        400,
      );
    }

    updateData.status = "lost";
    updateData.actualCloseDate = new Date();
  } else {
    updateData.status = "open";
    updateData.actualCloseDate = null;
  }
};

// ============ CREATE ============
exports.createOpportunity = async (req) => {
  const companyId = req.companyId;
  const body = req.body || {};

  const pipeline = await validatePipeline(body.pipelineId, companyId);

  const firstStage = [...pipeline.stages].sort((a, b) => a.order - b.order)[0];

  await validateContact(body.contactId, companyId);
  validateCurrency(body.currency);

  const userId = getCurrentUserId(req);
  const number = await generateCrmNumber(companyId, "opportunity");

  return opportunityModel.create({
    // from the form
    title: body.title,
    description: body.description,
    value: Number(body.value ?? 0),
    currency: body.currency,
    contactId: body.contactId,
    ownerId: body.ownerId,
    interestedIn: body.interestedIn,
    source: body.source,
    riskLevel: body.riskLevel || undefined,
    expectedCloseDate: body.expectedCloseDate || undefined,
    tags: body.tags,

    // set by the system: the pipeline's first stage
    pipelineId: pipeline._id,
    currentStageKey: firstStage.key,
    currentStageOrder: firstStage.order,
    probability: firstStage.probability,
    stageHistory: createInitialStageHistory(firstStage, userId),
    exitCriteriaStatus: exports.createExitCriteriaStatus(firstStage),
    requiredActionsStatus: exports.createRequiredActionsStatus(firstStage),
    status: "open",

    companyId,
    deletedAt: null,
    number,
  });
};

// ============ UPDATE ============
exports.updateOpportunity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const opportunity = await opportunityModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  const updateData = {
    ...req.body,
  };

  delete updateData.companyId;
  delete updateData.deletedAt;
  delete updateData.dealId;

  // These fields no longer exist on the opportunity
  delete updateData.bant;
  delete updateData.products;
  delete updateData.crmCompanyId;
  delete updateData.contactIds;

  // These are set by the system, never by the client
  delete updateData.leadId; // only set by lead conversion
  delete updateData.number;
  delete updateData.probability; // always comes from the stage
  delete updateData.status; // set only by moving to a closed stage

  const pipelineId = updateData.pipelineId || opportunity.pipelineId;

  const pipeline = await validatePipeline(pipelineId, companyId);

  // Pipeline cannot be changed after creation
  if (
    updateData.pipelineId &&
    String(updateData.pipelineId) !== String(opportunity.pipelineId)
  ) {
    throw new ApiError(
      "Changing the pipeline of an existing opportunity is not allowed",
      400,
    );
  }

  const stageChanged =
    updateData.currentStageKey !== undefined &&
    String(updateData.currentStageKey).toLowerCase() !==
      String(opportunity.currentStageKey).toLowerCase();

  let newStage = null;

  // Stage update
  if (
    updateData.currentStageKey !== undefined ||
    updateData.currentStageOrder !== undefined
  ) {
    const newStageKey =
      updateData.currentStageKey || opportunity.currentStageKey;

    newStage = getPipelineStage(pipeline, newStageKey);

    validateStageOrder(
      newStage,
      updateData.currentStageOrder ?? opportunity.currentStageOrder,
    );

    if (stageChanged) {
      const currentStage = getPipelineStage(
        pipeline,
        opportunity.currentStageKey,
      );

      validateStageTransition(opportunity, currentStage, newStage, pipeline);

      const userId = getCurrentUserId(req);

      updateData.currentStageKey = newStage.key;

      updateData.currentStageOrder = newStage.order;

      updateData.probability = newStage.probability;

      updateData.stageHistory = buildStageHistory(
        opportunity,
        newStage,
        userId,
      );

      updateData.exitCriteriaStatus =
        exports.createExitCriteriaStatus(newStage);
      updateData.requiredActionsStatus =
        exports.createRequiredActionsStatus(newStage);
    } else {
      updateData.currentStageKey = newStage.key;

      updateData.currentStageOrder = newStage.order;

      updateData.probability = newStage.probability;
    }
  }

  // Sync status with stage
  if (newStage) {
    syncOpportunityStatusWithStage(updateData, newStage);
  }

  // Validate the contact (required, cannot be cleared)
  if (updateData.contactId !== undefined) {
    await validateContact(updateData.contactId, companyId);
  }

  // Validate the currency
  if (updateData.currency !== undefined) {
    validateCurrency(updateData.currency);
  }

  // Risk level is optional: an empty value removes it
  if (updateData.riskLevel === "" || updateData.riskLevel === null) {
    delete updateData.riskLevel;
    updateData.$unset = { ...(updateData.$unset || {}), riskLevel: 1 };
  }

  const updatedOpportunity = await opportunityModel.findOneAndUpdate(
    {
      _id: id,
      companyId,
      deletedAt: null,
    },

    updateData,

    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedOpportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  return updatedOpportunity;
};

// ============ DELETE (Soft) ============
exports.deleteOpportunity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const opportunity = await opportunityModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  // Cannot delete opportunity converted to deal
  if (opportunity.dealId) {
    throw new ApiError(
      "Cannot delete opportunity because it has a linked deal",
      400,
    );
  }

  opportunity.deletedAt = new Date();

  await opportunity.save();

  return "Opportunity deleted successfully";
};
