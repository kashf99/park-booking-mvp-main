const Joi = require('joi');

// Common reusable schemas
// const timingsSchema = Joi.object({
//   opening: Joi.string()
//     .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
//     .message('Opening time must be in HH:MM format (24-hour)')
//     .required(),
//   closing: Joi.string()
//     .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
//     .message('Closing time must be in HH:MM format (24-hour)')
//     .required()
// });

// Create Attraction Schema
const createAttractionSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Attraction name is required',
      'string.min': 'Attraction name must be at least 3 characters',
      'string.max': 'Attraction name must not exceed 100 characters'
    }),

  description: Joi.string()
    .min(10)
    .max(2000)
    .optional()
    .default(''),

  location: Joi.string()
    .min(5)
    .max(200)
    .optional()
    .default(''),

  // ✅ FIXED: Changed from pricePerPerson to ticketPrice
  ticketPrice: Joi.number()
    .min(0)
    .precision(2)
    .required()
    .messages({
      'number.base': 'Ticket price must be a number',
      'number.min': 'Ticket price cannot be negative'
    }),

  capacityPerSlot: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'number.base': 'Capacity must be a number',
      'number.integer': 'Capacity must be an integer',
      'number.min': 'Capacity must be at least 1',
      'number.max': 'Capacity cannot exceed 1000'
    }),

  // Optional: You might want to remove this since you're uploading files
  imageUrl: Joi.string()
    .optional()
    .allow('')
    .default(''),

  isActive: Joi.boolean()
    .optional()
    .default(true)
});

// Update Attraction Schema (all fields optional for PATCH)
const updateAttractionSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(100)
    .optional(),

  description: Joi.string()
    .min(10)
    .max(2000)
    .optional(),

  location: Joi.string()
    .min(5)
    .max(200)
    .optional(),

//   timings: timingsSchema
//     .optional(),

  ticketPrice: Joi.number()
    .min(0)
    .precision(2)
    .optional(),

  capacityPerSlot: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .optional(),

  imageUrl: Joi.string()
    .uri()
    .optional(),

  isActive: Joi.boolean()
    .optional()
});

// Query/Pagination Schema (for GET requests)
const getAttractionsSchema = Joi.object({
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
    
  search: Joi.string()
    .min(1)
    .max(50)
    .optional(),
    
  isActive: Joi.boolean()
    .optional(),
    
  sortBy: Joi.string()
    .valid('name', 'ticketPrice', 'createdAt')
    .optional()
    .default('name'),
    
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .optional()
    .default('asc')
});

// ID Validation Schema
const attractionIdSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .message('Invalid attraction ID format')
    .required()
});

module.exports = {
  createAttractionSchema,
  updateAttractionSchema,
  getAttractionsSchema,
  attractionIdSchema
};