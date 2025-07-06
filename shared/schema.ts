import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// GitHub PR types
export interface PullRequest {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  url: string;
  html_url: string;
}

export interface ReviewTriggerRequest {
  repo: string;
  prNumber: number;
}

export interface ReviewResponse {
  review: string;
}

export interface TriggerResponse {
  message: string;
}
