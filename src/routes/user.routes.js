const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { createUserSchema, loginSchema } = require('../schemas/user.schema');
const { validate } = require('../middleware/validation.middleware');

// Public endpoint to create a user (e.g., initial admin). In production, protect this.
router.post('/', validate(createUserSchema), userController.createUser);

// Login
router.post('/login', validate(loginSchema), userController.login);

module.exports = router;
