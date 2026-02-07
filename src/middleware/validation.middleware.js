const Joi = require('joi');

/**
 * Generic validation middleware
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate (body, params, query)
 * @returns {Function} Express middleware
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all validation errors, not just the first one
      stripUnknown: true // Remove unknown fields
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
        type: detail.type
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    // Replace validated property with sanitized data
    req[property] = value;
    next();
  };
};

/**
 * Validate MongoDB ObjectId in params
 */
const validateObjectId = (idParam = 'id') => {
  return (req, res, next) => {
    const schema = Joi.object({
      [idParam]: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid ID format',
          'any.required': 'ID is required'
        })
    });
    
    const { error } = schema.validate({ [idParam]: req.params[idParam] });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format',
        error: error.details[0].message
      });
    }
    
    next();
  };
};

/**
 * Validate pagination query parameters
 */
const validatePagination = validate(Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .optional(),
    
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .optional(),
    
  sortBy: Joi.string()
    .valid('name', 'price', 'createdAt', 'updatedAt')
    .default('createdAt')
    .optional(),
    
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .optional()
}), 'query');

module.exports = {
  validate,
  validateObjectId,
  validatePagination
};