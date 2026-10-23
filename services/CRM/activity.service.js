const activityModel = require("../../models/CRM/activityModel");
const leadModel = require("../../models/CRM/leadModel");
const contactModel = require("../../models/CRM/contactModel");
const companyModel = require("../../models/CRM/companyModel");
const opportunityModel = require("../../models/CRM/opportunityModel");
const dealModel = require("../../models/CRM/dealModel");
const ApiError = require("../../utils/apiError");
const mongoose = require("mongoose");
const { generateCrmNumber } = require("../../utils/crmhelpers");
const { createNotification } = require("../Notification/notificationService");

// ============ VALIDATE RELATED ENTITY ============
const validateRelatedEntity = async (relatedTo, companyId) => {
  if (!relatedTo?.type || !relatedTo?.id) {
    throw new ApiError("relatedTo.type and relatedTo.id are required", 400);
  }

  const modelMap = {
    Lead: leadModel,
    Contact: contactModel,
    Company: companyModel,
    Opportunity: opportunityModel,
    Deal: dealModel,
  };

  const Model = modelMap[relatedTo.type];

  if (!Model) {
    throw new ApiError(
      `Unsupported related entity type: ${relatedTo.type}`,
      400,
    );
  }

  const entity = await Model.findOne({
    _id: relatedTo.id,
    companyId,
    deletedAt: null,
  });

  if (!entity) {
    throw new ApiError(
      `${relatedTo.type} not found or does not belong to this company`,
      404,
    );
  }

  return entity;
};

const COMM_TYPES = ["call", "email", "meeting"];

const happenedOn = (dueDate) => {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  return Number.isNaN(d.getTime()) || d > new Date() ? null : d;
};

// Same minute? (the form's datetime-local only has minute precision)
const sameMinute = (a, b) =>
  Math.floor(new Date(a).getTime() / 60000) ===
  Math.floor(new Date(b).getTime() / 60000);

// new -> contacted, only once a real communication is completed
const markLeadContacted = async (activity, companyId) => {
  if (activity.status !== "completed") return;
  if (activity.relatedTo?.type !== "Lead") return;
  if (!COMM_TYPES.includes(activity.type)) return;

  await leadModel.updateOne(
    {
      _id: activity.relatedTo.id,
      companyId,
      deletedAt: null,
      status: "new",
    },
    { $set: { status: "contacted" } },
  );
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const OPEN_STATUSES = ["planned"];
const DAY_MS = 24 * 60 * 60 * 1000;
const BUCKETS = ["overdue", "soon", "upcoming", "completed"];

// ----------------------------------------------------
// Filters shared by the list and the stats
// ----------------------------------------------------
const buildMatch = (query, companyId) => {
  const {
    keyword,
    type,
    status,
    priority,
    ownerId,
    relatedToType,
    relatedToId,
    startDate,
    endDate,
  } = query;

  const match = { companyId, deletedAt: null };

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword.trim()), "i");
    match.$or = [{ subject: regex }, { description: regex }, { number: regex }];
  }

  if (type) match.type = type;
  if (priority) match.priority = priority;

  // status: single value or comma list ("pending,in_progress")
  if (status) {
    const statuses = String(status)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    match.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }

  // aggregate() does not cast strings to ObjectId, so do it here
  if (ownerId) {
    if (!mongoose.isValidObjectId(ownerId)) {
      throw new ApiError("Invalid owner id", 400);
    }
    match.ownerId = new mongoose.Types.ObjectId(ownerId);
  }

  if (relatedToType) match["relatedTo.type"] = relatedToType;

  if (relatedToId) {
    if (!mongoose.isValidObjectId(relatedToId)) {
      throw new ApiError("Invalid related id", 400);
    }
    match["relatedTo.id"] = new mongoose.Types.ObjectId(relatedToId);
  }

  // Due date range (inclusive)
  if (startDate || endDate) {
    match.dueDate = {};

    if (startDate) {
      const from = new Date(startDate);
      if (isNaN(from)) throw new ApiError("Invalid start date", 400);
      from.setHours(0, 0, 0, 0);
      match.dueDate.$gte = from;
    }

    if (endDate) {
      const to = new Date(endDate);
      if (isNaN(to)) throw new ApiError("Invalid end date", 400);
      to.setHours(23, 59, 59, 999);
      match.dueDate.$lte = to;
    }
  }

  return match;
};

// ----------------------------------------------------
// Card groups: one definition for the list and the counts
// ----------------------------------------------------
const dueBucket = (name, now = new Date()) => {
  const in24h = new Date(now.getTime() + DAY_MS);

  switch (name) {
    case "overdue":
      return { status: { $in: OPEN_STATUSES }, dueDate: { $lt: now } };
    case "soon":
      return {
        status: { $in: OPEN_STATUSES },
        dueDate: { $gte: now, $lte: in24h },
      };
    case "upcoming":
      return { status: { $in: OPEN_STATUSES }, dueDate: { $gt: in24h } };
    case "completed":
      return { status: "completed" };
    default:
      return null;
  }
};

// ============ GET ALL ============
exports.getAllActivities = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const match = buildMatch(req.query, companyId);

  // card clicked: overdue | soon | upcoming | completed
  const bucket = dueBucket(req.query.dueFilter);
  const finalMatch = bucket ? { $and: [match, bucket] } : match;

  // ----------------------------------------------------
  // Default order:
  //   rank 0: open + due date   -> due date ascending (overdue first)
  //   rank 1: open, no due date -> newest first
  //   rank 2: completed/cancelled -> most recently updated first
  // Rank 1 and 2 use a negated timestamp so one ascending sort works.
  // ----------------------------------------------------
  const pipeline = [
    { $match: finalMatch },
    {
      $addFields: {
        _isOpen: { $in: ["$status", OPEN_STATUSES] },
      },
    },
    {
      $addFields: {
        _rank: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    "$_isOpen",
                    { $ne: [{ $type: "$dueDate" }, "missing"] },
                  ],
                },
                then: 0,
              },
              { case: "$_isOpen", then: 1 },
            ],
            default: 2,
          },
        },
      },
    },
    {
      $addFields: {
        _sortKey: {
          $switch: {
            branches: [
              { case: { $eq: ["$_rank", 0] }, then: { $toLong: "$dueDate" } },
              {
                case: { $eq: ["$_rank", 1] },
                then: { $multiply: [-1, { $toLong: "$createdAt" }] },
              },
            ],
            default: { $multiply: [-1, { $toLong: "$updatedAt" }] },
          },
        },
      },
    },
    { $sort: { _rank: 1, _sortKey: 1, _id: 1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { _isOpen: 0, _rank: 0, _sortKey: 0 } },
  ];

  const [total, rows] = await Promise.all([
    activityModel.countDocuments(finalMatch),
    activityModel.aggregate(pipeline),
  ]);

  // aggregate returns plain objects; populate them afterwards
  const activities = await activityModel.populate(rows, [
    { path: "ownerId", select: "name email" },
    { path: "tags", select: "name" },
    { path: "attendees", select: "name email" },
    { path: "relatedTo.id" },
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: activities.length,
    total,
    data: activities,
  };
};

// ============ CARD COUNTS ============
exports.getActivityStats = async (req) => {
  const companyId = req.companyId;
  const now = new Date();

  const base = { companyId, deletedAt: null };
  const match = buildMatch(req.query, companyId);

  // anything applied beyond companyId + deletedAt?
  const filtered = Object.keys(match).length > 2;

  const entries = await Promise.all(
    BUCKETS.map(async (name) => {
      const bucket = dueBucket(name, now);

      const [total, matching] = await Promise.all([
        activityModel.countDocuments({ $and: [base, bucket] }),
        filtered
          ? activityModel.countDocuments({ $and: [match, bucket] })
          : Promise.resolve(null),
      ]);

      return [name, { total, matching: filtered ? matching : total }];
    }),
  );

  return {
    status: "success",
    filtered,
    data: Object.fromEntries(entries),
  };
};
// ============ GET ONE ============
exports.getOneActivity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const activity = await activityModel
    .findOne({
      _id: id,
      companyId,
      deletedAt: null,
    })
    .populate("ownerId", "name email")
    .populate("tags", "name")
    .populate("attendees", "name email")
    .populate({
      path: "relatedTo.id",
    });

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  return activity;
};

// ============ CREATE ============
exports.createActivity = async (req) => {
  const companyId = req.companyId;

  // Validate the related entity
  await validateRelatedEntity(req.body.relatedTo, companyId);
  const number = await generateCrmNumber(companyId, "activity");

  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
    number,
    ...(req.body.status === "completed"
      ? { completedAt: happenedOn(req.body.dueDate) || new Date() }
      : {}),
  };

  // 1. Create activity
  const activity = await activityModel.create(payload);

  // 2. Lead lifecycle:
  // new + real communication -> contacted
  await markLeadContacted(activity, companyId);
  // 3. Create a notification for the activity owner
  try {
    await createNotification({
      companyId,
      recipientId: activity.ownerId,
      actorId: req.user?._id || req.user?.id || null,

      type: "crm.activity.created",

      title: "New CRM activity assigned to you",

      message: `A new ${activity.type} activity "${activity.subject}" has been assigned to you.`,

      entityType: "Activity",
      entityId: activity._id,

      metadata: {
        activityType: activity.type,
        subject: activity.subject,
        relatedTo: {
          type: activity.relatedTo.type,
          id: activity.relatedTo.id,
        },
        dueDate: activity.dueDate || null,
        priority: activity.priority,
      },
    });
  } catch (error) {
    // لا نعيد فشل إنشاء النشاط بعد أن تم حفظه بنجاح.
    console.error(
      "Failed to create notification for CRM activity:",
      error.message,
    );
  }

  return activity;
};

// ============ UPDATE ============
exports.updateActivity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const updateData = { ...req.body };

  // These fields cannot be changed by the client
  delete updateData.companyId;
  delete updateData.deletedAt;
  delete updateData.completedAt;

  // If relatedTo is being changed,
  // make sure the new entity exists and belongs to this company
  if (updateData.relatedTo) {
    await validateRelatedEntity(updateData.relatedTo, companyId);
  }

  // Manage completedAt automatically based on status.
  if (Object.prototype.hasOwnProperty.call(updateData, "status")) {
    if (updateData.status === "completed") {
      const existing = await activityModel
        .findOne({ _id: id, companyId, deletedAt: null })
        .select("status completedAt dueDate");

      const wasCompleted =
        existing?.status === "completed" && existing.completedAt;

      if (wasCompleted) {
        // Already done: keep the date, unless the user changed "Happened on"
        const dateChanged =
          updateData.dueDate &&
          existing.dueDate &&
          !sameMinute(updateData.dueDate, existing.dueDate);

        updateData.completedAt = dateChanged
          ? happenedOn(updateData.dueDate) || existing.completedAt
          : existing.completedAt;
      } else {
        // Becoming completed now: use the date on the form, else now
        updateData.completedAt = happenedOn(updateData.dueDate) || new Date();
      }
    } else {
      updateData.completedAt = null;
    }
  }

  const activity = await activityModel.findOneAndUpdate(
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

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  // Lead lifecycle: new -> contacted once a communication is completed
  await markLeadContacted(activity, companyId);

  return activity;
};

// ============ DELETE (Soft) ============
exports.deleteActivity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const activity = await activityModel.findOneAndUpdate(
    {
      _id: id,
      companyId,
      deletedAt: null,
    },
    {
      deletedAt: new Date(),
    },
    {
      new: true,
    },
  );

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  return "Activity deleted successfully";
};
