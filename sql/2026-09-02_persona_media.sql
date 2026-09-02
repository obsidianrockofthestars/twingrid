-- 2026-09-02: persona image and voice, upload half (Dylan's rulings 2026-09-02: columns on twingrid_grids,
-- costs carried by the user, so uploads are client-side and $0: resize in the browser, store in Supabase
-- Storage under the uploader's own folder, point image_url at it. The check constraint pins image_url to
-- our bucket (no hotlinking), the trigger pins it to the caller's own folder (no pointing at someone else's
-- upload), storage RLS pins writes to the caller's folder. Moderation rides the existing report path.
-- Applied to jpepcqazscmhakxvutpg on 2026-09-02 as migration twingrid_persona_media_columns_and_bucket.
alter table public.twingrid_grids
  add column if not exists image_url text
    check (image_url is null or (length(image_url) <= 400 and image_url like 'https://jpepcqazscmhakxvutpg.supabase.co/storage/v1/object/public/twingrid-media/%')),
  add column if not exists voice_id text
    check (voice_id is null or voice_id ~ '^[A-Za-z0-9_-]{1,40}$');

grant update (image_url, voice_id) on public.twingrid_grids to authenticated;

create or replace function public.twingrid_media_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.image_url is distinct from old.image_url and new.image_url is not null then
    if coalesce(auth.role(), '') <> 'service_role'
       and (auth.uid() is null
            or position('/twingrid-media/' || auth.uid()::text || '/' in new.image_url) = 0) then
      raise exception 'image must live in your own media folder' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists twingrid_media_guard on public.twingrid_grids;
create trigger twingrid_media_guard
  before update on public.twingrid_grids
  for each row execute function public.twingrid_media_guard();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('twingrid-media', 'twingrid-media', true, 2097152, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "twingrid_media_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'twingrid-media');
create policy "twingrid_media_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'twingrid-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "twingrid_media_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'twingrid-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'twingrid-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "twingrid_media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'twingrid-media' and (storage.foldername(name))[1] = auth.uid()::text);
