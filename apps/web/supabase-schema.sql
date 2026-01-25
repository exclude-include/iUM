-- ============================================
-- iUM Reels Database Schema
-- Run this script in Supabase SQL Editor
-- ============================================

-- 1. Create reels table
CREATE TABLE IF NOT EXISTS public.reels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    folder_id TEXT, -- Optional: link to knowledge folder
    folder_name TEXT, -- Optional: folder name for display
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- Policy: Anyone can read reels (public feed)
CREATE POLICY "Anyone can view reels"
    ON public.reels
    FOR SELECT
    USING (true);

-- Policy: Authenticated users can insert their own reels
CREATE POLICY "Users can insert their own reels"
    ON public.reels
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own reels
CREATE POLICY "Users can update their own reels"
    ON public.reels
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own reels
CREATE POLICY "Users can delete their own reels"
    ON public.reels
    FOR DELETE
    USING (auth.uid() = user_id);

-- 4. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_reels_user_id ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON public.reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_folder_id ON public.reels(folder_id);

-- 5. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create trigger to auto-update updated_at
CREATE TRIGGER update_reels_updated_at
    BEFORE UPDATE ON public.reels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Storage Bucket Setup
-- ============================================

-- Note: Storage buckets must be created via Supabase Dashboard or API
-- Go to: Storage > Create Bucket
-- Name: reels
-- Public: true (so videos can be accessed via public URL)
-- File size limit: 52428800 (50MB in bytes)
-- Allowed MIME types: video/*

-- Alternatively, you can create it via SQL (if you have the right permissions):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('reels', 'reels', true, 52428800, ARRAY['video/mp4', 'video/webm', 'video/quicktime']);

-- Storage RLS Policies (run these after creating the bucket)

-- Policy: Anyone can view videos
-- CREATE POLICY "Anyone can view reels"
--     ON storage.objects
--     FOR SELECT
--     USING (bucket_id = 'reels');

-- Policy: Authenticated users can upload videos
-- CREATE POLICY "Users can upload reels"
--     ON storage.objects
--     FOR INSERT
--     WITH CHECK (bucket_id = 'reels' AND auth.role() = 'authenticated');

-- Policy: Users can delete their own videos
-- CREATE POLICY "Users can delete own reels"
--     ON storage.objects
--     FOR DELETE
--     USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

