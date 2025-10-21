import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TakeTest() {
  const { paperId } = useParams();
  const [paper, setPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchTestData();
  }, [paperId]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && paper) {
      handleSubmit();
    }
  }, [timeLeft]);

  const fetchTestData = async () => {
    const { data: paperData, error: paperError } = await supabase
      .from("mock_papers")
      .select("*")
      .eq("id", paperId)
      .single();

    if (paperError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load test",
      });
      navigate("/courses");
      return;
    }

    const { data: questionsData, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("mock_paper_id", paperId);

    if (questionsError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load questions",
      });
      return;
    }

    setPaper(paperData);
    setQuestions(questionsData || []);
    setTimeLeft(paperData.duration_minutes * 60);
    setLoading(false);
  };

  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userAnswers = questions.map((q) => ({
      question_id: q.id,
      user_answer: answers[q.id] || "",
    }));

    const { error } = await supabase.from("user_test_attempts").insert({
      mock_paper_id: paperId,
      user_id: user.id,
      answers: userAnswers,
      time_taken: paper.duration_minutes * 60 - timeLeft,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit test",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Test submitted successfully!",
    });
    navigate(`/test/${paperId}/results`);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-950/20 to-background">
      <nav className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-primary">{paper?.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5" />
            <span className={timeLeft < 300 ? "text-destructive" : ""}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Card className="p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Marks: {paper?.total_marks}</p>
              <p className="text-sm text-muted-foreground">
                Type: {paper?.question_type === "mcq" ? "Multiple Choice" : "Long Answer"}
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          {questions.map((question, index) => (
            <Card key={question.id} className="p-6">
              <h3 className="font-semibold mb-4">
                Q{index + 1}. {question.question_text} ({question.marks} marks)
              </h3>

              {paper?.question_type === "mcq" && question.options ? (
                <RadioGroup
                  value={answers[question.id]}
                  onValueChange={(value) =>
                    setAnswers({ ...answers, [question.id]: value })
                  }
                >
                  {question.options.map((option: any, optIdx: number) => (
                    <div key={optIdx} className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value={option.text} id={`${question.id}-${optIdx}`} />
                      <Label htmlFor={`${question.id}-${optIdx}`}>{option.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea
                  value={answers[question.id] || ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [question.id]: e.target.value })
                  }
                  placeholder="Type your answer here..."
                  rows={6}
                />
              )}
            </Card>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Button onClick={handleSubmit} size="lg">
            Submit Test
          </Button>
        </div>
      </main>
    </div>
  );
}
