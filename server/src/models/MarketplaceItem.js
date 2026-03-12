const mongoose = require('mongoose');

const MARKETPLACE_CATEGORIES = [
  'Furniture',
  'Electronics',
  'Books',
  'Home Appliances',
  'Toys',
  'Vehicles / Cycle',
  'Miscellaneous',
];

const MARKETPLACE_CONDITIONS = ['New', 'Like New', 'Good', 'Used'];
const MARKETPLACE_STATUSES = ['AVAILABLE', 'RESERVED', 'SOLD'];

const marketplaceItemSchema = new mongoose.Schema(
  {
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: true,
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sellerName: {
      type: String,
      required: true,
      trim: true,
    },
    flatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
      index: true,
    },
    flatNumber: {
      type: String,
      default: 'UNASSIGNED',
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      required: true,
      enum: MARKETPLACE_CATEGORIES,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    condition: {
      type: String,
      required: true,
      enum: MARKETPLACE_CONDITIONS,
    },
    images: {
      type: [String],
      default: [],
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    pickupPreference: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: MARKETPLACE_STATUSES,
      default: 'AVAILABLE',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    soldAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

marketplaceItemSchema.index({ societyId: 1, status: 1, createdAt: -1 });
marketplaceItemSchema.index({ societyId: 1, sellerId: 1, createdAt: -1 });

const MarketplaceItem = mongoose.model('MarketplaceItem', marketplaceItemSchema);

module.exports = {
  MarketplaceItem,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
  MARKETPLACE_STATUSES,
};

