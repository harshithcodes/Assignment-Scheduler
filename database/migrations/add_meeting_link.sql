-- Add meeting_link column to slots table
-- Run this in your Supabase SQL Editor

-- Add the meeting_link column
ALTER TABLE slots 
ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Create index for meeting_link queries
CREATE INDEX IF NOT EXISTS idx_slots_meeting_link ON slots(meeting_link) WHERE meeting_link IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN slots.meeting_link IS 'Google Meet link for the scheduled session';

