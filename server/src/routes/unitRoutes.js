const express = require('express');
const {
  listUnits,
  getUnitSummary,
  createUnit,
  updateUnit,
  assignResidentToUnit,
  markUnitVacant,
  deleteUnit,
} = require('../controllers/unitController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.get(
  '/summary',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE),
  getUnitSummary
);

router.get(
  '/',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COMMITTEE, ROLES.GUARD, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT),
  listUnits
);

router.post(
  '/',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  createUnit
);

router.put(
  '/:id',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  updateUnit
);

router.put(
  '/:id/assign',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  assignResidentToUnit
);

router.put(
  '/:id/vacate',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  markUnitVacant
);

router.delete(
  '/:id',
  protect,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  deleteUnit
);

module.exports = router;
