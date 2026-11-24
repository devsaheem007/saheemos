import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/index.js";
import { ROLES } from "../config/permissions.js";
import { asyncHandler, AppError, validate } from "../utils/errors.js";
import { requirePerm } from "../middleware/security.js";
import { passwordSchema } from "./auth.js";
import { escapeRegex } from "../utils/sanitize.js";
import { audit } from "../utils/audit.js";

const r = express.Router();
const roleEnum = z.enum(ROLES);

r.get(
  "/",
  requirePerm("users", "r"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 20);
    const q = {};
    if (typeof req.query.q === "string" && req.query.q) {
      const rx = new RegExp(escapeRegex(req.query.q.slice(0, 80)), "i");
      q.$or = [{ name: rx }, { email: rx }];
    }
    if (typeof req.query.role === "string" && ROLES.includes(req.query.role))
      q.role = req.query.role;
    const [items, total] = await Promise.all([
      User.find(q)
        .select("name email role active profileId mustChangePassword createdAt")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(q),
    ]);
    res.json({
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);

const createSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  role: roleEnum,
  password: passwordSchema,
  profileId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional()
    .or(z.literal("")),
});

r.post(
  "/",
  requirePerm("users", "c"),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { password, profileId, ...rest } = req.body;
    if (rest.role === "owner" && req.user.role !== "owner")
      throw new AppError(
        403,
        "Only the owner can create another owner account",
      );
    const user = await User.create({
      ...rest,
      profileId: profileId || undefined,
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
    });
    audit(req, "create", "users", user._id, { role: user.role });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      profileId: user.profileId,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
    });
  }),
);

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  role: roleEnum.optional(),
  active: z.boolean().optional(),
  profileId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional()
    .or(z.literal("")),
  password: passwordSchema.optional().or(z.literal("")),
});

r.patch(
  "/:id",
  requirePerm("users", "u"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "User not found");
    if (req.body.role !== undefined && req.user.role !== "owner") {
      throw new AppError(403, "Only the owner can change user roles");
    }
    if (user.role === "owner" && req.user.role !== "owner") {
      throw new AppError(403, "Only the owner can modify owner accounts");
    }
    if (
      String(user._id) === String(req.user._id) &&
      (req.body.active === false ||
        (req.body.role && req.body.role !== user.role))
    )
      throw new AppError(
        400,
        "You cannot deactivate or change the role of your own account",
      );
    const { password, profileId, ...rest } = req.body;
    user.set(rest);
    if (profileId !== undefined) user.profileId = profileId || undefined;
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 12);
      user.mustChangePassword = true;
    }
    if (rest.active === false || rest.role || password) user.tokenVersion += 1; // revoke existing sessions
    await user.save();
    audit(req, "update", "users", user._id, {
      fields: Object.keys(req.body).filter((k) => k !== "password"),
    });
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      profileId: user.profileId,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
    });
  }),
);

export default r;
