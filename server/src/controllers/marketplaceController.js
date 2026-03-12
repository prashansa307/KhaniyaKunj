const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');
const User = require('../models/User');
const Unit = require('../models/Unit');
const { MarketplaceItem, MARKETPLACE_CATEGORIES, MARKETPLACE_CONDITIONS, MARKETPLACE_STATUSES } = require('../models/MarketplaceItem');
const MarketplaceInterest = require('../models/MarketplaceInterest');
const { ROLES, normalizeRole } = require('../constants/roles');
const { resolveSingleSocietyId, ensureUserSocietyMapping } = require('../services/singleSocietyService');
const { createNotificationsForUsers } = require('../services/notificationService');

const VIEW_ROLES = new Set([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.COMMITTEE,
  ROLES.TENANT,
  ROLES.RESIDENT,
  ROLES.OWNER,
]);
const SELLER_ROLES = new Set([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.COMMITTEE,
  ROLES.TENANT,
  ROLES.RESIDENT,
  ROLES.OWNER,
]);
const ADMIN_ROLES = new Set([ROLES.ADMIN, ROLES.SUPER_ADMIN]);

function sanitizeText(value, max = 2000) {
  return String(value || '').trim().slice(0, max);
}

function parseImages(body = {}) {
  const rawImages = Array.isArray(body.images) ? body.images : [];
  const csvImages = String(body.imageUrls || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const single = String(body.imageUrl || '').trim();

  const merged = [...rawImages, ...csvImages, ...(single ? [single] : [])]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 5);
  return merged;
}

async function resolveMarketplaceSocietyId(req) {
  const societyId = await resolveSingleSocietyId({
    user: req.user,
    requestedSocietyId: req.query?.societyId || req.body?.societyId || null,
  });
  if (societyId && req.user) {
    if (!req.user.societyId) req.user.societyId = societyId;
    await ensureUserSocietyMapping(req.user);
  }
  return societyId || null;
}

function formatFlatLabel(unit) {
  if (!unit) return 'UNASSIGNED';
  const wing = String(unit.wing || '').trim().toUpperCase();
  const flat = String(unit.flatNumber || unit.unitNumber || '').trim().toUpperCase();
  if (wing && flat) return `${wing}-${flat}`;
  return flat || 'UNASSIGNED';
}

function toListingDto(item, currentUserId, interestCount = 0) {
  const raw = item?.toObject ? item.toObject() : item;
  const seller = raw?.sellerId && typeof raw.sellerId === 'object' ? raw.sellerId : null;
  const isMine = String(raw?.sellerId?._id || raw?.sellerId || '') === String(currentUserId || '');
  return {
    _id: raw._id,
    title: raw.title,
    category: raw.category,
    description: raw.description,
    price: raw.price,
    condition: raw.condition,
    images: Array.isArray(raw.images) ? raw.images : [],
    contactNumber: raw.contactNumber,
    pickupPreference: raw.pickupPreference || '',
    status: raw.status,
    sellerId: seller?._id || raw.sellerId || null,
    sellerName: raw.sellerName || seller?.name || '',
    flatId: raw.flatId || null,
    flatNumber: raw.flatNumber || 'UNASSIGNED',
    postedBy: seller
      ? {
          _id: seller._id,
          name: seller.name,
          role: seller.role,
        }
      : null,
    interestCount: Number(interestCount || 0),
    isMine,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    soldAt: raw.soldAt || null,
  };
}

function parseLimit(input, fallback = 24) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), 1), 100);
}

function parsePage(input, fallback = 1) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(Math.floor(n), 1);
}

const getMarketplaceListings = asyncHandler(async (req, res) => {
  const actorRole = normalizeRole(req.user?.role);
  if (!VIEW_ROLES.has(actorRole)) {
    return errorResponse(res, { statusCode: 403, message: 'Forbidden: insufficient role permissions.' });
  }

  const societyId = await resolveMarketplaceSocietyId(req);
  if (!societyId) {
    return successResponse(res, {
      message: 'Marketplace listings fetched successfully.',
      data: [],
      meta: { pagination: { page: 1, limit: 24, total: 0, totalPages: 0 } },
    });
  }

  const page = parsePage(req.query.page, 1);
  const limit = parseLimit(req.query.limit, 24);
  const skip = (page - 1) * limit;
  const query = { societyId, isDeleted: { $ne: true } };

  const mineOnly = req.query.mine === 'true';
  if (mineOnly) {
    query.sellerId = req.user._id;
  }

  const status = String(req.query.status || '').trim().toUpperCase();
  if (status && MARKETPLACE_STATUSES.includes(status)) {
    query.status = status;
  }

  const category = String(req.query.category || '').trim();
  if (category && MARKETPLACE_CATEGORIES.includes(category)) {
    query.category = category;
  }

  const search = sanitizeText(req.query.search || '', 120);
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      { flatNumber: { $regex: escaped, $options: 'i' } },
      { sellerName: { $regex: escaped, $options: 'i' } },
    ];
  }

  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    query.price = {};
    if (Number.isFinite(minPrice)) query.price.$gte = Math.max(minPrice, 0);
    if (Number.isFinite(maxPrice)) query.price.$lte = Math.max(maxPrice, 0);
    if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && maxPrice < minPrice) {
      return errorResponse(res, { statusCode: 400, message: 'maxPrice must be greater than or equal to minPrice.' });
    }
  }

  const [rows, total] = await Promise.all([
    MarketplaceItem.find(query)
      .populate('sellerId', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    MarketplaceItem.countDocuments(query),
  ]);

  const itemIds = rows.map((item) => item._id);
  const interestAgg = itemIds.length
    ? await MarketplaceInterest.aggregate([
        { $match: { itemId: { $in: itemIds } } },
        { $group: { _id: '$itemId', count: { $sum: 1 } } },
      ])
    : [];
  const interestMap = new Map(interestAgg.map((row) => [String(row._id), Number(row.count || 0)]));

  const data = rows.map((item) => toListingDto(item, req.user._id, interestMap.get(String(item._id)) || 0));
  return successResponse(res, {
    message: 'Marketplace listings fetched successfully.',
    data,
    meta: {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const getMarketplaceListingById = asyncHandler(async (req, res) => {
  const actorRole = normalizeRole(req.user?.role);
  if (!VIEW_ROLES.has(actorRole)) {
    return errorResponse(res, { statusCode: 403, message: 'Forbidden: insufficient role permissions.' });
  }
  const societyId = await resolveMarketplaceSocietyId(req);
  const item = await MarketplaceItem.findOne({
    _id: req.params.id,
    isDeleted: { $ne: true },
    ...(societyId ? { societyId } : {}),
  }).populate('sellerId', 'name role');
  if (!item) {
    return errorResponse(res, { statusCode: 404, message: 'Listing not found.' });
  }
  const interestCount = await MarketplaceInterest.countDocuments({ itemId: item._id });
  return successResponse(res, {
    message: 'Marketplace listing fetched successfully.',
    data: toListingDto(item, req.user._id, interestCount),
  });
});

const createMarketplaceListing = asyncHandler(async (req, res) => {
  const actorRole = normalizeRole(req.user?.role);
  if (!SELLER_ROLES.has(actorRole)) {
    return errorResponse(res, { statusCode: 403, message: 'You are not allowed to create marketplace listings.' });
  }
  const societyId = await resolveMarketplaceSocietyId(req);
  if (!societyId) {
    return errorResponse(res, { statusCode: 400, message: 'Unable to resolve society context.' });
  }

  const title = sanitizeText(req.body.title, 120);
  const category = sanitizeText(req.body.category, 80);
  const description = sanitizeText(req.body.description, 2000);
  const condition = sanitizeText(req.body.condition, 40);
  const contactNumber = sanitizeText(req.body.contactNumber || req.user.phone, 20);
  const pickupPreference = sanitizeText(req.body.pickupPreference, 200);
  const price = Number(req.body.price);
  const images = parseImages(req.body);

  if (!title) return errorResponse(res, { statusCode: 400, message: 'Product title is required.' });
  if (!MARKETPLACE_CATEGORIES.includes(category)) {
    return errorResponse(res, { statusCode: 400, message: 'Category is invalid.' });
  }
  if (!description) return errorResponse(res, { statusCode: 400, message: 'Description is required.' });
  if (!Number.isFinite(price) || price < 0) {
    return errorResponse(res, { statusCode: 400, message: 'Price must be a valid positive number.' });
  }
  if (!MARKETPLACE_CONDITIONS.includes(condition)) {
    return errorResponse(res, { statusCode: 400, message: 'Condition is invalid.' });
  }
  if (!contactNumber) {
    return errorResponse(res, { statusCode: 400, message: 'Contact number is required.' });
  }

  const seller = await User.findById(req.user._id).select('name phone unitId flatId');
  const flatId = seller?.unitId || seller?.flatId || null;
  let flatNumber = 'UNASSIGNED';
  if (flatId) {
    const unit = await Unit.findById(flatId).select('wing flatNumber unitNumber');
    flatNumber = formatFlatLabel(unit);
  }

  const created = await MarketplaceItem.create({
    societyId,
    sellerId: req.user._id,
    sellerName: sanitizeText(seller?.name || req.user?.name || 'Unknown Seller', 120),
    flatId,
    flatNumber,
    title,
    category,
    description,
    price,
    condition,
    images,
    contactNumber,
    pickupPreference,
    status: 'AVAILABLE',
  });

  const adminRecipients = await User.find({
    societyId,
    isDeleted: { $ne: true },
    role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
  }).select('_id');
  const adminUserIds = adminRecipients.map((row) => row._id).filter((id) => String(id) !== String(req.user._id));
  if (adminUserIds.length) {
    await createNotificationsForUsers({
      userIds: adminUserIds,
      societyId,
      type: 'marketplace',
      title: 'New Marketplace Listing',
      message: `${title} has been posted in Society Marketplace.`,
      link: '/app/marketplace',
      payload: { listingId: created._id },
    });
  }

  const row = await MarketplaceItem.findById(created._id).populate('sellerId', 'name role');
  return successResponse(res, {
    statusCode: 201,
    message: 'Listing created successfully.',
    data: toListingDto(row, req.user._id, 0),
  });
});

const updateMarketplaceListing = asyncHandler(async (req, res) => {
  const actorRole = normalizeRole(req.user?.role);
  const societyId = await resolveMarketplaceSocietyId(req);
  const item = await MarketplaceItem.findOne({
    _id: req.params.id,
    isDeleted: { $ne: true },
    ...(societyId ? { societyId } : {}),
  });
  if (!item) {
    return errorResponse(res, { statusCode: 404, message: 'Listing not found.' });
  }

  const isOwner = String(item.sellerId) === String(req.user._id);
  if (!isOwner || !SELLER_ROLES.has(actorRole)) {
    return errorResponse(res, { statusCode: 403, message: 'You can edit only your own listings.' });
  }

  const nextTitle = req.body.title !== undefined ? sanitizeText(req.body.title, 120) : item.title;
  const nextCategory = req.body.category !== undefined ? sanitizeText(req.body.category, 80) : item.category;
  const nextDescription = req.body.description !== undefined ? sanitizeText(req.body.description, 2000) : item.description;
  const nextCondition = req.body.condition !== undefined ? sanitizeText(req.body.condition, 40) : item.condition;
  const nextContact = req.body.contactNumber !== undefined ? sanitizeText(req.body.contactNumber, 20) : item.contactNumber;
  const nextPickup = req.body.pickupPreference !== undefined ? sanitizeText(req.body.pickupPreference, 200) : item.pickupPreference;
  const nextStatus = req.body.status !== undefined ? sanitizeText(req.body.status, 20).toUpperCase() : item.status;
  const nextPrice = req.body.price !== undefined ? Number(req.body.price) : item.price;
  const nextImages = req.body.images !== undefined || req.body.imageUrls !== undefined || req.body.imageUrl !== undefined
    ? parseImages(req.body)
    : item.images;

  if (!nextTitle) return errorResponse(res, { statusCode: 400, message: 'Product title is required.' });
  if (!MARKETPLACE_CATEGORIES.includes(nextCategory)) return errorResponse(res, { statusCode: 400, message: 'Category is invalid.' });
  if (!nextDescription) return errorResponse(res, { statusCode: 400, message: 'Description is required.' });
  if (!Number.isFinite(nextPrice) || nextPrice < 0) return errorResponse(res, { statusCode: 400, message: 'Price must be a valid positive number.' });
  if (!MARKETPLACE_CONDITIONS.includes(nextCondition)) return errorResponse(res, { statusCode: 400, message: 'Condition is invalid.' });
  if (!nextContact) return errorResponse(res, { statusCode: 400, message: 'Contact number is required.' });
  if (!MARKETPLACE_STATUSES.includes(nextStatus)) return errorResponse(res, { statusCode: 400, message: 'Status is invalid.' });

  item.title = nextTitle;
  item.category = nextCategory;
  item.description = nextDescription;
  item.condition = nextCondition;
  item.contactNumber = nextContact;
  item.pickupPreference = nextPickup;
  item.status = nextStatus;
  item.price = nextPrice;
  item.images = nextImages;
  item.soldAt = nextStatus === 'SOLD' ? item.soldAt || new Date() : null;
  await item.save();

  const row = await MarketplaceItem.findById(item._id).populate('sellerId', 'name role');
  const interestCount = await MarketplaceInterest.countDocuments({ itemId: item._id });
  return successResponse(res, {
    message: 'Listing updated successfully.',
    data: toListingDto(row, req.user._id, interestCount),
  });
});

const markMarketplaceListingSold = asyncHandler(async (req, res) => {
  const actorRole = normalizeRole(req.user?.role);
  if (!SELLER_ROLES.has(actorRole)) {
    return errorResponse(res, { statusCode: 403, message: 'Only seller can mark this listing as sold.' });
  }
  const societyId = await resolveMarketplaceSocietyId(req);
  const item = await MarketplaceItem.findOne({
    _id: req.params.id,
    isDeleted: { $ne: true },
    ...(societyId ? { societyId } : {}),
  });
  if (!item) return errorResponse(res, { statusCode: 404, message: 'Listing not found.' });
  if (String(item.sellerId) !== String(req.user._id)) {
    return errorResponse(res, { statusCode: 403, message: 'Only seller can mark this listing as sold.' });
  }
  item.status = 'SOLD';
  item.soldAt = new Date();
  await item.save();

  return successResponse(res, {
    message: 'Listing marked as sold.',
    data: toListingDto(item, req.user._id, await MarketplaceInterest.countDocuments({ itemId: item._id })),
  });
});

const deleteMarketplaceListing = asyncHandler(async (req, res) => {
  const actorRole = normalizeRole(req.user?.role);
  const societyId = await resolveMarketplaceSocietyId(req);
  const item = await MarketplaceItem.findOne({
    _id: req.params.id,
    isDeleted: { $ne: true },
    ...(societyId ? { societyId } : {}),
  });
  if (!item) return errorResponse(res, { statusCode: 404, message: 'Listing not found.' });

  const isOwner = String(item.sellerId) === String(req.user._id);
  const canModerate = ADMIN_ROLES.has(actorRole);
  if (!isOwner && !canModerate) {
    return errorResponse(res, { statusCode: 403, message: 'You are not allowed to delete this listing.' });
  }

  item.isDeleted = true;
  item.deletedBy = req.user._id;
  await item.save();
  await MarketplaceInterest.deleteMany({ itemId: item._id });

  return successResponse(res, {
    message: 'Listing removed successfully.',
    data: { _id: item._id },
  });
});

const getMyMarketplaceListings = asyncHandler(async (req, res) => {
  req.query.mine = 'true';
  return getMarketplaceListings(req, res);
});

const expressMarketplaceInterest = asyncHandler(async (req, res) => {
  const actorRole = normalizeRole(req.user?.role);
  if (!VIEW_ROLES.has(actorRole)) {
    return errorResponse(res, { statusCode: 403, message: 'Forbidden: insufficient role permissions.' });
  }

  const societyId = await resolveMarketplaceSocietyId(req);
  const item = await MarketplaceItem.findOne({
    _id: req.params.id,
    isDeleted: { $ne: true },
    ...(societyId ? { societyId } : {}),
  });
  if (!item) return errorResponse(res, { statusCode: 404, message: 'Listing not found.' });
  if (String(item.sellerId) === String(req.user._id)) {
    return errorResponse(res, { statusCode: 400, message: 'You cannot express interest on your own listing.' });
  }
  if (item.status === 'SOLD') {
    return errorResponse(res, { statusCode: 400, message: 'This item is already sold.' });
  }

  const message = sanitizeText(req.body.message, 300);
  let interest;
  try {
    interest = await MarketplaceInterest.create({
      societyId: item.societyId,
      itemId: item._id,
      buyerId: req.user._id,
      message,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return errorResponse(res, { statusCode: 409, message: 'You have already shown interest for this listing.' });
    }
    throw error;
  }

  await createNotificationsForUsers({
    userIds: [item.sellerId],
    societyId: item.societyId,
    type: 'marketplace_interest',
    title: 'New Buyer Interest',
    message: `${req.user.name} is interested in "${item.title}".`,
    link: '/app/marketplace',
    payload: {
      listingId: item._id,
      interestId: interest._id,
    },
  });

  const interestCount = await MarketplaceInterest.countDocuments({ itemId: item._id });
  return successResponse(res, {
    statusCode: 201,
    message: 'Interest sent to seller successfully.',
    data: { interestId: interest._id, listingId: item._id, interestCount },
  });
});

module.exports = {
  getMarketplaceListings,
  getMarketplaceListingById,
  getMyMarketplaceListings,
  createMarketplaceListing,
  updateMarketplaceListing,
  deleteMarketplaceListing,
  markMarketplaceListingSold,
  expressMarketplaceInterest,
};
