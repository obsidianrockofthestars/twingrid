-- 2026-09-02: a handle is claimed once and never renamed by its owner (the Home claim card
-- promises it, and /@handle links would break). The UPDATE grant on twingrid_accounts is
-- column-level already (08-29: avatar_image_url, avatar_theme, banner_theme, bio, display_name,
-- handle, voice_id), so removing the handle column is a plain column revoke, not the 08-29 trap.
-- Applied to jpepcqazscmhakxvutpg on 2026-09-02 as migration twingrid_accounts_handle_is_permanent.
revoke update (handle) on public.twingrid_accounts from authenticated;
