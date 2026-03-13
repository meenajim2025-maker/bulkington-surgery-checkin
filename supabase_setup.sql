-- SQL for creating the checkins table in Supabase
-- Run this in the Supabase SQL Editor

create table if not exists checkins (
  id bigint primary key generated always as identity,
  timestamp text not null,
  name text not null,
  dob text not null,
  purpose text,
  status text default 'Waiting',
  latitude float8,
  longitude float8
);

-- Enable Realtime
alter publication supabase_realtime add table checkins;
