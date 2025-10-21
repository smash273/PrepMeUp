-- Create user_test_attempts table to store test submissions
CREATE TABLE IF NOT EXISTS public.user_test_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mock_paper_id UUID NOT NULL REFERENCES public.mock_papers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_taken INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_test_attempts ENABLE ROW LEVEL SECURITY;

-- Create policies for user_test_attempts
CREATE POLICY "Users can view their own test attempts" 
ON public.user_test_attempts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own test attempts" 
ON public.user_test_attempts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_test_attempts_updated_at
BEFORE UPDATE ON public.user_test_attempts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for better query performance
CREATE INDEX idx_user_test_attempts_user_id ON public.user_test_attempts(user_id);
CREATE INDEX idx_user_test_attempts_mock_paper_id ON public.user_test_attempts(mock_paper_id);