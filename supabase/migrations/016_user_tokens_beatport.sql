-- Migration 016: Allow beatport tokens in user_tokens
ALTER TABLE user_tokens
  DROP CONSTRAINT IF EXISTS user_tokens_service_check;

ALTER TABLE user_tokens
  ADD CONSTRAINT user_tokens_service_check
  CHECK (service IN ('spotify', 'tidal', 'beatport'));
