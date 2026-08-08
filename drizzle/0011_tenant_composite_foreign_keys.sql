create unique index family_archives_id_organization_idx
  on family_archives(id, organization_id);

do $$
declare
  table_name text;
  constraint_name text;
begin
  foreach table_name in array array[
    'api_idempotency_keys','artifacts','audiobook_exports','audit_events','book_exports',
    'candidate_facts','chapter_revisions','chapters','confirmed_facts','consent_records',
    'contributor_releases','deletion_jobs','derivative_objects',
    'disputed_claims','editions','embargoes','epub_exports','evidence_links','export_jobs',
    'fact_evidence','fixity_records','interview_plans','job_outbox','life_events',
    'media_assets','memberships','narration_jobs','original_objects',
    'people','permission_grants','person_relationships','places','portal_shares',
    'privacy_requests','provenance_events','provider_callback_events','publication_approvals',
    'quotations','recipes','recording_sessions','rights_claims','roles','speakers',
    'story_prompts','themes','timeline_entries','transcript_revisions','transcript_spans',
    'transcripts','upload_sessions','usage_ledger','voice_authorizations','workflow_runs'
  ] loop
    constraint_name := table_name || '_tenant_fk';
    execute format(
      'alter table %I add constraint %I foreign key (family_archive_id, organization_id) references family_archives(id, organization_id) not valid',
      table_name,
      constraint_name
    );
    execute format('alter table %I validate constraint %I', table_name, constraint_name);
  end loop;
end $$;
