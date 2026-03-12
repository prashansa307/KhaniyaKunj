const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const {
  getMarketplaceListings,
  getMarketplaceListingById,
  getMyMarketplaceListings,
  createMarketplaceListing,
  updateMarketplaceListing,
  deleteMarketplaceListing,
  markMarketplaceListingSold,
  expressMarketplaceInterest,
} = require('../controllers/marketplaceController');

const router = express.Router();

router.get(
  '/',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT),
  getMarketplaceListings
);

router.get(
  '/my-listings',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT),
  getMyMarketplaceListings
);

router.get(
  '/:id',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT),
  getMarketplaceListingById
);

router.post(
  '/',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER),
  createMarketplaceListing
);

router.put(
  '/:id',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER),
  updateMarketplaceListing
);

router.put(
  '/:id/mark-sold',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER),
  markMarketplaceListingSold
);

router.post(
  '/:id/interest',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT),
  expressMarketplaceInterest
);

router.delete(
  '/:id',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TENANT, ROLES.RESIDENT, ROLES.OWNER),
  deleteMarketplaceListing
);

module.exports = router;
