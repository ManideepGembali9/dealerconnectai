
-- Create a private storage bucket for chat image attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to chat-images
CREATE POLICY "allow_uploads_chat_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-images');

-- Allow anyone to read chat images (public bucket)
CREATE POLICY "allow_reads_chat_images" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-images');

-- Allow authenticated users to delete their own chat images
CREATE POLICY "allow_delete_chat_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-images' AND owner = auth.uid());
