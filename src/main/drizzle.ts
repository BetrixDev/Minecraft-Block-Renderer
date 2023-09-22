import { BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { DB_DIRECTORY } from "./constants";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

type VariantTypes =
  | { type: "boolean" }
  | { type: "number"; values: number[] }
  | { type: "string"; values: string[] };

export const blocks = sqliteTable("blocks", {
  blockId: text("blockId").primaryKey(),
  modId: text("modId").primaryKey(),
  blockName: text("blockName"),
  jarSlug: text("jarSlug").notNull(),
  texture64: text("texture64"),
  entryName: text("entryName").notNull(),
  variants: text("variants", { mode: "json" })
    .$type<({ key: string } & VariantTypes)[]>()
    .notNull()
    .default([]),
});

let sqlite = new Database(DB_DIRECTORY);
export let db: BetterSQLite3Database;

export function initDatabaseCache() {
  sqlite = new Database(DB_DIRECTORY);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS blocks (
    blockId TEXT PRIMARY KEY,
    modId TEXT,
    blockName TEXT,
    jarSlug TEXT NOT NULL,
    texture64 TEXT,
    entryName TEXT NOT NULL,
    variants TEXT NOT NULL
  );`);

  db = drizzle(sqlite);
}

export function closeConnection() {
  sqlite.close();
}
