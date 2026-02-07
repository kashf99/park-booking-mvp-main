// config/cloudinary.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dbm8jq2gq',
  api_key: process.env.CLOUDINARY_API_KEY || '186674559377637',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'LmD7evUCF6_NGf9DpOI3j9R-yGw',
});

module.exports = cloudinary;
