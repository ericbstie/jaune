import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const user = pgTable("user", {
  createdAt: timestamp({ withTimezone: true }).notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull(),
  id: text().primaryKey(),
  image: text(),
  name: text().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull(),
});
const session = pgTable("session", {
  createdAt: timestamp({ withTimezone: true }).notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  id: text().primaryKey(),
  ipAddress: text(),
  token: text().notNull().unique(),
  updatedAt: timestamp({ withTimezone: true }).notNull(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
const account = pgTable("account", {
  accessToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  accountId: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull(),
  id: text().primaryKey(),
  idToken: text(),
  password: text(),
  providerId: text().notNull(),
  refreshToken: text(),
  refreshTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  updatedAt: timestamp({ withTimezone: true }).notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
const verification = pgTable("verification", {
  createdAt: timestamp({ withTimezone: true }).notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  id: text().primaryKey(),
  identifier: text().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull(),
  value: text().notNull(),
});
const deviceCode = pgTable("deviceCode", {
  clientId: text(),
  deviceCode: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  id: text().primaryKey(),
  lastPolledAt: timestamp({ withTimezone: true }),
  pollingInterval: integer(),
  scope: text(),
  status: text().notNull(),
  userCode: text().notNull().unique(),
  userId: text(),
});

export { account, deviceCode, session, user, verification };
