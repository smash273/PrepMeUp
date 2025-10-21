import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ViewTest() {
  const { paperId } = useParams();
  const [paper, setPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchTestData();
  }, [paperId]);

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
    setLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-950/20 to-background">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">{paper?.title}</h1>
              <p className="text-sm text-muted-foreground">Preview Mode</p>
            </div>
          </div>
          <Button onClick={() => navigate(`/test/${paperId}`)}>
            Take Test
          </Button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Marks</p>
              <p className="text-2xl font-bold">{paper?.total_marks}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-2xl font-bold">{paper?.duration_minutes} min</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Questions</p>
              <p className="text-2xl font-bold">{questions.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge variant="secondary">
                {paper?.question_type === "mcq" ? "MCQ" : "Long Answer"}
              </Badge>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          {questions.map((question, index) => (
            <Card key={question.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold flex-1">
                  Q{index + 1}. {question.question_text}
                </h3>
                <Badge variant="outline">{question.marks} marks</Badge>
              </div>

              {paper?.question_type === "mcq" && question.options ? (
                <div className="space-y-2 mt-4">
                  {question.options.map((option: any, optIdx: number) => (
                    <div
                      key={optIdx}
                      className={`p-3 rounded-lg border ${
                        option.is_correct
                          ? "bg-green-50 dark:bg-green-950/20 border-green-500"
                          : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{option.text}</span>
                        {option.is_correct && (
                          <Badge variant="default" className="bg-green-600">
                            Correct Answer
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Expected Answer:</p>
                  <p className="whitespace-pre-wrap">{question.correct_answer}</p>
                </div>
              )}

              {question.concept_tags && question.concept_tags.length > 0 && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  {question.concept_tags.map((tag: string, idx: number) => (
                    <Badge key={idx} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
