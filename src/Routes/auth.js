import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getAllUsers,
  updateUserPermissions,
  toggleUserStatus,
  getSystemOverview,
  getProvisionTargets,
  provisionUserAccount
} from '../Controller/auth.js';
import { authenticate, authorize } from '../Middleware/auth.js';

const authRouter = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new user (SuperAdmin only)
 *     description: Creates a new user account. Public self-registration is disabled.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: SuperAdmin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: User with this phone number or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/register', authenticate, authorize('SuperAdmin'), register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and get JWT token
 *     description: Authenticates credentials and returns a JWT token valid for 7 days.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Account deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/login', login);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   put:
 *     tags: [Auth]
 *     summary: Update current user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
authRouter.get('/profile', authenticate, getProfile);
authRouter.put('/profile', authenticate, updateProfile);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Current password is incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/change-password', authenticate, changePassword);

/**
 * @swagger
 * /api/auth/system-overview:
 *   get:
 *     tags: [Auth]
 *     summary: Get SuperAdmin dashboard overview
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System overview fetched successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: SuperAdmin role required
 */
authRouter.get('/system-overview', authenticate, authorize('SuperAdmin'), getSystemOverview);

/**
 * @swagger
 * /api/auth/provision-targets:
 *   get:
 *     tags: [Auth]
 *     summary: Get Teacher or Parent records available for account provisioning
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Provisioning targets fetched successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: SuperAdmin role required
 */
authRouter.get('/provision-targets', authenticate, authorize('SuperAdmin'), getProvisionTargets);

/**
 * @swagger
 * /api/auth/provision-account:
 *   post:
 *     tags: [Auth]
 *     summary: Create or reset a Teacher/Parent account and optionally send credentials
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account provisioned successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: SuperAdmin role required
 */
authRouter.post('/provision-account', authenticate, authorize('SuperAdmin'), provisionUserAccount);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     tags: [Auth]
 *     summary: Get all users (SuperAdmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [SuperAdmin, Admin, Teacher, Parent]
 *         description: Filter by role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Users fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: SuperAdmin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.get('/users', authenticate, authorize('SuperAdmin'), getAllUsers);

/**
 * @swagger
 * /api/auth/users/permissions:
 *   put:
 *     tags: [Auth]
 *     summary: Update user permissions (SuperAdmin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePermissionsRequest'
 *     responses:
 *       200:
 *         description: Permissions updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
authRouter.put('/users/permissions', authenticate, authorize('SuperAdmin'), updateUserPermissions);

/**
 * @swagger
 * /api/auth/users/toggle-status:
 *   put:
 *     tags: [Auth]
 *     summary: Activate or deactivate a user (SuperAdmin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ToggleStatusRequest'
 *     responses:
 *       200:
 *         description: User status toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
authRouter.put('/users/toggle-status', authenticate, authorize('SuperAdmin'), toggleUserStatus);

export default authRouter;
