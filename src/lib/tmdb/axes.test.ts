import { test, expect } from "vitest";
import { axesFor, axisKey, type TitleAxis } from "./axes";
import type { TmdbTitleDetail } from "./types";

const movieMeta = {
  id: 680,
  credits: {
    cast: [
      { id: 8891, name: "John Travolta", order: 0 },
      { id: 2231, name: "Samuel L. Jackson", order: 1 },
    ],
    crew: [
      { id: 138, name: "Quentin Tarantino", job: "Director" },
      { id: 139, name: "Roger Avary", job: "Writer" },
    ],
  },
  keywords: {
    keywords: [
      { id: 1, name: "aftercreditsstinger" },
      { id: 622, name: "hitman" },
      { id: 623, name: "nonlinear timeline" },
    ],
  },
  genres: [
    { id: 53, name: "Thriller" },
    { id: 80, name: "Crime" },
  ],
} as TmdbTitleDetail;

test("movie: director, lead, first non-stoplisted keyword, genre pair", () => {
  const axes = axesFor("movie", movieMeta);
  expect(axes).toEqual([
    { kind: "person", personId: 138, label: "From director Quentin Tarantino" },
    { kind: "cast", personId: 8891, label: "Also starring John Travolta" },
    { kind: "keyword", keywordId: 622, label: "More hitman" },
    { kind: "genre", genreIds: [53, 80], label: "More thriller + crime" },
  ]);
});

test("tv: person axis comes from created_by and keywords from results", () => {
  const meta = {
    id: 1396,
    created_by: [{ id: 66633, name: "Vince Gilligan" }],
    credits: { cast: [{ id: 17419, name: "Bryan Cranston", order: 0 }] },
    keywords: { results: [{ id: 15009, name: "drug cartel" }] },
    genres: [
      { id: 18, name: "Drama" },
      { id: 80, name: "Crime" },
    ],
  } as TmdbTitleDetail;
  const axes = axesFor("tv", meta);
  expect(axes).toEqual([
    { kind: "person", personId: 66633, label: "From creator Vince Gilligan" },
    { kind: "cast", personId: 17419, label: "Also starring Bryan Cranston" },
    { kind: "keyword", keywordId: 15009, label: "More drug cartel" },
    { kind: "genre", genreIds: [18, 80], label: "More drama + crime" },
  ]);
});

test("lead is the lowest billing order, not array position", () => {
  const meta = {
    id: 1,
    credits: {
      cast: [
        { id: 2, name: "Second", order: 1 },
        { id: 1, name: "First", order: 0 },
      ],
    },
  } as TmdbTitleDetail;
  const axes = axesFor("movie", meta);
  expect(axes).toEqual([{ kind: "cast", personId: 1, label: "Also starring First" }]);
});

test("stoplisted and empty keywords never produce an axis", () => {
  const meta = {
    id: 1,
    keywords: { keywords: [{ id: 1, name: "aftercreditsstinger" }, { id: 2, name: "woman director" }] },
  } as TmdbTitleDetail;
  expect(axesFor("movie", meta)).toEqual([]);
});

test("fewer than two genres skips the genre axis", () => {
  const meta = { id: 1, genres: [{ id: 18, name: "Drama" }] } as TmdbTitleDetail;
  expect(axesFor("tv", meta)).toEqual([]);
});

test("empty meta yields no axes", () => {
  expect(axesFor("movie", { id: 1 } as TmdbTitleDetail)).toEqual([]);
});

test("axisKey is stable per axis identity and mediaType", () => {
  const person: TitleAxis = { kind: "person", personId: 138, label: "From director Quentin Tarantino" };
  const genre: TitleAxis = { kind: "genre", genreIds: [53, 80], label: "More thriller + crime" };
  expect(axisKey("movie", person)).toBe("axis:movie:person:138");
  expect(axisKey("tv", { kind: "cast", personId: 17419, label: "x" })).toBe("axis:tv:cast:17419");
  expect(axisKey("movie", { kind: "keyword", keywordId: 622, label: "x" })).toBe("axis:movie:keyword:622");
  expect(axisKey("movie", genre)).toBe("axis:movie:genre:53-80");
});
