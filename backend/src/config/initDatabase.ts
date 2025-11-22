import { getClient } from "./database";
import { SCHEMA_SQL } from "../models/schema";

export const initializeDatabase = async () => {
  console.log("Initializing database...");

  const client = await getClient();

  try {
    // Execute the schema
    await client.query(SCHEMA_SQL);

    console.log("✓ Database tables initialized successfully");
  } catch (error: any) {
    // Check if tables already exist (which is fine)
    if (error.code === "42P07") {
      console.log("✓ Database tables already exist");
    } else {
      console.error("Error initializing database:", error);
      throw error;
    }
  } finally {
    client.release();
  }
};

export const testDatabaseConnection = async () => {
  console.log("Testing database connection...");

  const client = await getClient();

  try {
    await client.query("SELECT NOW()");
    console.log("✓ Database connection successful");
    return true;
  } catch (error) {
    console.error("✗ Database connection failed:", error);
    throw error;
  } finally {
    client.release();
  }
};
