begin;

create function public.ig_flow_publication_counts(p_user uuid, p_flow uuid)
returns table(account_id uuid, url text, total bigint)
language sql stable security invoker set search_path = '' as $$
  select j.account_id, media.url, count(*)
  from public.ig_publication_jobs j
  cross join lateral unnest(j.media_urls) as media(url)
  where j.user_id = p_user and j.flow_id = p_flow and j.status = 'published'
  group by j.account_id, media.url;
$$;

revoke all on function public.ig_flow_publication_counts(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ig_flow_publication_counts(uuid, uuid) to service_role;

-- Repair the current queues as well as future plans. Claim workers lock the
-- connection before committing a lease, so only reorder idle accounts we lock.
do $$
declare locked_accounts uuid[];
begin
  select array_agg(a.account_id) into locked_accounts
  from (
    select c.account_id
    from public.ig_publisher_connections c
    where exists (
      select 1 from public.ig_publication_jobs j
      join public.ig_flows f on f.id = j.flow_id
      where j.account_id = c.account_id and j.status = 'scheduled'
        and j.flow_cycle = f.cycle and f.cycle > 1
        and f.state in ('active', 'paused') and f.settings->>'repeat' = 'loop'
    )
    order by c.account_id
    for update of c skip locked
  ) a;

  with pending as materialized (
    select j.id, j.flow_id, j.account_id, j.media_urls,
           j.scheduled_at, j.flow_base_at, j.next_attempt_at
    from public.ig_publication_jobs j
    join public.ig_flows f on f.id = j.flow_id
    where j.account_id = any(locked_accounts) and j.status = 'scheduled'
      and j.flow_cycle = f.cycle and f.cycle > 1
      and f.state in ('active', 'paused') and f.settings->>'repeat' = 'loop'
      and not exists (
        select 1 from public.ig_publication_jobs other
        where other.account_id = j.account_id
          and (other.status = 'processing'
            or (other.flow_id = j.flow_id and other.status = 'scheduled'
              and (other.flow_cycle <> f.cycle or other.attempts > 0)))
      )
    order by j.id
    for update of j
  ), history as (
    select p.flow_id, p.account_id, p.media_urls, count(*) as total
    from public.ig_publication_jobs p
    join (select distinct flow_id, account_id from pending) a using (flow_id, account_id)
    where p.status = 'published'
    group by p.flow_id, p.account_id, p.media_urls
  ), ranked as (
    select p.*,
      row_number() over (partition by p.flow_id, p.account_id
        order by coalesce(p.flow_base_at, p.scheduled_at), p.id) as slot,
      row_number() over (partition by p.flow_id, p.account_id
        order by coalesce(h.total, 0), coalesce(p.flow_base_at, p.scheduled_at), p.id) as priority
    from pending p
    left join history h using (flow_id, account_id, media_urls)
  )
  update public.ig_publication_jobs j
  set scheduled_at = slot.scheduled_at,
      flow_base_at = slot.flow_base_at,
      next_attempt_at = slot.next_attempt_at
  from ranked job
  join ranked slot on slot.flow_id = job.flow_id and slot.account_id = job.account_id
    and slot.slot = job.priority
  where j.id = job.id and job.slot <> job.priority
    and j.status = 'scheduled' and j.attempts = 0;
end;
$$;

commit;
