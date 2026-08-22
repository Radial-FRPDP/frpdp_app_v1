-- The Figma-exported M-02 design collects a degree certificate alongside
-- the NIN slip and NYSC certificate, which 0001's doc_type enum didn't
-- have room for.
alter table documents drop constraint if exists documents_doc_type_check;
alter table documents add constraint documents_doc_type_check
  check (doc_type in ('id_card', 'nysc_certificate', 'degree_certificate', 'photo', 'other'));
