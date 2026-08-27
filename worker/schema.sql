CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

-- Signups are throttled per IP. The address itself is never stored, only a
-- salted hash, and rows are pruned once they fall outside the window.
CREATE TABLE IF NOT EXISTS signup_attempts (
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS signup_attempts_lookup
  ON signup_attempts (ip_hash, created_at);
