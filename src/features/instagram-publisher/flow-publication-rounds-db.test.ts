// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const readSql = (name: string) =>
  readFileSync(new URL(`../../../supabase/${name}`, import.meta.url), "utf8");

it("moves unseen media to the first existing slot and leaves attempted queues alone", async () => {
  const db = new PGlite();
  try {
    await db.exec(readSql("tests/fixtures/instagram-publisher-queue.sql"));
    await db.exec("alter table ig_publication_jobs add column flow_base_at timestamptz");
    const user = crypto.randomUUID();
    const flow = crypto.randomUUID();
    const idle = crypto.randomUUID();
    const retrying = crypto.randomUUID();
    await db.query(
      "insert into ig_flows(id, user_id, settings, cycle) values ($1, $2, '{\"repeat\":\"loop\"}', 2)",
      [flow, user],
    );
    await db.query(
      "insert into ig_publisher_connections(account_id, user_id) values ($1, $3), ($2, $3)",
      [idle, retrying, user],
    );
    await db.query(
      `insert into ig_publication_jobs
        (user_id, flow_id, account_id, media_urls, flow_cycle, status, attempts,
         scheduled_at, flow_base_at, next_attempt_at)
       select $1, $2, account_id, array[media], cycle, status,
         case when account_id = $4 and offset_min = 10 then 1 else 0 end,
         base_at + make_interval(mins => offset_min + 2),
         base_at + make_interval(mins => offset_min),
         base_at + make_interval(mins => offset_min + 1)
       from unnest(array[$3, $4]::uuid[]) account(account_id)
       cross join (values ('seen.mp4', 1, 'published', 0),
         ('new.mp4', 1, 'cancelled', 5), ('seen.mp4', 2, 'scheduled', 10),
         ('new.mp4', 2, 'scheduled', 20)) job(media, cycle, status, offset_min)
       cross join (select timestamptz '2026-11-26 10:00:00Z' as base_at) time`,
      [user, flow, idle, retrying],
    );

    await db.exec(readSql("migrations/20261126181739_instagram_flow_account_publication_rounds.sql"));

    const counts = await db.query(
      "select account_id, url, total from ig_flow_publication_counts($1, $2)",
      [user, flow],
    );
    expect(counts.rows).toEqual(expect.arrayContaining([
      { account_id: idle, url: "seen.mp4", total: 1 },
      { account_id: retrying, url: "seen.mp4", total: 1 },
    ]));
    expect(counts.rows).toHaveLength(2);
    const queue = (account: string) => db.query(
      `select media_urls[1] as media, extract(minute from scheduled_at) as scheduled,
        extract(minute from flow_base_at) as base, extract(minute from next_attempt_at) as retry
       from ig_publication_jobs where account_id = $1 and status = 'scheduled'
       order by flow_base_at`,
      [account],
    );
    expect((await queue(idle)).rows).toEqual([
      { media: "new.mp4", scheduled: "12", base: "10", retry: "11" },
      { media: "seen.mp4", scheduled: "22", base: "20", retry: "21" },
    ]);
    expect((await queue(retrying)).rows).toEqual([
      { media: "seen.mp4", scheduled: "12", base: "10", retry: "11" },
      { media: "new.mp4", scheduled: "22", base: "20", retry: "21" },
    ]);
  } finally {
    await db.close();
  }
}, 30_000);
