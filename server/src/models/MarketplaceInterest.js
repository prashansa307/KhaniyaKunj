const mongoose = require('mongoose');

const marketplaceInterestSchema = new mongoose.Schema(
  {
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: true,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketplaceItem',
      required: true,
      index: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    message: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

marketplaceInterestSchema.index({ itemId: 1, buyerId: 1 }, { unique: true });

const MarketplaceInterest = mongoose.model('MarketplaceInterest', marketplaceInterestSchema);

module.exports = MarketplaceInterest;

