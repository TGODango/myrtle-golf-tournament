-- Private group album; independent of the frozen tournament results.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('myrtle-2026-media','myrtle-2026-media',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']);
create policy trip_media_read on storage.objects for select to authenticated
using (bucket_id='myrtle-2026-media' and exists(select 1 from public.members where user_id=(select auth.uid())));
create policy trip_media_upload on storage.objects for insert to authenticated
with check (bucket_id='myrtle-2026-media' and split_part(name,'--',1)=(select auth.uid())::text and name !~ '/' and exists(select 1 from public.members where user_id=(select auth.uid())));
create policy trip_media_delete on storage.objects for delete to authenticated
using (bucket_id='myrtle-2026-media' and split_part(name,'--',1)=(select auth.uid())::text and exists(select 1 from public.members where user_id=(select auth.uid())));
