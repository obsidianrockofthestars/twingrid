-- sql/2026-09-15_name_guard_reports.sql
-- Founder ruling (Dylan, verbatim): "For public figures, we would need a report button and if the 'public
-- person' get's too many reports to support@personakind.com which should forward to
-- dylanleeson@potionsandfamiliars.com then we can take immediate action. Or we can do what we did for
-- Downtown Vibes and do a block for all 'major named businesses' unless they contact us directly through
-- support@personakind.com". This migration builds both halves: a reserved-name gate on publish/rename
-- (blocklist, checked in twingrid_publish_gate) and an auto-hide-after-3-reports path (new trigger on
-- twingrid_reports) that emails support so Dylan can act. The Room's Report control and the Worker's
-- email send are shipped in the same PR; this file is the database half only.
--
-- Live facts read 2026-09-15 against jpepcqazscmhakxvutpg before writing this:
--   * twingrid_publish_gate fires "before insert or update of is_public" only (pg_trigger). A rename with
--     no is_public in the same PATCH would never re-check the name, so this migration widens it to
--     "insert or update of is_public, name".
--   * twingrid_reports.status is constrained to open, reviewing, actioned, dismissed (twingrid_report_status_ok).
--     "3 reports" means 3 distinct reporters with status = 'open': closing the open reports (moving them to
--     reviewing/actioned/dismissed) drops them out of the count, which is how an unhide resets it.
--   * twingrid_report_snapshot (BEFORE INSERT on twingrid_reports) already copies the grid's name into
--     target_label and its owner into target_owner at report time, so the auto-hide email never has to read
--     the base twingrid_grids table (the Worker's autopilot tick is tested to never touch it, review 2026-09-07).
--   * twingrid_accounts.is_official and twingrid_accounts.adult_confirmed_at already exist and are already
--     column-granted (2026-08-29 / twingrid_sparks_phase_a); no accounts migration needed here.
--   * The 9 live public personas (The Coach, The Founder, The Support Rep, The Companion, The Author, The
--     Analyst, The Operator, The Creator, My Coach) were checked against the seed list below (footer probe 1):
--     none match a blocklist term, so none needed the verified or official exemption to keep publishing.
--
-- Two phases (CLAUDE.md database rule 3). PHASE A is purely additive: two new tables, a new blocklist-match
-- helper, a new auto-hide table and its trigger. Nothing existing changes behaviour. PHASE B replaces
-- twingrid_publish_gate, which the live page already calls on every publish/rename; applied after the page's
-- name_reserved error mapping is live, same discipline as the 2026-09-07 age-gate trigger.

-- =====================================================================
-- PHASE A (additive)
-- =====================================================================

-- 1. The reserved-name list. Read only by the SECURITY DEFINER trigger (owned by postgres, so it needs no
--    grant); nobody else may see or touch it, per CLAUDE.md database rule 1 taken to its lockdown end: RLS
--    on, and a full revoke leaves NO grants at all, not even service_role.
create table if not exists public.twingrid_name_blocklist (
  term       text primary key,
  kind       text not null check (kind in ('brand','person')),
  whole_name boolean not null default false
);
alter table public.twingrid_name_blocklist enable row level security;
revoke all on public.twingrid_name_blocklist from anon, authenticated, service_role, public;

-- Normalise once, match twice: a whole_name term must equal the whole normalised name (optionally with a
-- leading "the"), so "Apple Pie Baker" never collides with "apple"; every other term matches as a whole word
-- anywhere in the name, so "The Starbucks Barista" collides with "starbucks" and "Taylor Swift" collides with
-- itself. \y is Postgres's ARE word-boundary; every term is letters, digits and single spaces (seed constraint
-- below), so no regex metacharacter ever reaches the pattern.
create or replace function public.twingrid_name_reserved(p_name text) returns boolean
language sql stable
set search_path = ''
as $$
  with n as (
    select trim(regexp_replace(regexp_replace(lower(coalesce(p_name,'')), '[^a-z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g')) as v
  )
  select exists (
    select 1 from public.twingrid_name_blocklist b, n
    where (b.whole_name and (n.v = b.term or n.v = 'the ' || b.term))
       or (not b.whole_name and n.v ~ ('\y' || b.term || '\y'))
  );
$$;
revoke all on function public.twingrid_name_reserved(text) from public, anon, authenticated, service_role;
-- No grant: only twingrid_publish_gate calls it, as its SECURITY DEFINER owner (postgres), which needs none.

-- 2. The exemption list: a grid a human at support@ has verified belongs to the person or covers the brand
--    (Founder's ruling: "unless they contact us directly through support@personakind.com"). Service role adds
--    rows by hand after that contact; nobody else may read or write it.
create table if not exists public.twingrid_name_verified (
  grid_id    uuid primary key references public.twingrid_grids(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.twingrid_name_verified enable row level security;
revoke all on public.twingrid_name_verified from anon, authenticated, service_role, public;
grant select, insert, update, delete on public.twingrid_name_verified to service_role;

-- 3. Auto-hide receipts: one row per grid that crossed 3 open reports, so the Worker's hourly tick knows
--    which ones still need the support email (notified_at is null) and never sends it twice. Service role
--    only, and only SELECT and UPDATE: the row is inserted by the trigger below (as its SECURITY DEFINER
--    owner, postgres), never by the Worker.
create table if not exists public.twingrid_auto_hides (
  grid_id     uuid primary key references public.twingrid_grids(id) on delete cascade,
  hidden_at   timestamptz not null default now(),
  notified_at timestamptz
);
alter table public.twingrid_auto_hides enable row level security;
revoke all on public.twingrid_auto_hides from anon, authenticated, service_role, public;
grant select, update on public.twingrid_auto_hides to service_role;

-- 4. Auto-hide trigger. No role branch (an AFTER INSERT trigger fired by the reporter's own RLS-checked
--    insert), so it is SECURITY DEFINER with a locked search_path, same shape as twingrid_report_snapshot
--    right above it in this schema. Counts DISTINCT reporters with status = 'open' on the grid the new report
--    names; at 3 or more, suspends the grid through the same is_suspended column the 2026-09-04 moderator
--    takedown and the public view both already key off, so Explore, chat, the MCP server, the Room and
--    /@handle all stop serving it with no further change (twingrid_grids_public already filters
--    is_suspended = false). "if found" after the UPDATE means the auto_hides upsert (which clears
--    notified_at so a fresh email goes out) only fires the moment the grid is FRESHLY suspended, not on every
--    report that arrives after it: a 4th or 5th report while already hidden does nothing here, so the
--    Worker never re-sends the email for reports 4 and 5 of the same episode. A moderator unhide (existing
--    twingrid_mod_suspend) plus 3 fresh open reports later re-triggers this exactly the same way.
create or replace function public.twingrid_reports_autohide() returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_reporters integer;
begin
  if new.grid_id is not null then
    select count(distinct reporter) into v_reporters
    from public.twingrid_reports
    where grid_id = new.grid_id and status = 'open' and reporter is not null;
    if v_reporters >= 3 then
      -- Official showcase personas are exempt (Prime review): three throwaway accounts must not be able to blank the
      -- showcase. Their reports still queue for a moderator. ponytail: Sybil accounts can still hide a member's
      -- persona until a moderator unhides it; add account-age or verified-email weighting if that gets abused.
      update public.twingrid_grids g set is_suspended = true where g.id = new.grid_id and g.is_suspended = false
        and not exists (select 1 from public.twingrid_accounts a where a.id = g.owner and a.is_official);
      if found then
        insert into public.twingrid_auto_hides (grid_id, hidden_at, notified_at) values (new.grid_id, now(), null)
        on conflict (grid_id) do update set hidden_at = now(), notified_at = null;
      end if;
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists twingrid_reports_autohide on public.twingrid_reports;
create trigger twingrid_reports_autohide after insert on public.twingrid_reports
  for each row execute function public.twingrid_reports_autohide();

-- 5. The seed list: about 150 well-known living or recently living public figures and about 150 major named
--    businesses and famous franchise characters, per the founder's ruling above. Normalised lower case,
--    letters, digits and single spaces only (matching twingrid_name_reserved's own normalisation, so a
--    seed row and an owner's typed name always meet on the same ground). Fictional franchise characters are
--    kind = 'brand' (they are a company's IP, not a person). whole_name = true only for the ordinary-English-
--    word brands named in the build spec (apple, target, subway, shell, gap, visa, oracle, dove) plus the
--    same-shaped ones found while seeding (delta, chase, discover, united, square, stripe): every other term,
--    person or brand, matches as a whole word anywhere in the name.
insert into public.twingrid_name_blocklist (term, kind, whole_name) values
  -- Musicians
  ('taylor swift','person',false), ('beyonce','person',false), ('drake','person',false),
  ('rihanna','person',false), ('ed sheeran','person',false), ('adele','person',false),
  ('kanye west','person',false), ('justin bieber','person',false), ('ariana grande','person',false),
  ('billie eilish','person',false), ('the weeknd','person',false), ('bruno mars','person',false),
  ('lady gaga','person',false), ('katy perry','person',false), ('post malone','person',false),
  ('travis scott','person',false), ('nicki minaj','person',false), ('cardi b','person',false),
  ('dua lipa','person',false), ('harry styles','person',false), ('olivia rodrigo','person',false),
  ('sza','person',false), ('bad bunny','person',false), ('shakira','person',false),
  ('eminem','person',false), ('jay z','person',false), ('kendrick lamar','person',false),
  ('t pain','person',false), ('chris brown','person',false), ('usher','person',false),
  -- Actors
  ('tom hanks','person',false), ('tom cruise','person',false), ('brad pitt','person',false),
  ('leonardo dicaprio','person',false), ('dwayne johnson','person',false), ('will smith','person',false),
  ('denzel washington','person',false), ('robert downey jr','person',false), ('scarlett johansson','person',false),
  ('jennifer lawrence','person',false), ('emma watson','person',false), ('meryl streep','person',false),
  ('zendaya','person',false), ('timothee chalamet','person',false), ('margot robbie','person',false),
  ('ryan reynolds','person',false), ('chris hemsworth','person',false), ('chris evans','person',false),
  ('keanu reeves','person',false), ('johnny depp','person',false), ('angelina jolie','person',false),
  ('jennifer aniston','person',false), ('sandra bullock','person',false), ('julia roberts','person',false),
  ('morgan freeman','person',false), ('samuel l jackson','person',false), ('idris elba','person',false),
  ('hugh jackman','person',false), ('anne hathaway','person',false), ('natalie portman','person',false),
  -- Athletes
  ('lebron james','person',false), ('michael jordan','person',false), ('serena williams','person',false),
  ('cristiano ronaldo','person',false), ('lionel messi','person',false), ('tom brady','person',false),
  ('tiger woods','person',false), ('kobe bryant','person',false), ('stephen curry','person',false),
  ('kevin durant','person',false), ('shaquille oneal','person',false), ('usain bolt','person',false),
  ('simone biles','person',false), ('michael phelps','person',false), ('muhammad ali','person',false),
  ('conor mcgregor','person',false), ('floyd mayweather','person',false), ('novak djokovic','person',false),
  ('rafael nadal','person',false), ('roger federer','person',false), ('neymar','person',false),
  ('naomi osaka','person',false), ('patrick mahomes','person',false), ('shohei ohtani','person',false),
  ('caitlin clark','person',false),
  -- Politicians
  ('barack obama','person',false), ('joe biden','person',false), ('donald trump','person',false),
  ('kamala harris','person',false), ('hillary clinton','person',false), ('bernie sanders','person',false),
  ('nancy pelosi','person',false), ('mitch mcconnell','person',false), ('elizabeth warren','person',false),
  ('ron desantis','person',false), ('alexandria ocasio cortez','person',false), ('ted cruz','person',false),
  ('marco rubio','person',false), ('george w bush','person',false), ('bill clinton','person',false),
  ('vladimir putin','person',false), ('xi jinping','person',false), ('justin trudeau','person',false),
  ('volodymyr zelensky','person',false), ('angela merkel','person',false), ('nikki haley','person',false),
  ('gavin newsom','person',false), ('mike pence','person',false), ('rand paul','person',false),
  ('jd vance','person',false),
  -- Tech and business leaders
  ('elon musk','person',false), ('jeff bezos','person',false), ('bill gates','person',false),
  ('mark zuckerberg','person',false), ('tim cook','person',false), ('satya nadella','person',false),
  ('sundar pichai','person',false), ('warren buffett','person',false), ('sam altman','person',false),
  ('larry page','person',false), ('sergey brin','person',false), ('steve jobs','person',false),
  ('jack dorsey','person',false), ('jensen huang','person',false), ('larry ellison','person',false),
  ('michael dell','person',false), ('richard branson','person',false), ('oprah winfrey','person',false),
  ('howard schultz','person',false), ('reed hastings','person',false), ('susan wojcicki','person',false),
  ('marissa mayer','person',false), ('peter thiel','person',false), ('travis kalanick','person',false),
  ('brian chesky','person',false),
  -- Influencers and media
  ('mrbeast','person',false), ('pewdiepie','person',false), ('kim kardashian','person',false),
  ('kylie jenner','person',false), ('khloe kardashian','person',false), ('kris jenner','person',false),
  ('logan paul','person',false), ('jake paul','person',false), ('addison rae','person',false),
  ('charli damelio','person',false), ('emma chamberlain','person',false), ('joe rogan','person',false),
  ('ellen degeneres','person',false), ('jimmy fallon','person',false), ('trevor noah','person',false),
  -- Big tech
  ('apple','brand',true), ('google','brand',false), ('microsoft','brand',false), ('amazon','brand',true),
  ('meta','brand',false), ('facebook','brand',false), ('instagram','brand',false), ('twitter','brand',false),
  ('tiktok','brand',false), ('snapchat','brand',false), ('linkedin','brand',false), ('oracle','brand',true),
  ('ibm','brand',false), ('intel','brand',false), ('nvidia','brand',false), ('adobe','brand',false),
  ('salesforce','brand',false), ('dell','brand',false), ('samsung','brand',false), ('sony','brand',false),
  -- Retail
  ('walmart','brand',false), ('target','brand',true), ('costco','brand',false), ('kroger','brand',false),
  ('walgreens','brand',false), ('cvs','brand',false), ('home depot','brand',false), ('lowes','brand',false),
  ('best buy','brand',false), ('ikea','brand',false), ('gap','brand',true), ('nike','brand',false),
  ('adidas','brand',false), ('zara','brand',false),
  -- Fast food
  ('mcdonalds','brand',false), ('burger king','brand',false), ('wendys','brand',false), ('subway','brand',true),
  ('starbucks','brand',false), ('dunkin','brand',false), ('taco bell','brand',false), ('kfc','brand',false),
  ('chipotle','brand',false), ('dominos','brand',false), ('pizza hut','brand',false), ('popeyes','brand',false),
  ('chick fil a','brand',false), ('panera','brand',false), ('sonic','brand',false), ('arbys','brand',false),
  ('panda express','brand',false), ('five guys','brand',false), ('shake shack','brand',false), ('dairy queen','brand',false),
  -- Carmakers
  ('tesla','brand',false), ('toyota','brand',false), ('ford','brand',false), ('chevrolet','brand',false),
  ('honda','brand',false), ('bmw','brand',false), ('mercedes benz','brand',false), ('audi','brand',false),
  ('volkswagen','brand',false), ('nissan','brand',false), ('hyundai','brand',false), ('kia','brand',false),
  ('porsche','brand',false), ('ferrari','brand',false), ('jeep','brand',false),
  -- Airlines
  ('delta','brand',true), ('united','brand',true), ('american airlines','brand',false), ('southwest','brand',false),
  ('jetblue','brand',false), ('spirit airlines','brand',false), ('alaska airlines','brand',false),
  ('frontier airlines','brand',false), ('ryanair','brand',false), ('emirates','brand',false),
  -- Banks and payments
  ('chase','brand',true), ('bank of america','brand',false), ('wells fargo','brand',false), ('citibank','brand',false),
  ('capital one','brand',false), ('discover','brand',true), ('american express','brand',false),
  ('goldman sachs','brand',false), ('morgan stanley','brand',false), ('paypal','brand',false),
  ('visa','brand',true), ('square','brand',true), ('stripe','brand',true),
  -- Streaming
  ('netflix','brand',false), ('disney plus','brand',false), ('hulu','brand',false), ('hbo max','brand',false),
  ('amazon prime video','brand',false), ('spotify','brand',false), ('youtube','brand',false),
  ('apple tv plus','brand',false), ('paramount plus','brand',false), ('peacock','brand',false),
  -- Game studios
  ('nintendo','brand',false), ('playstation','brand',false), ('xbox','brand',false), ('electronic arts','brand',false),
  ('activision','brand',false), ('blizzard','brand',false), ('ubisoft','brand',false), ('rockstar games','brand',false),
  ('valve','brand',false), ('epic games','brand',false), ('riot games','brand',false), ('bungie','brand',false),
  ('square enix','brand',false), ('capcom','brand',false), ('sega','brand',false),
  -- Disney characters
  ('mickey mouse','brand',false), ('minnie mouse','brand',false), ('donald duck','brand',false), ('goofy','brand',false),
  ('elsa','brand',false), ('anna','brand',false), ('simba','brand',false), ('woody','brand',false),
  ('buzz lightyear','brand',false), ('ariel','brand',false), ('belle','brand',false), ('cinderella','brand',false),
  ('aladdin','brand',false), ('jasmine','brand',false), ('moana','brand',false), ('stitch','brand',false),
  ('winnie the pooh','brand',false), ('tigger','brand',false), ('peter pan','brand',false), ('snow white','brand',false),
  -- Nintendo characters
  ('mario','brand',false), ('luigi','brand',false), ('princess peach','brand',false), ('bowser','brand',false),
  ('yoshi','brand',false), ('donkey kong','brand',false), ('link','brand',false), ('zelda','brand',false),
  ('kirby','brand',false), ('pikachu','brand',false), ('samus aran','brand',false), ('fox mccloud','brand',false),
  ('wario','brand',false), ('toad','brand',false), ('rosalina','brand',false),
  -- Shell (ordinary-word energy brand, whole_name true per build spec)
  ('shell','brand',true), ('dove','brand',true)
on conflict (term) do nothing;
-- Prime review 2026-09-15: a first name or an ordinary word matching anywhere refuses honest names ("Anna the
-- Language Tutor", "Meta Analyst", "Link Builder", "Woody the Carpenter"), so these match only as the whole name.
update public.twingrid_name_blocklist set whole_name = true where term in
  ('drake','usher','adele','neymar','zendaya','meta','intel','dell','sony','ford','jeep','kia','honda','audi',
   'sonic','valve','peacock','sega','blizzard','southwest','nike','zara','anna','belle','ariel','jasmine','elsa',
   'woody','goofy','stitch','link','toad','kirby','yoshi','tigger','simba','moana','aladdin','cinderella','mario',
   'luigi','bowser','wario','zelda','rosalina','dunkin','panera','hulu','emirates','capcom','bungie');

-- =====================================================================
-- PHASE B (applied after the page's name_reserved -> hint mapping is live)
-- =====================================================================

-- twingrid_publish_gate, keeping the 2026-09-07 adult-confirmation check exactly, widened to also fire on a
-- name change and to refuse a reserved name unless the grid is pre-verified or its owner is official.
-- v_becoming_public drives BOTH checks (a grid turning public always gets both the age check and, since its
-- current name might already be reserved, the name check even when this particular UPDATE did not touch
-- name); v_name_changed adds the name check on a rename that leaves is_public untouched.
create or replace function public.twingrid_publish_gate() returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_becoming_public boolean; v_name_changed boolean;
begin
  v_becoming_public := new.is_public and (tg_op = 'INSERT' or not old.is_public);
  v_name_changed := tg_op = 'UPDATE' and new.name is distinct from old.name;
  if v_becoming_public then
    if not exists (select 1 from public.twingrid_accounts a where a.id = new.owner and a.adult_confirmed_at is not null) then
      raise exception 'adult_confirmation_required' using errcode = 'P0001', hint = 'Confirm you are 18 or older on the publish switch first.';
    end if;
  end if;
  if new.is_public and (v_becoming_public or v_name_changed) then
    if public.twingrid_name_reserved(new.name)
       and not exists (select 1 from public.twingrid_name_verified v where v.grid_id = new.id)
       and not exists (select 1 from public.twingrid_accounts a where a.id = new.owner and a.is_official) then
      raise exception 'name_reserved' using errcode = 'P0001',
        hint = 'That name belongs to a real person or brand. To publish it, write to support@personakind.com from an address that proves it is yours.';
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists twingrid_publish_gate on public.twingrid_grids;
create trigger twingrid_publish_gate before insert or update of is_public, name on public.twingrid_grids
  for each row execute function public.twingrid_publish_gate();

-- ---------------------------------------------------------------------------
-- Probes (expected result in the comment; actual outputs pasted into the PR)
-- ---------------------------------------------------------------------------
-- 52. none of the 9 live public personas match the blocklist:
--     select name from twingrid_grids where is_public and name in
--       ('The Coach','The Founder','The Support Rep','The Companion','The Author','The Analyst','The Operator','The Creator','My Coach')
--       and twingrid_name_reserved(name);
--     -> 0 rows
-- 53. select twingrid_name_reserved('Taylor Swift') -> true; twingrid_name_reserved('The Starbucks Barista') -> true;
--     twingrid_name_reserved('Apple Pie Baker') -> false; twingrid_name_reserved('Apple') -> true; twingrid_name_reserved('The Apple') -> true
-- 54. rolled back: an account with adult_confirmed_at set inserts a grid named 'Taylor Swift' with is_public true -> ERROR name_reserved;
--     the same insert after adding its id to twingrid_name_verified -> 1 row; a second account with is_official = true publishing
--     'Taylor Swift' with no verified row -> 1 row (official exemption)
-- 55. rolled back: a public grid named 'Ordinary Persona' (not reserved, adult-confirmed owner) is renamed to 'Elon Musk' via
--     update ... set name = 'Elon Musk' -> ERROR name_reserved; renamed to 'Elon Musk' after a twingrid_name_verified row for its id -> 1 row
-- 56. anon and authenticated (a real foreign sub): select/insert/update/delete on twingrid_name_blocklist, twingrid_name_verified and
--     twingrid_auto_hides all -> 42501 (no policy and no grant on any of the three, for either role)
-- 57. one reporter cannot count three times: the same reporter inserting a second open report on the same grid_id hits the existing
--     twingrid_reports_one_per_grid unique index -> 23505, so twingrid_reports_autohide never sees a repeat reporter from one person
-- 58. rolled back: three DISTINCT reporters each insert one open report naming the same public grid -> after the 3rd, is_suspended = true
--     on that grid and it no longer appears in twingrid_grids_public; a 4th report on the same grid leaves twingrid_auto_hides.notified_at
--     unchanged (already null from the 3rd) rather than being reset twice
-- 59. the Room (renderRoom's fallback read) and /@handle (resolveHandlePersona) both read twingrid_grids_public, which already filters
--     is_suspended = false (2026-09-04); a grid auto-hidden by probe 58 returns no row from either read
