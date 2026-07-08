-- ============================================================
-- Storage policies for treasure-images bucket
-- Run this in Supabase SQL Editor
-- ============================================================

-- Allow authenticated users to upload images
create policy "Authenticated users can upload treasure images"
  on storage.objects for insert
  with check (
    bucket_id = 'treasure-images'
    and auth.uid() is not null
  );

-- Allow anyone to view/download images (bucket is public)
create policy "Anyone can view treasure images"
  on storage.objects for select
  using (bucket_id = 'treasure-images');

-- Allow users to update their own uploads
create policy "Users can update their own images"
  on storage.objects for update
  using (
    bucket_id = 'treasure-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own uploads
create policy "Users can delete their own images"
  on storage.objects for delete
  using (
    bucket_id = 'treasure-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
