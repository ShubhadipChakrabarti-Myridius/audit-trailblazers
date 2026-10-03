/*
# Add settings table for LLM configuration

## Overview
Stores LLM model and base URL preferences, plus a flag indicating whether
the API key has been configured as an edge function secret.

## New Tables
1. **settings** — Singleton row (id = 'global') holding LLM config.
   - `id` (text PK, always 'global')
   - `llm_model` (text) — model name like "gpt-4o"
   - `llm_base_url` (text) — API base URL
   - `api_key_configured` (boolean) — whether the user has entered a key
   - `created_at`, `updated_at` (timestamps)

## Security
- RLS enabled, anon+authenticated CRUD (single-tenant, no auth).
*/

CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY DEFAULT 'global',
  llm_model text NOT NULL DEFAULT 'gpt-4o',
  llm_base_url text NOT NULL DEFAULT 'https://api.openai.com/v1',
  api_key_configured boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE TO anon, authenticated USING (true);
