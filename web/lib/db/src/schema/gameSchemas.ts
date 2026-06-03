import { pgTable, serial, text, varchar, boolean, integer, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameSchemasTable = pgTable("game_schemas", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  version: varchar("version", { length: 50 }).notNull().default("1.0"),
  vibePrompt: text("vibe_prompt").notNull(),
  targetPlatforms: jsonb("target_platforms").$type<string[]>().notNull().default([]),
  goal: text("goal").notNull(),
  genreTag: varchar("genre_tag", { length: 100 }),
  schemaData: jsonb("schema_data").$type<Record<string, unknown>>().notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  forkCount: integer("fork_count").notNull().default(0),
  forkedFromId: integer("forked_from_id"),
  webxrUrl: text("webxr_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const schemaStarsTable = pgTable("schema_stars", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  schemaId: integer("schema_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("schema_stars_user_schema_idx").on(table.userId, table.schemaId),
]);

export const schemaBuildsTable = pgTable("schema_builds", {
  id: serial("id").primaryKey(),
  schemaId: integer("schema_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  webxrUrl: text("webxr_url"),
  apkUrl: text("apk_url"),
  buildLog: text("build_log"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const schemaVersionsTable = pgTable("schema_versions", {
  id: serial("id").primaryKey(),
  schemaId: integer("schema_id").notNull(),
  versionLabel: varchar("version_label", { length: 50 }).notNull(),
  schemaData: jsonb("schema_data").$type<Record<string, unknown>>().notNull(),
  title: varchar("title", { length: 255 }),
  changeNote: text("change_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGameSchemaSchema = createInsertSchema(gameSchemasTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGameSchema = z.infer<typeof insertGameSchemaSchema>;
export type GameSchema = typeof gameSchemasTable.$inferSelect;
export type SchemaVersion = typeof schemaVersionsTable.$inferSelect;
export type SchemaBuild = typeof schemaBuildsTable.$inferSelect;
