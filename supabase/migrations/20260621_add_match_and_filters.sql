-- Migration: Add match evaluation and filter storage columns to job search tables

-- Store the user's selected search filters in the run
ALTER TABLE public.job_search_runs 
ADD COLUMN IF NOT EXISTS filters jsonb;

-- Store Gemini's match evaluation details for each job result
ALTER TABLE public.job_search_jobs 
ADD COLUMN IF NOT EXISTS match_score integer,
ADD COLUMN IF NOT EXISTS match_reason text;
