const express = require('express');
const router = express.Router();
const attractionController = require('../controllers/attraction.controller');
const upload = require('../middleware/upload.middleware');

const {
    createAttractionSchema,
    updateAttractionSchema,
    getAttractionsSchema
} = require('../schemas/attraction.schema');
const {
    validate,
    validateObjectId,
    validatePagination
} = require('../middleware/validation.middleware');

/**
 * @route   GET /api/attractions
 * @desc    Get all attractions with pagination
 * @access  Public
 */
router.get(
    '/',
    // validatePagination,
    attractionController.getAllAttractions
);

/**
 * @route   GET /api/attractions/:id
 * @desc    Get single attraction by ID
 * @access  Public
 */
router.get(
    '/:id',
    validateObjectId(),
    attractionController.getAttractionById
);

/**
 * @route   POST /api/attractions
 * @desc    Create a new attraction
 * @access  Private/Admin
 */
router.post(
    '/',
     upload.single('image'),
    validate(createAttractionSchema),
    attractionController.createAttraction
);

/**
 * @route   PUT /api/attractions/:id
 * @desc    Update an attraction
 * @access  Private/Admin
 */
router.put(
    '/:id',
    validateObjectId(),
    validate(updateAttractionSchema),
    attractionController.updateAttraction
);

/**
 * @route   PATCH /api/attractions/:id
 * @desc    Partially update an attraction
 * @access  Private/Admin
 */
router.patch(
    '/:id',
    validateObjectId(),
    validate(updateAttractionSchema), // Note: same schema, but Joi handles partial updates
    attractionController.updateAttraction
);

/**
 * @route   DELETE /api/attractions/:id
 * @desc    Delete an attraction (soft delete by setting isActive=false)
 * @access  Private/Admin
 */
router.delete(
    '/:id',
    validateObjectId(),
    attractionController.deleteAttraction
);

/**
 * @route   POST /api/attractions/:id/activate
 * @desc    Activate a deactivated attraction
 * @access  Private/Admin
 */
router.post(
    '/:id/activate',
    validateObjectId(),
    attractionController.activateAttraction
);

module.exports = router;