-- SQL for creating the checkins table in Supabase
-- Run this in the Supabase SQL Editor

create table if not exists checkins (
  id bigint primary key generated always as identity,
  timestamp text not null,
  name text not null,
  dob text, -- DOB might be optional for contractors
  phone_number text, -- NEW: for safety registries
  org_type text default 'Patient', -- NEW: Patient, Staff, Contractor, Maintenance
  purpose text,
  status text default 'Waiting',
  latitude float8,
  longitude float8
);

-- Global emergencies table for building-wide alerts
create table if not exists emergencies (
  id bigint primary key generated always as identity,
  timestamp text not null,
  type text default 'General', -- Fire, Security, Medical, Weather
  message text,
  is_active boolean default true,
  created_by text
);

-- Enable Realtime for emergencies
alter publication supabase_realtime add table emergencies;
