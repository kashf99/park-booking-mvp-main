const mongoose = require('mongoose');

const attractionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: String,
    location: String,
    timings: {
        opening: String,
        closing: String
    },
    // ✅ FIXED: Use ticketPrice (not pricePerPerson)
    ticketPrice: {
        type: Number,
        required: [true, 'Ticket price is required'],
        min: [0, 'Price cannot be negative']
    },
    capacityPerSlot: Number,
    imageUrl: String,
    imagePublicId: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Attraction', attractionSchema);