import { boolean, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { vector, EMBEDDING_DIM } from "./vector";

export const roleEnum = pgEnum("role", ["user", "editor", "admin"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  username: text("username").notNull().unique(),
  avatarUrl: text("avatar_url"),
  region: text("region").notNull().default("US"),
  preferredGenres: integer("preferred_genres").array(),
  role: roleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;

export const configOptions = pgTable(
  "config_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    namespace: text("namespace").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    value: jsonb("value"),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("config_options_ns_key").on(t.namespace, t.key)],
);

export const contentBlocks = pgTable("content_blocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const configEntityTypeEnum = pgEnum("config_entity_type", [
  "options_namespace",
  "content_block",
]);

export const configVersions = pgTable(
  "config_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: configEntityTypeEnum("entity_type").notNull(),
    entityKey: text("entity_key").notNull(),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    publishedBy: text("published_by").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("config_versions_entity_version").on(t.entityType, t.entityKey, t.version)],
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityKey: text("entity_key").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConfigOptionRow = typeof configOptions.$inferSelect;
export type ContentBlockRow = typeof contentBlocks.$inferSelect;
export type ConfigVersionRow = typeof configVersions.$inferSelect;

export const mediaTypeEnum = pgEnum("media_type", ["movie", "tv"]);

export const titles = pgTable("titles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tmdbId: integer("tmdb_id").notNull(),
  mediaType: mediaTypeEnum("media_type").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  releaseYear: integer("release_year"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  overview: text("overview"),
  metadata: jsonb("metadata"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("titles_tmdb_media").on(t.tmdbId, t.mediaType)]);

export const people = pgTable("people", {
  id: uuid("id").defaultRandom().primaryKey(),
  tmdbId: integer("tmdb_id").notNull().unique(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  profilePath: text("profile_path"),
  metadata: jsonb("metadata"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TitleRow = typeof titles.$inferSelect;
export type PersonRow = typeof people.$inferSelect;

export const watchStatusEnum = pgEnum("watch_status", ["want_to_watch", "watching", "watched"]);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    titleId: uuid("title_id").notNull().references(() => titles.id, { onDelete: "cascade" }),
    status: watchStatusEnum("status").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleId] })],
);

export const ratings = pgTable(
  "ratings",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    titleId: uuid("title_id").notNull().references(() => titles.id, { onDelete: "cascade" }),
    score: integer("score").notNull(), // 1..5
    ratedAt: timestamp("rated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleId] })],
);

export const favourites = pgTable(
  "favourites",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    titleId: uuid("title_id").notNull().references(() => titles.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleId] })],
);

export type WatchlistItemRow = typeof watchlistItems.$inferSelect;
export type RatingRow = typeof ratings.$inferSelect;
export type FavouriteRow = typeof favourites.$inferSelect;

const vec = vector(EMBEDDING_DIM);

export const titleEmbeddings = pgTable("title_embeddings", {
  titleId: uuid("title_id")
    .primaryKey()
    .references(() => titles.id, { onDelete: "cascade" }),
  embedding: vec("embedding").notNull(),
  model: text("model").notNull(),
  descriptorHash: text("descriptor_hash").notNull(),
  builtAt: timestamp("built_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userTaste = pgTable("user_taste", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  embedding: vec("embedding").notNull(),
  ratedCount: integer("rated_count").notNull().default(0),
  builtAt: timestamp("built_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TitleEmbeddingRow = typeof titleEmbeddings.$inferSelect;
export type UserTasteRow = typeof userTaste.$inferSelect;
