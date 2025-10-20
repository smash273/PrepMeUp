-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for resource types
CREATE TYPE public.resource_type AS ENUM ('syllabus', 'textbook', 'pyq', 'notes');

-- Create enum for question types
CREATE TYPE public.question_type AS ENUM ('mcq', 'long_answer');

-- Create enum for test status
CREATE TYPE public.test_status AS ENUM ('not_started', 'in_progress', 'completed');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own courses"
  ON public.courses FOR ALL
  USING (auth.uid() = user_id);

-- Create resource_materials table
CREATE TABLE public.resource_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type public.resource_type NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  processing_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.resource_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own resources"
  ON public.resource_materials FOR ALL
  USING (auth.uid() = user_id);

-- Create generated_content table (for PPTs, summaries, mindmaps)
CREATE TABLE public.generated_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'summary', 'mindmap', 'acronyms'
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own generated content"
  ON public.generated_content FOR ALL
  USING (auth.uid() = user_id);

-- Create mock_papers table
CREATE TABLE public.mock_papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  question_type public.question_type NOT NULL,
  total_marks INTEGER NOT NULL DEFAULT 100,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.mock_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own mock papers"
  ON public.mock_papers FOR ALL
  USING (auth.uid() = user_id);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mock_paper_id UUID NOT NULL REFERENCES public.mock_papers(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type public.question_type NOT NULL,
  marks INTEGER NOT NULL DEFAULT 1,
  options JSONB, -- for MCQs: [{text: string, is_correct: boolean}]
  correct_answer TEXT, -- for long answers
  concept_tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questions for their papers"
  ON public.questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mock_papers
      WHERE mock_papers.id = questions.mock_paper_id
      AND mock_papers.user_id = auth.uid()
    )
  );

-- Create test_attempts table
CREATE TABLE public.test_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mock_paper_id UUID NOT NULL REFERENCES public.mock_papers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.test_status DEFAULT 'not_started',
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  score INTEGER,
  total_marks INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own test attempts"
  ON public.test_attempts FOR ALL
  USING (auth.uid() = user_id);

-- Create test_answers table
CREATE TABLE public.test_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  selected_option INTEGER, -- for MCQs
  marks_obtained INTEGER,
  is_correct BOOLEAN,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.test_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own test answers"
  ON public.test_answers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.test_attempts
      WHERE test_attempts.id = test_answers.test_attempt_id
      AND test_attempts.user_id = auth.uid()
    )
  );

-- Create post_exam_submissions table
CREATE TABLE public.post_exam_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_sheet_path TEXT NOT NULL,
  answer_key_path TEXT,
  processing_status TEXT DEFAULT 'pending',
  ocr_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.post_exam_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own post exam submissions"
  ON public.post_exam_submissions FOR ALL
  USING (auth.uid() = user_id);

-- Create evaluations table
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES public.post_exam_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_score INTEGER,
  max_score INTEGER,
  weak_areas TEXT[],
  improvement_suggestions TEXT,
  detailed_analytics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evaluations"
  ON public.evaluations FOR SELECT
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create trigger for courses
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('syllabus', 'syllabus', false),
  ('textbooks', 'textbooks', false),
  ('pyqs', 'pyqs', false),
  ('answer-sheets', 'answer-sheets', false),
  ('answer-keys', 'answer-keys', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for syllabus
CREATE POLICY "Users can upload own syllabus"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'syllabus' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own syllabus"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'syllabus' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for textbooks
CREATE POLICY "Users can upload own textbooks"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'textbooks' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own textbooks"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'textbooks' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for pyqs
CREATE POLICY "Users can upload own pyqs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pyqs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own pyqs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pyqs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for answer-sheets
CREATE POLICY "Users can upload own answer-sheets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'answer-sheets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own answer-sheets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'answer-sheets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for answer-keys
CREATE POLICY "Users can upload own answer-keys"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'answer-keys' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own answer-keys"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'answer-keys' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );