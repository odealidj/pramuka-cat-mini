CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_approvals_user_event ON user_event_approvals(user_id, event_id);
