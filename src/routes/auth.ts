import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User';
import { protect } from '../middleware/auth';
import { ApiResponse, AuthResponse, RegisterData, LoginData, ChangePasswordData, ForgotPasswordData, ResetPasswordData } from '../types';
import emailService from '../services/emailService';

const router = express.Router();

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('userType').isIn(['client', 'agent', 'organization']).withMessage('Invalid user type')
], async (req: Request, res: Response) => {
  try {
    console.log('Registration attempt:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { name, email, password, userType }: RegisterData = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists:', email);
      const response: ApiResponse = {
        success: false,
        error: 'User already exists with this email'
      };
      return res.status(400).json(response);
    }

    // Create user
    console.log('Creating new user:', { name, email, userType });
    const user = await User.create({
      name,
      email,
      password,
      userType
    });
    console.log('User created successfully:', user._id);

    // Generate JWT token
    const token = user.getSignedJwtToken();

    const response: AuthResponse = {
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location,
        phone: user.phone,
        isVerified: user.isVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      message: 'User registered successfully'
    };

    console.log('Registration successful, sending response');
    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Server error during registration'
    };
    res.status(500).json(response);
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').exists().withMessage('Password is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { email, password }: LoginData = req.body;

    console.log('🔍 Login attempt:', { email, password: '***' });

    // Check for user - ignore userType from frontend, find by email only
    const user = await User.findOne({ email }).select('+password');
    console.log('👤 User found:', user ? 'Yes' : 'No');
    console.log('👤 User details:', user ? { id: user._id, name: user.name, email: user.email } : 'N/A');
    
    if (!user) {
      console.log('❌ User not found in database');
      // Let's also check how many users total we have
      const userCount = await User.countDocuments();
      console.log('📊 Total users in database:', userCount);
      const response: ApiResponse = {
        success: false,
        error: 'Invalid credentials'
      };
      return res.status(401).json(response);
    }

    // Check if password matches
    console.log('🔑 Checking password...');
    console.log('🔑 Provided password:', password);
    console.log('🔑 Stored password hash:', user.password);
    const isMatch = await user.matchPassword(password);
    console.log('🔑 Password match:', isMatch);
    
    if (!isMatch) {
      console.log('❌ Password mismatch');
      const response: ApiResponse = {
        success: false,
        error: 'Invalid credentials'
      };
      return res.status(401).json(response);
    }

    // Check if user is active
    if (!user.isActive) {
      const response: ApiResponse = {
        success: false,
        error: 'Account is deactivated. Please contact support.'
      };
      return res.status(401).json(response);
    }

    // Generate JWT token with longer expiration
    const token = user.getSignedJwtToken();
    
    // Log successful login with token details
    console.log('🎉 Login successful for user:', user.email, '(ID:', user._id, ')');
    console.log('✅ Token generated successfully');

    // Send back token in both body and as a HTTP-only cookie for better security
    const response: AuthResponse = {
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location,
        phone: user.phone,
        isVerified: user.isVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      message: 'Login successful'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Login error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Server error during login'
    };
    res.status(500).json(response);
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }
    
    // Return user data directly (not wrapped in data object)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      userType: user.userType,
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      phone: user.phone,
      isVerified: user.isVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(200).json(userData);
  } catch (error) {
    console.error('Get user error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error fetching user data'
    };
    res.status(500).json(response);
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
  body('location').optional().isLength({ max: 100 }).withMessage('Location cannot exceed 100 characters'),
  body('phone').optional().matches(/^\+?[\d\s\-\(\)]+$/).withMessage('Please provide a valid phone number'),
  body('email').optional().isEmail().withMessage('Please provide a valid email address'),
  body('dateOfBirth').optional().isISO8601().withMessage('Please provide a valid date'),
  body('nationality').optional().isLength({ max: 50 }).withMessage('Nationality cannot exceed 50 characters'),
  body('passportNumber').optional().isLength({ max: 20 }).withMessage('Passport number cannot exceed 20 characters'),
  body('visaHistory').optional().isLength({ max: 1000 }).withMessage('Visa history cannot exceed 1000 characters')
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { 
      name, 
      bio, 
      location, 
      phone, 
      avatar, 
      email,
      dateOfBirth,
      nationality,
      passportNumber,
      visaHistory,
      preferredCountries,
      emergencyContact,
      notificationSettings,
      privacySettings,
      appPreferences,
      // Agent-specific fields
      title,
      website,
      experienceYears,
      specializations,
      languages,
      hourlyRate,
      licenseNumber,
      certifications,
      responseTime,
      minimumBudget,
      consultationFee
    } = req.body;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (email !== undefined) updateData.email = email;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (nationality !== undefined) updateData.nationality = nationality;
    if (passportNumber !== undefined) updateData.passportNumber = passportNumber;
    if (visaHistory !== undefined) updateData.visaHistory = visaHistory;
    if (preferredCountries !== undefined) updateData.preferredCountries = preferredCountries;
    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
    if (notificationSettings !== undefined) updateData.notificationSettings = notificationSettings;
    if (privacySettings !== undefined) updateData.privacySettings = privacySettings;
    if (appPreferences !== undefined) updateData.appPreferences = appPreferences;
    
    // Agent-specific fields
    if (title !== undefined) updateData.title = title;
    if (website !== undefined) updateData.website = website;
    if (experienceYears !== undefined) updateData.experienceYears = experienceYears;
    if (specializations !== undefined) updateData.specializations = specializations;
    if (languages !== undefined) updateData.languages = languages;
    if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate;
    if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber;
    if (certifications !== undefined) updateData.certifications = certifications;
    if (responseTime !== undefined) updateData.responseTime = responseTime;
    if (minimumBudget !== undefined) updateData.minimumBudget = minimumBudget;
    if (consultationFee !== undefined) updateData.consultationFee = consultationFee;

    console.log('Updating user profile:', { userId: req.user.id, updateData: { ...updateData, password: updateData.password ? '[REDACTED]' : undefined } });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }

    console.log('Profile updated successfully for user:', user.email);

    const response: ApiResponse = {
      success: true,
      data: user,
      message: 'Profile updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Profile update error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error updating profile'
    };
    res.status(500).json(response);
  }
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', protect, [
  body('currentPassword').exists().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { currentPassword, newPassword }: ChangePasswordData = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      const response: ApiResponse = {
        success: false,
        error: 'Current password is incorrect'
      };
      return res.status(400).json(response);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    const response: ApiResponse = {
      success: true,
      message: 'Password changed successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Change password error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error changing password'
    };
    res.status(500).json(response);
  }
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('userType').optional().isIn(['client', 'agent', 'organization']).withMessage('Invalid user type')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const { email, userType }: ForgotPasswordData & { userType?: string } = req.body;

    // Build query - if userType is provided, include it in the search
    const query: any = { email };
    if (userType) {
      query.userType = userType;
    }

    const user = await User.findOne(query);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'No user found with this email'
      };
      return res.status(404).json(response);
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    try {
      // Send password reset email
      await emailService.sendPasswordResetEmail(user.email, resetToken);
      
      const response: ApiResponse = {
        success: true,
        message: 'Password reset link has been sent to your email address'
      };

      res.status(200).json(response);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // If email fails, remove the reset token
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      
      const response: ApiResponse = {
        success: false,
        error: 'Email could not be sent. Please try again later.'
      };
      
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error processing forgot password request'
    };
    res.status(500).json(response);
  }
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
router.put('/reset-password/:resettoken', [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid or expired reset token'
      };
      return res.status(400).json(response);
    }

    // Set new password
    const { password }: ResetPasswordData = req.body;
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate JWT token
    const token = user.getSignedJwtToken();

    const response: ApiResponse = {
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          userType: user.userType,
          avatar: user.avatar,
          isVerified: user.isVerified,
          createdAt: user.createdAt
        }
      },
      message: 'Password reset successful'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Reset password error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error resetting password'
    };
    res.status(500).json(response);
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, async (req: Request, res: Response) => {
  try {
    // In a real app, you might want to blacklist the token
    const response: ApiResponse = {
      success: true,
      message: 'Logged out successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Logout error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error during logout'
    };
    res.status(500).json(response);
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().trim(),
  body('bio').optional().trim(),
  body('location').optional().trim()
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        error: errors.array().map(err => err.msg).join(', ')
      };
      return res.status(400).json(response);
    }

    const userId = req.user.id;
    const updateData = { ...req.body };
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    // If email is being updated, check if it's already taken
    if (updateData.email) {
      const existingUser = await User.findOne({ 
        email: updateData.email, 
        _id: { $ne: userId } 
      });
      if (existingUser) {
        const response: ApiResponse = {
          success: false,
          error: 'Email is already taken'
        };
        return res.status(400).json(response);
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpire -verificationToken');

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location,
        phone: user.phone,
        isVerified: user.isVerified,
        isActive: user.isActive,
        notificationSettings: user.notificationSettings,
        privacySettings: user.privacySettings,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      message: 'Profile updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Update profile error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Error updating profile'
    };
    res.status(500).json(response);
  }
});

export default router;
