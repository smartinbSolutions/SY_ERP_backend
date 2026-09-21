const leadModel = require("../../models/CRM/leadModel");
const ApiError = require("../../utils/apiError");

// CALCULATE BANT SCORE
//This function calculates the BANT score based on the provided BANT criteria. The score is calculated based on the following criteria:
exports.calculateBantScore = (bant = {}) => {
  let score = 0;

  // -------------------------
  // Budget: 0 - 3
  // -------------------------
  if (bant.budget) {
    if (bant.budget.confirmed) {
      score += 3;
    } else if (bant.budget.amount > 0) {
      score += 2;
    } else if (bant.budget.notes?.trim()) {
      score += 1;
    }
  }

  // -------------------------
  // Authority: 0 - 3
  // -------------------------
  if (bant.authority) {
    if (bant.authority.isDecisionMaker) {
      score += 3;
    } else if (
      bant.authority.decisionMakerName?.trim() ||
      bant.authority.notes?.trim()
    ) {
      score += 2;
    } else {
      score += 1;
    }
  }

  // -------------------------
  // Need: 0 - 3
  // -------------------------
  if (bant.need) {
    const hasPainPoint = Boolean(bant.need.painPoint?.trim());
    const hasImpact = Boolean(bant.need.impact?.trim());
    const urgency = bant.need.urgency;

    if (hasPainPoint && hasImpact && urgency === "high") {
      score += 3;
    } else if (hasPainPoint && hasImpact) {
      score += 2;
    } else if (hasPainPoint || hasImpact) {
      score += 1;
    }
  }

  // -------------------------
  // Timeline: 0 - 3
  // -------------------------
  if (bant.timeline) {
    const hasDates = bant.timeline.expectedStart || bant.timeline.deadline;

    const urgency = bant.timeline.urgency;

    if (urgency === "urgent" || bant.timeline.deadline) {
      score += 3;
    } else if (urgency === "quarter" || urgency === "year") {
      score += 2;
    } else if (hasDates || urgency === "someday") {
      score += 1;
    }
  }

  return Math.min(score, 12);
};

// ============================================
// QUALIFY LEAD
// ============================================
exports.qualifyLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  const bantScore = exports.calculateBantScore(lead.bant);

  lead.bant.score = bantScore;

  if (bantScore > 6) {
    lead.status = "qualified";
  } else {
    throw new ApiError(
      `Lead cannot be qualified. BANT score must be greater than 6. Current score: ${bantScore}`,
      400,
    );
  }

  await lead.save();

  return lead;
};

// ============================================
// GET ALL
// ============================================
exports.getAllLeads = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, status, source, ownerId } = req.query;

  const query = {
    companyId,
    deletedAt: null,
  };

  if (keyword) {
    query.$or = [
      { firstName: { $regex: keyword, $options: "i" } },
      { lastName: { $regex: keyword, $options: "i" } },
      { email: { $regex: keyword, $options: "i" } },
      { phone: { $regex: keyword, $options: "i" } },
      { companyName: { $regex: keyword, $options: "i" } },
    ];
  }

  if (status) query.status = status;
  if (source) query.source = source;
  if (ownerId) query.ownerId = ownerId;

  const [total, leads] = await Promise.all([
    leadModel.countDocuments(query),

    leadModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email"),
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: leads.length,
    total,
    data: leads,
  };
};

// ============================================
// GET ONE
// ============================================
exports.getOneLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel
    .findOne({
      _id: id,
      companyId,
      deletedAt: null,
    })
    .populate("ownerId", "name email")
    .populate("convertedTo.contactId", "firstName lastName email")
    .populate("convertedTo.crmCompanyId", "name industry")
    .populate("convertedTo.opportunityId", "title value")
    .populate("convertedTo.convertedBy", "name email");

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  return lead;
};

// ============================================
// CREATE
// ============================================
exports.createLead = async (req) => {
  const companyId = req.companyId;

  if (req.body.email) {
    const exists = await leadModel.findOne({
      companyId,
      email: req.body.email,
      deletedAt: null,
    });

    if (exists) {
      throw new ApiError("A lead with this email already exists", 400);
    }
  }

  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
  };

  // Never trust score from frontend
  payload.bant = payload.bant || {};
  payload.bant.score = exports.calculateBantScore(payload.bant);

  const lead = await leadModel.create(payload);

  return lead;
};

// ============================================
// UPDATE
// ============================================
exports.updateLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (req.body.email) {
    const exists = await leadModel.findOne({
      companyId,
      email: req.body.email,
      _id: { $ne: id },
      deletedAt: null,
    });

    if (exists) {
      throw new ApiError("A lead with this email already exists", 400);
    }
  }

  const updateData = { ...req.body };

  delete updateData.companyId;
  delete updateData.deletedAt;

  // Get current lead so we can calculate
  // the score using the final BANT data.
  const existingLead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!existingLead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  // If BANT is being updated, merge it with
  // the existing BANT before calculating score.
  if (updateData.bant) {
    const updatedBant = {
      ...existingLead.bant?.toObject?.(),
      ...updateData.bant,

      budget: {
        ...existingLead.bant?.budget?.toObject?.(),
        ...updateData.bant.budget,
      },

      authority: {
        ...existingLead.bant?.authority?.toObject?.(),
        ...updateData.bant.authority,
      },

      need: {
        ...existingLead.bant?.need?.toObject?.(),
        ...updateData.bant.need,
      },

      timeline: {
        ...existingLead.bant?.timeline?.toObject?.(),
        ...updateData.bant.timeline,
      },
    };

    updateData.bant = updatedBant;
    updateData.bant.score = exports.calculateBantScore(updatedBant);
  }

  // If BANT was not included in the update,
  // keep the existing score.
  if (!updateData.bant) {
    delete updateData["bant.score"];
  }

  const lead = await leadModel.findOneAndUpdate(
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

  return lead;
};

// ============================================
// DELETE (SOFT)
// ============================================
exports.deleteLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel.findOneAndUpdate(
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

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  return "Lead deleted successfully";
};
