import * as sqlite3 from "sqlite3";
import { open } from "sqlite";
import { config } from "./../config";
import { NewTokenRecord } from "../types";

// New token duplicates tracker
export async function createTableNewTokens(database: any): Promise<boolean> {
  try {
    await database.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time INTEGER NOT NULL,
      name TEXT NOT NULL,
      mint TEXT NOT NULL,
      creator TEXT NOT NULL
    );
  `);
    return true;
  } catch (error: any) {
    console.error("Failed to create tokens table:", error?.message || error);
    return false;
  }
}

export async function insertNewToken(newToken: NewTokenRecord): Promise<boolean> {
  let db = null;
  try {
    db = await open({
      filename: config.db.pathname,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const newTokensTableExist = await createTableNewTokens(db);
    if (!newTokensTableExist) {
      throw new Error("Failed to create tokens table");
    }

    // Extract token data
    const { time, name, mint, creator } = newToken;

    // Insert the record
    await db.run(
      `INSERT INTO tokens (time, name, mint, creator) VALUES (?, ?, ?, ?);`,
      [time, name, mint, creator]
    );

    return true;
  } catch (error) {
    console.error("Error inserting new token:", error instanceof Error ? error.message : "Unknown error", { mint: newToken.mint });
    return false;
  } finally {
    // Always close the database connection
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.error("Error closing database connection:", closeError instanceof Error ? closeError.message : "Unknown error");
      }
    }
  }
}

export async function selectTokenByNameAndCreator(name: string, creator: string): Promise<NewTokenRecord[]> {
  let db = null;
  try {
    // Open the database
    db = await open({
      filename: config.db.pathname,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const newTokensTableExist = await createTableNewTokens(db);
    if (!newTokensTableExist) {
      throw new Error("Failed to create tokens table");
    }

    // Query the database for matching tokens
    return await db.all(
      `SELECT * FROM tokens WHERE name = ? OR creator = ?;`,
      [name, creator]
    );
  } catch (error) {
    console.error("Error selecting token by name and creator:", error instanceof Error ? error.message : "Unknown error", { name, creator });
    return [];
  } finally {
    // Always close the database connection
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.error("Error closing database connection:", closeError instanceof Error ? closeError.message : "Unknown error");
      }
    }
  }
}

export async function selectTokenByMint(mint: string): Promise<NewTokenRecord[]> {
  let db = null;
  try {
    // Open the database
    db = await open({
      filename: config.db.pathname,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const newTokensTableExist = await createTableNewTokens(db);
    if (!newTokensTableExist) {
      throw new Error("Failed to create tokens table");
    }

    // Query the database for matching tokens
    return await db.all(
      `SELECT * FROM tokens WHERE mint = ?;`,
      [mint]
    );
  } catch (error) {
    console.error("Error selecting token by mint:", error instanceof Error ? error.message : "Unknown error", { mint });
    return [];
  } finally {
    // Always close the database connection
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.error("Error closing database connection:", closeError instanceof Error ? closeError.message : "Unknown error");
      }
    }
  }
}

export async function selectAllTokens(): Promise<NewTokenRecord[]> {
  let db = null;
  try {
    // Open the database
    db = await open({
      filename: config.db.pathname,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const newTokensTableExist = await createTableNewTokens(db);
    if (!newTokensTableExist) {
      throw new Error("Failed to create tokens table");
    }

    // Query the database for all tokens
    return await db.all(`SELECT * FROM tokens;`);
  } catch (error) {
    console.error("Error selecting all tokens:", error instanceof Error ? error.message : "Unknown error");
    return [];
  } finally {
    // Always close the database connection
    if (db) {
      try {
        await db.close();
      } catch (closeError) {
        console.error("Error closing database connection:", closeError instanceof Error ? closeError.message : "Unknown error");
      }
    }
  }
}
