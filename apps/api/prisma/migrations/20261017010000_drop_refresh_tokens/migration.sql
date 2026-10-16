-- Bearer JWT auth no longer issues refresh sessions.
-- Drop only refresh_tokens. users, orders, and revoked_access_tokens stay.

DROP TABLE "refresh_tokens";
