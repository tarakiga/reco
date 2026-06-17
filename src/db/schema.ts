import { boolean, date, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
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

// User-created shareable lists (e.g. "My Top Ten Mind Movies").
export const lists = pgTable("lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  slug: text("slug").notNull(),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const listItems = pgTable(
  "list_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
    titleId: uuid("title_id").notNull().references(() => titles.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    note: text("note"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("list_items_list_title").on(t.listId, t.titleId)],
);

export type ListRow = typeof lists.$inferSelect;
export type ListItemRow = typeof listItems.$inferSelect;

// Personal, private tags a user applies to titles (e.g. "Shark shows").
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("tags_user_slug").on(t.userId, t.slug)],
);

export const titleTags = pgTable(
  "title_tags",
  {
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
    titleId: uuid("title_id").notNull().references(() => titles.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tagId, t.titleId] })],
);

export type TagRow = typeof tags.$inferSelect;
export type TitleTagRow = typeof titleTags.$inferSelect;

// Watch diary: a dated log of titles the user has seen (rewatches = multiple dates).
export const diary = pgTable(
  "diary",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    titleId: uuid("title_id").notNull().references(() => titles.id, { onDelete: "cascade" }),
    watchedOn: date("watched_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("diary_user_title_date").on(t.userId, t.titleId, t.watchedOn)],
);

export type DiaryRow = typeof diary.$inferSelect;

// "Vote to Watch": a two-round group movie poll. The creator sets the expected
// voter count + an optional deadline, shares the slug; round 1 is a blind pick,
// then a genre cull narrows the field for round 2's runoff.
export const pollStatusEnum = pgEnum("poll_status", ["round1", "round2", "done"]);

export const polls = pgTable("polls", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  expectedVoters: integer("expected_voters").notNull(),
  deadline: timestamp("deadline", { withTimezone: true }),
  status: pollStatusEnum("status").notNull().default("round1"),
  // Surviving title ids after the round-1 genre cull (round-2 ballot).
  round2TitleIds: uuid("round2_title_ids").array(),
  winnerTitleId: uuid("winner_title_id").references(() => titles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pollId: uuid("poll_id").notNull().references(() => polls.id, { onDelete: "cascade" }),
    // Voter identity: "u:<profileId>" for signed-in, "a:<token>" for guests.
    voterKey: text("voter_key").notNull(),
    // Set only for signed-in voters; null for cookie-tracked guests.
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }),
    round: integer("round").notNull(), // 1 or 2
    titleId: uuid("title_id").notNull().references(() => titles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("poll_votes_poll_voter_round").on(t.pollId, t.voterKey, t.round)],
);

export type PollRow = typeof polls.$inferSelect;
export type PollVoteRow = typeof pollVotes.$inferSelect;

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
