// controllers/booking.controller.js
const Booking = require('../models/Booking');
const Attraction = require('../models/Attraction');
const QRCode = require('qrcode');
const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');
const { Queue } = require('bullmq');
const { redisConnection } = require('../config/bull');

// Initialize the email queue
const emailQueue = new Queue('emailQueue', { connection: redisConnection });

exports.createBooking = async (req, res) => {
  try {
    const {
      attractionId,
      bookingDate,
      timeSlot,
      visitorEmail,
      visitorName,
      phoneNumber,
      numberOfTickets,
      ticketType = 'adult',
      specialRequirements,
    } = req.body;

    const parsedDate = new Date(bookingDate);

    // Fetch attraction
    const attraction = await Attraction.findById(attractionId);
    if (!attraction)
      return res.status(404).json({ success: false, message: 'Attraction not found' });

    // Check existing bookings for slot
    const existingBookings = await Booking.find({
      attractionId,
      bookingDate: parsedDate,
      timeSlot,
      bookingStatus: { $in: ['confirmed', 'pending'] },
    });

    const bookedTickets = existingBookings.reduce((sum, b) => sum + (b.numberOfTickets || 0), 0);
    const availableTickets = attraction.capacityPerSlot - bookedTickets;

    if (numberOfTickets > availableTickets) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableTickets} tickets left for this slot.`,
      });
    }

    // Calculate pricing
    const pricePerTicket = attraction.ticketPrice;
    const totalAmount = pricePerTicket * numberOfTickets;
    const taxAmount = totalAmount * 0.1;
    const finalAmount = totalAmount + taxAmount;

    // Generate booking ID and QR hash
    const bookingId = `BOOK-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const secret = process.env.QR_SECRET;
    const qrHash = crypto.createHash('sha256')
      .update(`${bookingId}${visitorEmail}${secret}`)
      .digest('hex');

    const qrData = {
      bookingId,
      attractionId,
      attractionName: attraction.name,
      bookingDate,
      timeSlot,
      visitorEmail,
      numberOfTickets,
      hash: qrHash
    };

    const qrBase64 = await QRCode.toDataURL(JSON.stringify(qrData));

    // Upload QR code to Cloudinary
    const upload = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        qrBase64,
        { folder: 'bookings', public_id: `QR_${bookingId}`, overwrite: true, resource_type: 'image' },
        (err, result) => (err ? reject(err) : resolve(result))
      );
    });

    // Save booking in DB
    const booking = new Booking({
      bookingId,
      attractionId,
      attractionName: attraction.name,
      bookingDate: parsedDate,
      timeSlot,
      visitorEmail: visitorEmail.toLowerCase(),
      visitorName,
      phoneNumber: phoneNumber || '',
      numberOfTickets,
      ticketType,
      pricePerTicket,
      totalAmount,
      taxAmount,
      finalAmount,
      qrCodeData: JSON.stringify(qrData),
      qrCodeHash: qrHash,
      qrCodeImage: upload.secure_url,
      specialRequirements: specialRequirements || '',
      bookingStatus: 'confirmed',
      paymentStatus: 'completed',
      paymentReference: `PAY-${Date.now()}`,
      isQRValidated: false,
    });

    await booking.save();

    // ---------------------------
    // Queue Email Jobs
    // ---------------------------

    // Visitor Email
    await emailQueue.add('sendVisitorEmail', {
      to: visitorEmail,
      subject: `Your Booking Confirmation - ${attraction.name}`,
      html: `
        <h2>Hello ${visitorName},</h2>
        <p>Thank you for booking ${numberOfTickets} ticket(s) for <strong>${attraction.name}</strong> on <strong>${bookingDate}</strong> at <strong>${timeSlot}</strong>.</p>
        <p>Total: $${finalAmount.toFixed(2)}</p>
        <img src="${upload.secure_url}" alt="QR Code" style="width:200px;height:200px;"/>
        <p>Please show this QR code at the entrance.</p>
        <p>Booking ID: ${bookingId}</p>
        <p>Enjoy your visit! 🎢</p>
      `
    });

    // Admin Email
    await emailQueue.add('sendAdminEmail', {
      to: process.env.ALERT_EMAIL,
      subject: `New Booking - ${attraction.name}`,
      html: `
        <h2>New Booking Received</h2>
        <p>Visitor: ${visitorName} (${visitorEmail})</p>
        <p>Tickets: ${numberOfTickets}</p>
        <p>Date: ${bookingDate} | Slot: ${timeSlot}</p>
        <p>Total Amount: $${finalAmount.toFixed(2)}</p>
        <p>Booking ID: ${bookingId}</p>
      `
    });

    // ---------------------------
    // Respond to client
    // ---------------------------
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        bookingId: booking.bookingId,
        attractionName: booking.attractionName,
        bookingDate: booking.bookingDate,
        timeSlot: booking.timeSlot,
        numberOfTickets: booking.numberOfTickets,
        visitorName: booking.visitorName,
        visitorEmail: booking.visitorEmail,
        totalAmount: booking.totalAmount,
        taxAmount: booking.taxAmount,
        finalAmount: booking.finalAmount,
        qrCodeImage: booking.qrCodeImage,
        paymentReference: booking.paymentReference,
        bookingStatus: booking.bookingStatus
      }
    });

  } catch (err) {
    console.error('Create booking error:', err);
    if (res.headersSent) return;
    res.status(500).json({ success: false, message: 'Failed to create booking', error: err.message });
  }
};

// ============================
// VALIDATE QR CODE (GATE STAFF)
// ============================
exports.validateQRCode = async (req, res) => {
    try {
        const { bookingId, visitorEmail, hash } = req.body;

        if (!bookingId || !visitorEmail || !hash) {
            return res.status(400).json({ success: false, message: 'Missing QR code data' });
        }

        // Fetch booking
        const booking = await Booking.findOne({ bookingId, visitorEmail });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Invalid booking' });
        }

        // Verify hash
        const expectedHash = crypto.createHash('sha256')
            .update(`${booking.bookingId}${booking.visitorEmail}${process.env.QR_SECRET}`)
            .digest('hex');

        if (expectedHash !== hash) {
            return res.status(400).json({ success: false, message: 'QR code has been tampered with' });
        }

        // Check if already validated
        if (booking.isQRValidated) {
            return res.status(400).json({ success: false, message: 'Ticket already validated' });
        }

        // Check booking date
        const now = new Date();
        const bookingDate = new Date(booking.bookingDate);

        const todayStr = now.toISOString().split('T')[0];
        const bookingStr = bookingDate.toISOString().split('T')[0];

        if (todayStr < bookingStr) {
            return res.status(400).json({
                success: false,
                message: 'Booking is for a future date. Please come on your booked date.'
            });
        }

        if (todayStr > bookingStr) {
            return res.status(400).json({
                success: false,
                message: 'Booking date has passed. Ticket is expired.'
            });
        }

        // Mark validated
        booking.isQRValidated = true;
        booking.validationTime = new Date();
        await booking.save();

        res.json({ success: true, message: 'Ticket validated successfully', booking });

    } catch (err) {
        console.error('QR validation error:', err);
        if (res.headersSent) return;
        res.status(500).json({ success: false, message: 'Failed to validate QR code' });
    }
};


// ============================
// GET ALL BOOKINGS FOR A VISITOR
// ============================
// ============================
// GET VISITOR BOOKINGS
// ============================
// ============================
// GET ALL BOOKINGS FOR A VISITOR
// ============================
exports.getVisitorBookings = async (req, res) => {
    try {
        const { visitorId } = req.body;

        if (!visitorId || typeof visitorId !== 'string') {
            return res.status(400).json({ 
                success: false, 
                message: 'Provide a valid visitorId (email or phone number) in request body' 
            });
        }

        const trimmedVisitorId = visitorId.trim();
        
        if (!trimmedVisitorId) {
            return res.status(400).json({ 
                success: false, 
                message: 'visitorId cannot be empty' 
            });
        }

        // Determine if visitorId is email or phone
        const isEmail = trimmedVisitorId.includes('@');

        // Build query for EXACT match
        let query = {};
        if (isEmail) {
            // Exact match for email (case-insensitive)
            query.visitorEmail = trimmedVisitorId.toLowerCase();
        } else {
            // For phone: normalize to digits only for exact match
            const phoneNormalized = trimmedVisitorId.replace(/\D/g, '');
            
            if (!phoneNormalized || phoneNormalized.length < 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid phone number. Must contain at least 10 digits'
                });
            }
            
            // EXACT match with normalized phone number
            // Make sure phone numbers in database are also normalized
            query.phoneNumber = phoneNormalized;
        }

        console.log('Searching bookings with query:', query); // For debugging

        // Fetch bookings with EXACT match
        const bookings = await Booking.find(query)
            .sort({ bookingDate: -1, createdAt: -1 })
            .populate('attractionId', 'name imageUrl location timings');

        if (!bookings || bookings.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'No bookings found for this visitor' 
            });
        }

        // Format response
        const formattedBookings = bookings.map(booking => ({
            bookingId: booking.bookingId,
            attractionId: booking.attractionId?._id,
            attractionName: booking.attractionName || booking.attractionId?.name,
            attractionImage: booking.attractionId?.imageUrl,
            location: booking.attractionId?.location,
            bookingDate: booking.bookingDate,
            timeSlot: booking.timeSlot,
            numberOfTickets: booking.numberOfTickets,
            visitorName: booking.visitorName,
            visitorEmail: booking.visitorEmail,
            phoneNumber: booking.phoneNumber,
            totalAmount: booking.totalAmount,
            taxAmount: booking.taxAmount,
            finalAmount: booking.finalAmount,
            bookingStatus: booking.bookingStatus,
            paymentStatus: booking.paymentStatus,
            qrCodeImage: booking.qrCodeImage,
            expiryTime: booking.expiryTime,
            isQRValidated: booking.isQRValidated,
            validationTime: booking.validationTime,
            specialRequirements: booking.specialRequirements,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt
        }));

        res.json({ 
            success: true, 
            count: bookings.length,
            data: formattedBookings 
        });
        
    } catch (err) {
        console.error('Get visitor bookings error:', err);
        
        // Check if headers already sent
        if (res.headersSent) {
            console.error('Headers already sent, cannot send error response');
            return;
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch bookings', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined 
        });
    }
};

