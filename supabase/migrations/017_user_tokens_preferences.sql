-- Migration 017: Add preferences JSONB column to user_tokens for Beatport genre preferences
ALTER TABLE user_tokens
  ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT NULL;
