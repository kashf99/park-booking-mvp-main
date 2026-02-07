const express = require('express');
const router = express.Router();
const BookingController = require('../controllers/booking.controller');
const { bookingSchemas, validate } = require('../schemas/booking.schema');

// Create new booking
router.post('/', validate(bookingSchemas.createBooking), BookingController.createBooking);

// Validate QR code
router.post('/validate-qr', validate(bookingSchemas.validateQRCode), BookingController.validateQRCode);

// Get all bookings for a visitor (single key: visitorId)
router.post('/visitor',validate(bookingSchemas.getVisitorBookings),
  BookingController.getVisitorBookings
);
module.exports = router;
