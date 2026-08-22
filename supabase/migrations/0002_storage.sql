-- Private storage bucket for candidate documents (ID, NYSC certificate, photo).
-- Files are never public; access is via short-lived signed URLs generated server-side.

insert into storage.buckets (id, name, public)
values ('candidate-documents', 'candidate-documents', false)
on conflict (id) do nothing;

-- Object paths are namespaced as: {candidate_id}/{doc_type}-{filename}
-- so policies can check ownership from the path itself.

create policy "admin full access to candidate documents"
  on storage.objects for all
  using (bucket_id = 'candidate-documents' and is_admin(auth.uid()))
  with check (bucket_id = 'candidate-documents' and is_admin(auth.uid()));

create policy "candidate can manage own documents"
  on storage.objects for all
  using (
    bucket_id = 'candidate-documents'
    and exists (
      select 1 from candidates c
      where c.auth_user_id = auth.uid()
        and (storage.foldername(name))[1] = c.id::text
    )
  )
  with check (
    bucket_id = 'candidate-documents'
    and exists (
      select 1 from candidates c
      where c.auth_user_id = auth.uid()
        and (storage.foldername(name))[1] = c.id::text
    )
  );
