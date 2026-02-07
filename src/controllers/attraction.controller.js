const Attraction = require('../models/Attraction');
const cloudinary = require('../config/cloudinary.js'); // Import Cloudinary config
/**
 * @desc    Create new attraction
 * @route   POST /api/attractions
 * @access  Private/Admin
 */
exports.createAttraction = async (req, res) => {
  let imagePublicId = null; // ✅ Store this at function scope
  
  try {
    // ✅ req.body already validated by middleware
    const attractionData = { ...req.body };
    
    // ✅ Handle image upload if file exists
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          'attractions'
        );
        attractionData.imageUrl = uploadResult.secure_url;
        attractionData.imagePublicId = uploadResult.public_id;
        imagePublicId = uploadResult.public_id; // ✅ Store for cleanup
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: 'Failed to upload image',
          error: uploadError.message
        });
      }
    } else {
      attractionData.imageUrl = '';
      attractionData.imagePublicId = '';
    }
    
    // ✅ Create attraction with uploaded image URL
    const attraction = new Attraction(attractionData);
    await attraction.save();
    
    res.status(201).json({
      success: true,
      message: 'Attraction created successfully',
      data: attraction
    });
    
  } catch (error) {
    console.error('Create attraction error:', error);
    
    // ✅ Cleanup uploaded image if creation failed
    if (imagePublicId) { // ✅ Now accessible in catch block
      try {
        await cloudinary.uploader.destroy(imagePublicId);
      } catch (deleteError) {
        console.error('Failed to cleanup uploaded image:', deleteError);
      }
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Attraction with this name already exists'
      });
    }
    
    // ✅ Check for validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create attraction',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const uploadToCloudinary = async (fileBuffer, folder = 'attractions') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,           // only folder, Cloudinary will sign automatically
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

/**
 * @desc    Get all attractions
 * @route   GET /api/attractions
 * @access  Public
 */
exports.getAllAttractions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      search,
    //   isActive = true
    } = req.query;
    
    // Build query
    const query = {};
    // if (isActive !== undefined) {
    //   query.isActive = isActive === 'true';
    // }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    
    const attractions = await Attraction.find(query)
      .sort({ [sortBy]: sortOrder })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
    
    const total = await Attraction.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: attractions.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: attractions
    });
  } catch (error) {
    console.error('Get all attractions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get single attraction
 * @route   GET /api/attractions/:id
 * @access  Public
 */
exports.getAttractionById = async (req, res) => {
  try {
    const attraction = await Attraction.findById(req.params.id);
    
    if (!attraction) {
      return res.status(404).json({
        success: false,
        message: 'Attraction not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: attraction
    });
  } catch (error) {
    console.error('Get attraction by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



/**
 * @desc    Update attraction
 * @route   PUT /api/attractions/:id
 * @route   PATCH /api/attractions/:id
 * @access  Private/Admin
 */
exports.updateAttraction = async (req, res) => {
  try {
    // ✅ NO VALIDATION HERE - middleware already validated req.params.id and req.body
    
    const attraction = await Attraction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!attraction) {
      return res.status(404).json({
        success: false,
        message: 'Attraction not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Attraction updated successfully',
      data: attraction
    });
  } catch (error) {
    console.error('Update attraction error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Attraction with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update attraction',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Delete attraction (soft delete)
 * @route   DELETE /api/attractions/:id
 * @access  Private/Admin
 */
exports.deleteAttraction = async (req, res) => {
  try {
    const attraction = await Attraction.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!attraction) {
      return res.status(404).json({
        success: false,
        message: 'Attraction not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Attraction deactivated successfully',
      data: attraction
    });
  } catch (error) {
    console.error('Delete attraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate attraction',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Activate attraction
 * @route   POST /api/attractions/:id/activate
 * @access  Private/Admin
 */
exports.activateAttraction = async (req, res) => {
  try {
    const attraction = await Attraction.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );
    
    if (!attraction) {
      return res.status(404).json({
        success: false,
        message: 'Attraction not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Attraction activated successfully',
      data: attraction
    });
  } catch (error) {
    console.error('Activate attraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate attraction',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};