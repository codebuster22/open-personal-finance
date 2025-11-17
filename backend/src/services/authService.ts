import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = "7d";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export const registerUser = async (
  email: string,
  password: string
): Promise<{ user: Omit<User, "password_hash">; token: string }> => {
  // Check if user exists
  const existingUser = await query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);

  if (existingUser.rows.length > 0) {
    throw new AppError("User with this email already exists", 400);
  }

  // Validate password strength
  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters long", 400);
  }

  // Hash password
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  // Create user
  const result = await query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at, updated_at",
    [email, passwordHash]
  );

  const user = result.rows[0];
  const token = generateToken(user.id);

  return { user, token };
};

export const loginUser = async (
  email: string,
  password: string
): Promise<{ user: Omit<User, "password_hash">; token: string }> => {
  const result = await query(
    "SELECT id, email, password_hash, created_at, updated_at FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {
    throw new AppError("Invalid email or password", 401);
  }

  const user = result.rows[0];
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = generateToken(user.id);

  const { password_hash, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
};

export const getUserById = async (
  userId: string
): Promise<Omit<User, "password_hash">> => {
  const result = await query(
    "SELECT id, email, created_at, updated_at FROM users WHERE id = $1",
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError("User not found", 404);
  }

  return result.rows[0];
};

const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};
