const mongoose = require('mongoose');
const crypto = require('crypto');
const QRCode = require('qrcode');
const Attraction = require('./Attraction'); // make sure this path is correct

const bookingSchema = new mongoose.Schema({
    bookingId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    attractionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attraction',
        required: true,
        index: true
    },
    attractionName: {
        type: String,
        required: true
    },

    bookingDate: {
        type: Date,
        required: true,
        index: true
    },
    timeSlot: {
        type: String,
        required: true,
       
        index: true
    },

    visitorEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },
    visitorName: {
        type: String,
        required: true,
        trim: true
    },
    phoneNumber: {
        type: String,
        trim: true
    },

    numberOfTickets: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    },
    ticketType: {
        type: String,
        enum: ['adult', 'child', 'senior', 'student'],
        default: 'adult'
    },

    pricePerTicket: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true,
        min: 0
    },

    qrCodeData: {
        type: String,
        required: true,
        unique: true
    },
    qrCodeImage: {
        type: String
    },
    isQRValidated: {
        type: Boolean,
        default: false,
        index: true
    },
    validationTime: {
        type: Date
    },
    validatedBy: {
        type: String
    },

    bookingStatus: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed', 'expired', 'no_show'],
        default: 'confirmed',
        index: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'completed'
    },
    paymentReference: {
        type: String,
        default: ''
    },

    specialRequirements: {
        type: String,
        default: ''
    },
    notes: {
        type: String,
        default: ''
    },
    qrCodeHash: { type: String, required: true }, // ✅ store hash

    bookingTime: {
        type: Date,
        default: Date.now
    },
    expiryTime: {
        type: Date
    },
    cancellationTime: {
        type: Date
    }
}, {
    timestamps: true
});

// ✅ Indexes for better performance
bookingSchema.index({ attractionId: 1, bookingDate: 1, timeSlot: 1 });
bookingSchema.index({ visitorEmail: 1, bookingDate: -1 });
bookingSchema.index({ bookingStatus: 1, expiryTime: 1 });

// ✅ Fixed: Use async function (no `next` argument)
bookingSchema.pre('save', async function () {
    if (this.bookingDate && this.timeSlot) {
        try {
            const expiry = new Date(this.bookingDate);
            const [hours, minutes] = this.timeSlot.split(':').map(Number);
            expiry.setHours(hours + 2, minutes, 0, 0);
            this.expiryTime = expiry;
        } catch (error) {
            console.error('Error calculating expiry time:', error);
        }
    }
});

// ✅ Validate Booking Method
bookingSchema.methods.validateBooking = function (staffId) {
    if (this.isQRValidated) {
        return { valid: false, message: 'Ticket already validated' };
    }

    if (new Date() > this.expiryTime) {
        this.bookingStatus = 'expired';
        return { valid: false, message: 'Ticket has expired' };
    }

    this.isQRValidated = true;
    this.validationTime = new Date();
    this.validatedBy = staffId;

    return { valid: true, message: 'Ticket validated successfully' };
};

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
