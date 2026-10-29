export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---- Structures JSON stockées en base -------------------------------------
export type OutlineSection = { title: string; points: string[] };
export type KeyPoint = { title: string; detail: string };
export type QuizQuestion = { question: string; options: string[]; answer_index: number; explanation: string };

export type CourseStatus = "uploaded" | "processing" | "ready" | "error";
export type SummaryLength = "short" | "medium" | "long";
export type QuizDifficulty = "easy" | "medium" | "hard";
export type AudioSource = "course" | "summary" | "outline" | "keypoints" | "podcast";
export type VoiceKind = "default" | "custom";
export type ChatRole = "user" | "assistant";
export type ShareResourceType = "summary" | "quiz" | "audio" | "chat" | "course";
export type UserRole = "student" | "admin";
export type NarrationLanguage = "fr" | "en" | "wo";

// ---- Lignes ---------------------------------------------------------------
export type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  voice_id: string | null;
  voice_name: string | null;
  role: UserRole;
  onboarded_at: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type FlashcardRow = { id: string; course_id: string; user_id: string; front: string; back: string; ease: number; interval_days: number; repetitions: number; lapses: number; due_at: string; last_reviewed_at: string | null; created_at: string };
export type FlashcardReviewRow = { id: string; flashcard_id: string; user_id: string; grade: number; reviewed_at: string };
export type ExamQuestion = QuizQuestion & { course_id: string; course_title: string };
export type ExamRow = { id: string; user_id: string; title: string; course_ids: string[]; questions: ExamQuestion[]; duration_minutes: number; created_at: string };
export type ExamAttemptRow = { id: string; exam_id: string; user_id: string; answers: (number | null)[]; score: number; total: number; time_spent_seconds: number; created_at: string };
export type GroupRow = { id: string; owner_id: string; name: string; code: string; created_at: string };
export type GroupMemberRow = { group_id: string; user_id: string; role: "owner" | "member"; joined_at: string };
export type UsageEventRow = { id: string; user_id: string; kind: string; units: number; meta: Json | null; created_at: string };
export type SearchResult = { id: string; title: string; domain: string; subject: string; status: CourseStatus; rank: number; headline: string };
export type GroupMemberInfo = { user_id: string; name: string; role: "owner" | "member"; joined_at: string };
export type GroupLeaderboardRow = { user_id: string; name: string; attempts: number; avg_percent: number | null; best_percent: number | null };
export type GroupShareInfo = { share_id: string; token: string; resource_type: ShareResourceType; title: string; owner_name: string; created_at: string };
export type AdminOverview = { users: number; users_7d: number; courses: number; summaries: number; quizzes: number; audios: number; chats: number; groups: number; usage: Record<string, number>; usage_30d: Record<string, number> };
export type AdminUser = { id: string; email: string; name: string; phone: string | null; role: UserRole; created_at: string; last_sign_in_at: string | null; courses: number; audios: number; tts_chars: number; ai_chars: number };
export type StudentMatch = { id: string; name: string; email: string; phone: string | null };

export type VoiceRow = {
  id: string;
  user_id: string;
  name: string;
  provider_voice_id: string;
  sample_path: string | null;
  created_at: string;
};

export type CourseRow = {
  id: string;
  user_id: string;
  title: string;
  domain: string;
  subject: string;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  status: CourseStatus;
  error_message: string | null;
  content_text: string | null;
  overview: string | null;
  outline: OutlineSection[] | null;
  key_points: KeyPoint[] | null;
  keywords: string[] | null;
  word_count: number | null;
  copied_from: string | null;
  created_at: string;
  updated_at: string;
};

export type SummaryRow = {
  id: string;
  course_id: string;
  user_id: string;
  length: SummaryLength;
  title: string;
  content: string;
  created_at: string;
};

export type QuizRow = {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  difficulty: QuizDifficulty;
  questions: QuizQuestion[];
  created_at: string;
};

export type QuizAttemptRow = {
  id: string;
  quiz_id: string;
  user_id: string | null;
  guest_name: string | null;
  answers: (number | null)[];
  score: number;
  total: number;
  via_share: boolean;
  created_at: string;
};

export type AudioReadingRow = {
  id: string;
  course_id: string;
  user_id: string;
  summary_id: string | null;
  source: AudioSource;
  voice_kind: VoiceKind;
  voice_label: string | null;
  title: string;
  file_path: string;
  duration_seconds: number | null;
  char_count: number | null;
  created_at: string;
};

export type ChatRow = {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  copied_from: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessageRow = {
  id: string;
  chat_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
};

export type ShareRow = {
  id: string;
  user_id: string;
  resource_type: ShareResourceType;
  resource_id: string;
  token: string;
  title: string;
  recipient_email: string | null;
  group_id: string | null;
  view_count: number;
  expires_at: string | null;
  created_at: string;
};

export type ShareRecipientRow = {
  share_id: string;
  user_id: string;
  saved_at: string;
};

export type ReceivedShare = {
  share_id: string;
  token: string;
  resource_type: ShareResourceType;
  title: string;
  owner_name: string;
  created_at: string;
  saved_at: string | null;
};

// ---- Résultats des fonctions publiques -------------------------------------
export type SharedCourseInfo = { title: string; domain: string; subject: string };

export type SharePayload = {
  share: {
    id: string;
    token: string;
    type: ShareResourceType;
    title: string;
    created_at: string;
    owner_name: string;
    group_id?: string | null;
  };
  resource:
    | ({ id: string; title: string; content: string; length: SummaryLength; created_at: string; course: SharedCourseInfo })
    | ({ id: string; title: string; difficulty: QuizDifficulty; created_at: string; course: SharedCourseInfo; questions: { question: string; options: string[] }[] })
    | ({ id: string; title: string; file_path: string; duration_seconds: number | null; voice_label: string | null; source: AudioSource; created_at: string; course: SharedCourseInfo })
    | ({ id: string; title: string; created_at: string; course: SharedCourseInfo; messages: { role: ChatRole; content: string; created_at: string }[] })
    | ({ id: string; title: string; overview: string | null; outline: OutlineSection[]; key_points: KeyPoint[]; keywords: string[]; word_count: number | null; created_at: string; course: SharedCourseInfo });
};

export type GradeResult = {
  score: number;
  total: number;
  results: { index: number; selected: number | null; answer_index: number; correct: boolean; explanation: string }[];
};

// ---- Type Database pour supabase-js ----------------------------------------
type Insert<R, Optional extends keyof R> = Omit<R, Optional> & Partial<Pick<R, Optional>>;

type Table<R, Optional extends keyof R> = {
  Row: R;
  Insert: Insert<R, Optional>;
  Update: Partial<R>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "full_name" | "avatar_url" | "voice_id" | "voice_name" | "role" | "onboarded_at" | "phone" | "created_at" | "updated_at">;
      flashcards: Table<FlashcardRow, "id" | "ease" | "interval_days" | "repetitions" | "lapses" | "due_at" | "last_reviewed_at" | "created_at">;
      flashcard_reviews: Table<FlashcardReviewRow, "id" | "reviewed_at">;
      exams: Table<ExamRow, "id" | "duration_minutes" | "created_at">;
      exam_attempts: Table<ExamAttemptRow, "id" | "time_spent_seconds" | "created_at">;
      groups: Table<GroupRow, "id" | "code" | "created_at">;
      group_members: Table<GroupMemberRow, "role" | "joined_at">;
      usage_events: Table<UsageEventRow, "id" | "units" | "meta" | "created_at">;
      voices: Table<VoiceRow, "id" | "sample_path" | "created_at">;
      courses: Table<
        CourseRow,
        | "id" | "file_path" | "file_name" | "file_type" | "file_size" | "status" | "error_message" | "content_text"
        | "overview" | "outline" | "key_points" | "keywords" | "word_count" | "copied_from" | "created_at" | "updated_at"
      >;
      summaries: Table<SummaryRow, "id" | "length" | "created_at">;
      quizzes: Table<QuizRow, "id" | "difficulty" | "created_at">;
      quiz_attempts: Table<QuizAttemptRow, "id" | "user_id" | "guest_name" | "via_share" | "created_at">;
      audio_readings: Table<AudioReadingRow, "id" | "summary_id" | "voice_kind" | "voice_label" | "duration_seconds" | "char_count" | "created_at">;
      chats: Table<ChatRow, "id" | "title" | "copied_from" | "created_at" | "updated_at">;
      chat_messages: Table<ChatMessageRow, "id" | "created_at">;
      shares: Table<ShareRow, "id" | "token" | "recipient_email" | "group_id" | "view_count" | "expires_at" | "created_at">;
      share_recipients: Table<ShareRecipientRow, "saved_at">;
    };
    Views: Record<string, never>;
    Functions: {
      get_share: { Args: { p_token: string }; Returns: Json };
      grade_shared_quiz: { Args: { p_token: string; p_answers: Json; p_guest_name?: string | null }; Returns: Json };
      save_share: { Args: { p_token: string }; Returns: undefined };
      list_received_shares: { Args: Record<string, never>; Returns: ReceivedShare[] };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_group_member: { Args: { p_group: string }; Returns: boolean };
      join_group: { Args: { p_code: string }; Returns: string };
      group_members_list: { Args: { p_group: string }; Returns: GroupMemberInfo[] };
      group_leaderboard: { Args: { p_group: string }; Returns: GroupLeaderboardRow[] };
      group_shares_list: { Args: { p_group: string }; Returns: GroupShareInfo[] };
      copy_shared_course: { Args: { p_token: string }; Returns: string };
      search_courses: { Args: { p_query: string; p_limit?: number }; Returns: SearchResult[] };
      admin_overview: { Args: Record<string, never>; Returns: Json };
      admin_users: { Args: { p_query?: string | null; p_limit?: number }; Returns: AdminUser[] };
      admin_set_role: { Args: { p_user: string; p_role: string }; Returns: undefined };
      search_students: { Args: { p_query: string; p_limit?: number }; Returns: StudentMatch[] };
      continue_shared_chat: { Args: { p_token: string }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
