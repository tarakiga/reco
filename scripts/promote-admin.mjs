import { sql } from "./_db.mjs";

const username = process.argv[2];
const role = process.argv[3] ?? "admin";
if (!username || !["admin", "editor", "user"].includes(role)) {
  console.error("Usage: node scripts/promote-admin.mjs <username> [admin|editor|user]");
  process.exit(1);
}
const rows = await sql`UPDATE profiles SET role = ${role} WHERE username = ${username} RETURNING username, role`;
if (rows.length === 0) {
  console.error(`No profile with username "${username}". Sign in once first.`);
  await sql.end();
  process.exit(1);
}
console.log(`${rows[0].username} is now ${rows[0].role}`);
await sql.end();
