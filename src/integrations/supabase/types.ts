export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      courses: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          created_at: string | null
          detailed_analytics: Json | null
          id: string
          improvement_suggestions: string | null
          max_score: number | null
          submission_id: string
          total_score: number | null
          user_id: string
          weak_areas: string[] | null
        }
        Insert: {
          created_at?: string | null
          detailed_analytics?: Json | null
          id?: string
          improvement_suggestions?: string | null
          max_score?: number | null
          submission_id: string
          total_score?: number | null
          user_id: string
          weak_areas?: string[] | null
        }
        Update: {
          created_at?: string | null
          detailed_analytics?: Json | null
          id?: string
          improvement_suggestions?: string | null
          max_score?: number | null
          submission_id?: string
          total_score?: number | null
          user_id?: string
          weak_areas?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "post_exam_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_content: {
        Row: {
          content: Json
          content_type: string
          course_id: string
          created_at: string | null
          id: string
          module_name: string
          user_id: string
        }
        Insert: {
          content: Json
          content_type: string
          course_id: string
          created_at?: string | null
          id?: string
          module_name: string
          user_id: string
        }
        Update: {
          content?: Json
          content_type?: string
          course_id?: string
          created_at?: string | null
          id?: string
          module_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_content_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_papers: {
        Row: {
          course_id: string
          created_at: string | null
          duration_minutes: number
          id: string
          question_type: Database["public"]["Enums"]["question_type"]
          title: string
          total_marks: number
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          duration_minutes?: number
          id?: string
          question_type: Database["public"]["Enums"]["question_type"]
          title: string
          total_marks?: number
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          duration_minutes?: number
          id?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          title?: string
          total_marks?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_papers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      post_exam_submissions: {
        Row: {
          answer_key_path: string | null
          answer_sheet_path: string
          course_id: string
          created_at: string | null
          id: string
          ocr_text: string | null
          processing_status: string | null
          user_id: string
        }
        Insert: {
          answer_key_path?: string | null
          answer_sheet_path: string
          course_id: string
          created_at?: string | null
          id?: string
          ocr_text?: string | null
          processing_status?: string | null
          user_id: string
        }
        Update: {
          answer_key_path?: string | null
          answer_sheet_path?: string
          course_id?: string
          created_at?: string | null
          id?: string
          ocr_text?: string | null
          processing_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_exam_submissions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          concept_tags: string[] | null
          correct_answer: string | null
          created_at: string | null
          id: string
          marks: number
          mock_paper_id: string
          options: Json | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          concept_tags?: string[] | null
          correct_answer?: string | null
          created_at?: string | null
          id?: string
          marks?: number
          mock_paper_id: string
          options?: Json | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          concept_tags?: string[] | null
          correct_answer?: string | null
          created_at?: string | null
          id?: string
          marks?: number
          mock_paper_id?: string
          options?: Json | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "questions_mock_paper_id_fkey"
            columns: ["mock_paper_id"]
            isOneToOne: false
            referencedRelation: "mock_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_materials: {
        Row: {
          course_id: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          processing_status: string | null
          resource_type: Database["public"]["Enums"]["resource_type"]
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          processing_status?: string | null
          resource_type: Database["public"]["Enums"]["resource_type"]
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          processing_status?: string | null
          resource_type?: Database["public"]["Enums"]["resource_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      test_answers: {
        Row: {
          answer_text: string | null
          created_at: string | null
          feedback: string | null
          id: string
          is_correct: boolean | null
          marks_obtained: number | null
          question_id: string
          selected_option: number | null
          test_attempt_id: string
        }
        Insert: {
          answer_text?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          marks_obtained?: number | null
          question_id: string
          selected_option?: number | null
          test_attempt_id: string
        }
        Update: {
          answer_text?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          marks_obtained?: number | null
          question_id?: string
          selected_option?: number | null
          test_attempt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_answers_test_attempt_id_fkey"
            columns: ["test_attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      test_attempts: {
        Row: {
          created_at: string | null
          end_time: string | null
          id: string
          mock_paper_id: string
          score: number | null
          start_time: string | null
          status: Database["public"]["Enums"]["test_status"] | null
          total_marks: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          mock_paper_id: string
          score?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["test_status"] | null
          total_marks?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          mock_paper_id?: string
          score?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["test_status"] | null
          total_marks?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_mock_paper_id_fkey"
            columns: ["mock_paper_id"]
            isOneToOne: false
            referencedRelation: "mock_papers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      question_type: "mcq" | "long_answer"
      resource_type: "syllabus" | "textbook" | "pyq" | "notes"
      test_status: "not_started" | "in_progress" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      question_type: ["mcq", "long_answer"],
      resource_type: ["syllabus", "textbook", "pyq", "notes"],
      test_status: ["not_started", "in_progress", "completed"],
    },
  },
} as const
