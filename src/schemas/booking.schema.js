const Joi = require('joi');

// ============================
// Booking Schemas
// ============================
const bookingSchemas = {
  // Create new booking
  createBooking: Joi.object({
    attractionId: Joi.string().required(),
    bookingDate: Joi.date().required(),
    timeSlot: Joi.string().optional(),
    visitorEmail: Joi.string().email().required(),
    visitorName: Joi.string().required(),
    phoneNumber: Joi.string().optional().allow(''),
    numberOfTickets: Joi.number().integer().min(1).required(),
    ticketType: Joi.string().valid('adult', 'child', 'senior').default('adult'),
    specialRequirements: Joi.string().optional().allow('')
  }),

  // Validate QR code
  validateQRCode: Joi.object({
    bookingId: Joi.string().required(),
    visitorEmail: Joi.string().email().required(),
    hash: Joi.string().required()
  }),

  // Get visitor bookings (email or phone)
  getVisitorBookings: Joi.object({
    visitorId: Joi.string()
      .required()
      .trim()
      .min(3)
      .messages({
        'any.required': 'visitorId is required',
        'string.empty': 'visitorId cannot be empty',
        'string.min': 'visitorId must be at least 3 characters'
      })
  })
};

// ============================
// Validation Middleware
// ============================
function validate(schema, options = { abortEarly: false, allowUnknown: false }) {
  return (req, res, next) => {
    // Use query for GET requests, body for others
    const data = req.method === 'GET' ? req.query : req.body;

    const { error, value } = schema.validate(data, options);

    if (error) {
      const messages = error.details.map(d => d.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages
      });
    }

    // Replace req.body/query with validated data
    if (req.method === 'GET') req.query = value;
    else req.body = value;

    next();
  };
}

module.exports = { bookingSchemas, validate };
