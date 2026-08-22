/**
 * Hand-written to match supabase/migrations/0001_init.sql through
 * 0004_multi_role.sql.
 *
 * Once the project is linked to a live Supabase instance, regenerate this
 * from the real schema and replace this file wholesale:
 *
 *   npx supabase gen types typescript --linked > src/lib/database.types.ts
 */

export type CandidateStatus =
  | "pending_review"
  | "invited"
  | "profile_in_progress"
  | "profile_complete"
  | "verified"
  | "rejected";

export type NinVerificationStatus = "not_submitted" | "pending" | "verified" | "failed";
export type BvnVerificationStatus = "not_submitted" | "pending" | "verified" | "failed";
export type NyscReviewStatus = "pending" | "verified" | "issue";
export type DocType = "id_card" | "nysc_certificate" | "degree_certificate" | "photo" | "other";
export type BookingStatus = "confirmed" | "cancelled";
export type NotificationType =
  | "invite"
  | "validation_report"
  | "cbt_confirmation"
  | "cbt_reminder"
  | "nysc_flagged";

export type StaffOrg = "radial" | "ncdmb" | "renaissance" | "cbt";
export type GeoZone =
  | "South-South"
  | "South-East"
  | "South-West"
  | "North-Central"
  | "North-West"
  | "North-East";
export type CentreStatus = "active" | "unavailable";
export type DuplicateDecision = "pending" | "replace" | "discard";
export type ExamSessionStatus = "checked_in" | "in_progress" | "submitted" | "expired";
export type BookingExceptionType = "centre_change" | "missed_window" | "duplicate_booking";
export type BookingExceptionStatus = "pending" | "approved" | "rejected";
export type ExamIncidentCategory = "device_failure" | "identity_mismatch" | "late_arrival" | "other";
export type ExamIncidentSeverity = "low" | "medium" | "high";
export type ExamIncidentStatus = "pending" | "reviewed" | "closed";
export interface ExamChoice {
  id: string;
  text: string;
}
export interface SubjectScore {
  subject: string;
  score: number;
  maxScore: number;
}

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      staff_profiles: {
        Row: {
          id: string;
          full_name: string;
          title: string | null;
          org: StaffOrg;
          cbt_centre_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["staff_profiles"]["Row"]> & {
          id: string;
          full_name: string;
          org: StaffOrg;
        };
        Update: Partial<Database["public"]["Tables"]["staff_profiles"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "staff_profiles_cbt_centre_id_fkey";
            columns: ["cbt_centre_id"];
            isOneToOne: false;
            referencedRelation: "cbt_centres";
            referencedColumns: ["id"];
          },
        ];
      };
      cbt_centres: {
        Row: {
          id: string;
          name: string;
          state: string;
          zone: GeoZone;
          capacity: number;
          status: CentreStatus;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cbt_centres"]["Row"]> & {
          name: string;
          state: string;
          zone: GeoZone;
        };
        Update: Partial<Database["public"]["Tables"]["cbt_centres"]["Row"]>;
        Relationships: [];
      };
      batches: {
        Row: {
          id: string;
          uploaded_by: string | null;
          filename: string;
          total_rows: number;
          valid_rows: number;
          issue_rows: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["batches"]["Row"]> & {
          filename: string;
        };
        Update: Partial<Database["public"]["Tables"]["batches"]["Row"]>;
        Relationships: [];
      };
      candidates: {
        Row: {
          id: string;
          batch_id: string | null;
          full_name: string;
          email: string;
          phone: string | null;
          source_row: Record<string, unknown> | null;
          duplicate_of: string | null;
          validation_issues: string[];
          status: CandidateStatus;
          invite_token: string;
          auth_user_id: string | null;
          jqs_number: string | null;
          duplicate_decision: DuplicateDecision | null;
          duplicate_decision_by: string | null;
          duplicate_decision_at: string | null;
          gender: string | null;
          discipline: string | null;
          date_of_birth: string | null;
          state_of_origin: string | null;
          zone: GeoZone | null;
          nomination_confirmed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["candidates"]["Row"]> & {
          full_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["candidates"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          candidate_id: string;
          date_of_birth: string | null;
          address: string | null;
          nin: string | null;
          nin_verification_status: NinVerificationStatus;
          nin_verification_payload: Record<string, unknown> | null;
          nin_reviewed_by: string | null;
          nin_reviewed_at: string | null;
          nin_review_note: string | null;
          nysc_cert_number: string | null;
          nysc_review_status: NyscReviewStatus;
          nysc_reviewed_by: string | null;
          nysc_reviewed_at: string | null;
          nysc_review_note: string | null;
          bvn: string | null;
          bvn_verification_status: BvnVerificationStatus;
          bvn_verification_reference: string | null;
          bvn_reviewed_by: string | null;
          bvn_reviewed_at: string | null;
          bvn_review_note: string | null;
          bank_account_name: string | null;
          bank_account_last4: string | null;
          bank_name: string | null;
          next_of_kin_name: string | null;
          next_of_kin_phone: string | null;
          next_of_kin_relationship: string | null;
          next_of_kin_address: string | null;
          lga_of_residence: string | null;
          state_of_residence: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          candidate_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          candidate_id: string;
          doc_type: DocType;
          storage_path: string;
          uploaded_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["documents"]["Row"]> & {
          candidate_id: string;
          doc_type: DocType;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Row"]>;
        Relationships: [];
      };
      cbt_slots: {
        Row: {
          id: string;
          starts_at: string;
          location: string | null;
          capacity: number;
          booked_count: number;
          cbt_centre_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cbt_slots"]["Row"]> & {
          starts_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["cbt_slots"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "cbt_slots_cbt_centre_id_fkey";
            columns: ["cbt_centre_id"];
            isOneToOne: false;
            referencedRelation: "cbt_centres";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          candidate_id: string;
          slot_id: string;
          status: BookingStatus;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bookings"]["Row"]> & {
          candidate_id: string;
          slot_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "bookings_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "cbt_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_questions: {
        Row: {
          id: string;
          subject: string;
          prompt: string;
          choices: ExamChoice[];
          correct_choice_id: string;
          points: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["exam_questions"]["Row"]> & {
          subject: string;
          prompt: string;
          choices: ExamChoice[];
          correct_choice_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["exam_questions"]["Row"]>;
        Relationships: [];
      };
      exam_sessions: {
        Row: {
          id: string;
          booking_id: string;
          candidate_id: string;
          cbt_centre_id: string;
          workstation_label: string | null;
          access_code: string;
          status: ExamSessionStatus;
          checked_in_by: string | null;
          checked_in_at: string;
          started_at: string | null;
          expires_at: string | null;
          submitted_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["exam_sessions"]["Row"]> & {
          booking_id: string;
          candidate_id: string;
          cbt_centre_id: string;
          access_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["exam_sessions"]["Row"]>;
        Relationships: [];
      };
      exam_answers: {
        Row: {
          id: string;
          session_id: string;
          question_id: string;
          selected_choice_id: string | null;
          is_correct: boolean | null;
          answered_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["exam_answers"]["Row"]> & {
          session_id: string;
          question_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["exam_answers"]["Row"]>;
        Relationships: [];
      };
      exam_results: {
        Row: {
          id: string;
          candidate_id: string;
          session_id: string | null;
          subject_scores: SubjectScore[];
          total_score: number;
          max_score: number;
          passed: boolean;
          entry_method: "auto" | "manual";
          submitted_by: string | null;
          submitted_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["exam_results"]["Row"]> & {
          candidate_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["exam_results"]["Row"]>;
        Relationships: [];
      };
      notifications_log: {
        Row: {
          id: string;
          candidate_id: string | null;
          type: NotificationType;
          recipient_email: string;
          status: "sent" | "failed";
          provider_message_id: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications_log"]["Row"]> & {
          type: NotificationType;
          recipient_email: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications_log"]["Row"]>;
        Relationships: [];
      };
      booking_exceptions: {
        Row: {
          id: string;
          candidate_id: string;
          booking_id: string | null;
          type: BookingExceptionType;
          requested_slot_id: string | null;
          reason: string | null;
          status: BookingExceptionStatus;
          requested_at: string;
          decided_by: string | null;
          decided_at: string | null;
          decision_note: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["booking_exceptions"]["Row"]> & {
          candidate_id: string;
          type: BookingExceptionType;
        };
        Update: Partial<Database["public"]["Tables"]["booking_exceptions"]["Row"]>;
        Relationships: [];
      };
      exam_incidents: {
        Row: {
          id: string;
          exam_session_id: string;
          reported_by: string | null;
          category: ExamIncidentCategory;
          severity: ExamIncidentSeverity;
          description: string | null;
          status: ExamIncidentStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          resolution_note: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["exam_incidents"]["Row"]> & {
          exam_session_id: string;
          category: ExamIncidentCategory;
        };
        Update: Partial<Database["public"]["Tables"]["exam_incidents"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      book_cbt_slot: {
        Args: {
          p_candidate_id: string;
          p_slot_id: string;
        };
        Returns: Database["public"]["Tables"]["bookings"]["Row"];
      };
      set_duplicate_decision: {
        Args: {
          p_candidate_id: string;
          p_decision: "replace" | "discard";
        };
        Returns: Database["public"]["Tables"]["candidates"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
