import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TestResults() {
  const { paperId } = useParams();
  const [attempt, setAttempt] = useState<any>(null);
  const [paper, setPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchResults();
  }, [paperId]);

  const fetchResults = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: attemptData, error: attemptError } = await supabase
      .from("user_test_attempts")
      .select("*")
      .eq("mock_paper_id", paperId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (attemptError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No test attempt found",
      });
      navigate("/courses");
      return;
    }

    const { data: paperData } = await supabase
      .from("mock_papers")
      .select("*")
      .eq("id", paperId)
      .single();

    const { data: questionsData } = await supabase
      .from("questions")
      .select("*")
      .eq("mock_paper_id", paperId);

    setAttempt(attemptData);
    setPaper(paperData);
    setQuestions(questionsData || []);
    setLoading(false);
  };

  const calculateScore = () => {
    if (!attempt || !questions) return { score: 0, total: 0, percentage: 0 };

    let score = 0;
    const total = paper?.total_marks || 0;
    const userAnswers = attempt.answers || [];

    questions.forEach((question) => {
      const userAnswer = userAnswers.find((a: any) => a.question_id === question.id);
      if (!userAnswer) return;

      if (paper?.question_type === "mcq") {
        const correctOption = question.options?.find((o: any) => o.is_correct);
        if (correctOption?.text === userAnswer.user_answer) {
          score += question.marks;
        }
      }
    });

    return { score, total, percentage: (score / total) * 100 };
  };

  const { score, total, percentage } = calculateScore();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-950/20 to-background">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/courses")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Card className="p-8 mb-6">
          <h1 className="text-3xl font-bold mb-6 text-center">{paper?.title} - Results</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Your Score</p>
              <p className="text-4xl font-bold text-primary">{score}/{total}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Percentage</p>
              <p className="text-4xl font-bold">{percentage.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Time Taken</p>
              <p className="text-4xl font-bold">
                {Math.floor((attempt?.time_taken || 0) / 60)} min
              </p>
            </div>
          </div>

          <Progress value={percentage} className="h-3" />
        </Card>

        {paper?.question_type === "mcq" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Answer Review</h2>
            {questions.map((question, index) => {
              const userAnswer = attempt.answers?.find((a: any) => a.question_id === question.id);
              const correctOption = question.options?.find((o: any) => o.is_correct);
              const isCorrect = correctOption?.text === userAnswer?.user_answer;

              return (
                <Card key={question.id} className="p-6">
                  <div className="flex items-start gap-4">
                    {isCorrect ? (
                      <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                    ) : (
                      <XCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold mb-4">
                        Q{index + 1}. {question.question_text}
                      </h3>
                      
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Your Answer:</p>
                          <p className={isCorrect ? "text-green-600" : "text-destructive"}>
                            {userAnswer?.user_answer || "Not answered"}
                          </p>
                        </div>
                        {!isCorrect && (
                          <div>
                            <p className="text-sm text-muted-foreground">Correct Answer:</p>
                            <p className="text-green-600">{correctOption?.text}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant={isCorrect ? "default" : "destructive"}>
                      {isCorrect ? `+${question.marks}` : "0"} marks
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
