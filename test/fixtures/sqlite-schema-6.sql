-- Schema des vorherigen Crew-Stands für synthetische Migrationstests.
PRAGMA user_version = 6;
PRAGMA foreign_keys = ON;

CREATE TABLE people (
      id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      secret TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('staff','admin')),
      status TEXT NOT NULL CHECK(status IN ('pending','active','rejected')),
      availability TEXT NOT NULL DEFAULT '', review_note TEXT NOT NULL DEFAULT ''
    , access_suspended INTEGER NOT NULL DEFAULT 0 CHECK(access_suspended IN (0,1)), access_revision INTEGER NOT NULL DEFAULT 1);

CREATE TABLE sessions (
      token TEXT PRIMARY KEY, person INTEGER NOT NULL REFERENCES people(id),
      expires INTEGER NOT NULL
    );

CREATE TABLE qualifications (
      id INTEGER PRIMARY KEY, person INTEGER NOT NULL REFERENCES people(id),
      name TEXT NOT NULL, valid_until TEXT NOT NULL DEFAULT '', verified INTEGER NOT NULL DEFAULT 0,
      evidence BLOB, revision INTEGER NOT NULL DEFAULT 1, UNIQUE(person, name)
    );

CREATE TABLE events (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, location TEXT NOT NULL,
      reference TEXT NOT NULL DEFAULT '', instructions TEXT NOT NULL DEFAULT ''
    , revision INTEGER NOT NULL DEFAULT 1);

CREATE TABLE shifts (
      id INTEGER PRIMARY KEY, event INTEGER NOT NULL REFERENCES events(id),
      title TEXT NOT NULL, starts TEXT NOT NULL, ends TEXT NOT NULL,
      slots INTEGER NOT NULL CHECK(slots > 0), cents INTEGER NOT NULL CHECK(cents >= 0),
      requirements TEXT NOT NULL, questions TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK(visibility IN ('draft','pool','invite')), cancelled_at TEXT, locked_location TEXT, locked_instructions TEXT, placement_revision INTEGER NOT NULL DEFAULT 1, anonymous_assigned INTEGER NOT NULL DEFAULT 0 CHECK(anonymous_assigned >= 0),
      CHECK(starts < ends)
    );

CREATE TABLE invitations (
      shift INTEGER NOT NULL REFERENCES shifts(id), person INTEGER NOT NULL REFERENCES people(id),
      PRIMARY KEY(shift, person)
    );

CREATE TABLE responses (
      shift INTEGER NOT NULL REFERENCES shifts(id), person INTEGER NOT NULL REFERENCES people(id),
      status TEXT NOT NULL CHECK(status IN ('interested','assigned','withdrawn')),
      answers TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, released_by_dispo INTEGER NOT NULL DEFAULT 0 CHECK(released_by_dispo IN (0,1)), PRIMARY KEY(shift, person)
    );

CREATE TABLE qualification_requests (
        person INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        note TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('open','submitted','done')),
        PRIMARY KEY(person,name)
      );

CREATE TABLE erased_ids (kind TEXT PRIMARY KEY, greatest INTEGER NOT NULL);

INSERT INTO erased_ids VALUES ('people',0),('qualifications',0);
