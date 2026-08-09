-- Server-side session inventory is an API concern. The media worker must not
-- inherit the broad runtime role's global session-table privileges.
revoke all privileges on table auth_sessions from family_historian_runtime;
revoke all privileges on table auth_sessions from family_historian_worker;
