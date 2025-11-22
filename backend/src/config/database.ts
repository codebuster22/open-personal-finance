import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Support both DATABASE_URL and individual connection parameters
const getDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    // Use connection string if provided
    return {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  } else {
    // Fall back to individual parameters
    return {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "personal_finance",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }
};

const pool = new Pool(getDatabaseConfig());

export const query = (text: string, params?: any[]) => pool.query(text, params);

export const getClient = () => pool.connect();

export default pool;
