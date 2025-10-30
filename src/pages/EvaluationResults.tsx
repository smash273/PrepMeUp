import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EvaluationResults() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);

  useEffect(() => {
    fetchEvaluationResults();
    const interval = setInterval(() => {
      if (submission?.processing_status === "processing") {
        fetchEvaluationResults();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [submissionId]);

  const fetchEvaluationResults = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch submission
      const { data: subData, error: subError } = await supabase
        .from("post_exam_submissions")
        .select("*")
        .eq("id", submissionId)
        .single();

      if (subError) throw subError;
      setSubmission(subData);

      // Fetch evaluation
      const { data: evalData, error: evalError } = await supabase
        .from("evaluations")
        .select("*")
        .eq("submission_id", submissionId)
        .single();

      if (!evalError && evalData) {
        setEvaluation(evalData);
        setLoading(false);
      } else if (subData.processing_status === "completed") {
        // Evaluation should exist but doesn't - error state
        toast({
          variant: "destructive",
          title: "Evaluation data not found",
          description: "Please try uploading your answer sheet again",
        });
        setLoading(false);
      } else if (subData.processing_status === "failed") {
        toast({
          variant: "destructive",
          title: "Evaluation failed",
          description: "There was an error processing your answer sheet",
        });
        setLoading(false);
      }
    } catch (error: any) {
      console.error("Error fetching results:", error);
      toast({
        variant: "destructive",
        title: "Error loading results",
        description: error.message,
      });
      setLoading(false);
    }
  };

  if (loading || submission?.processing_status === "processing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-purple-950/20 to-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Analyzing Your Answer Sheet</h2>
          <p className="text-muted-foreground">
            Our AI is carefully evaluating your responses. This may take a minute...
          </p>
        </Card>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-purple-950/20 to-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Evaluation Not Available</h2>
          <p className="text-muted-foreground mb-4">
            Unable to load evaluation results.
          </p>
          <Button onClick={() => navigate("/post-exam")}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  const scorePercentage = (evaluation.total_score / evaluation.max_score) * 100;
  const questions = evaluation.detailed_analytics?.questions || [];
  const conceptWisePerf = evaluation.detailed_analytics?.concept_wise_performance || {};
  const strengths = evaluation.detailed_analytics?.strengths || [];
  const areasToFocus = evaluation.detailed_analytics?.areas_to_focus || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-950/20 to-background">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-primary">Evaluation Results</h1>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Overall Score Card */}
        <Card className="p-8 mb-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-primary/10 mb-4">
              <div className="text-4xl font-bold text-primary">
                {scorePercentage.toFixed(0)}%
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-2">
              {evaluation.total_score} / {evaluation.max_score}
            </h2>
            <p className="text-muted-foreground">Overall Score</p>
          </div>
          
          <Progress value={scorePercentage} className="h-3 mb-6" />
          
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                Strengths
              </h3>
              <ul className="space-y-2">
                {strengths.map((strength: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                    <span className="text-sm">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-warning" />
                Areas to Focus
              </h3>
              <ul className="space-y-2">
                {areasToFocus.map((area: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-warning mt-1 flex-shrink-0" />
                    <span className="text-sm">{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="questions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="questions">Question-wise Analysis</TabsTrigger>
            <TabsTrigger value="concepts">Concept Performance</TabsTrigger>
            <TabsTrigger value="improvements">Improvement Plan</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="space-y-4">
            {questions.map((q: any, idx: number) => (
              <Card key={idx} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-lg">{q.question_number}</h3>
                  <span className="text-sm font-medium">
                    {q.score} / {q.max_score} marks
                  </span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Question:</p>
                    <p className="text-sm">{q.question_text}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Your Answer:</p>
                    <p className="text-sm bg-muted/50 p-3 rounded">{q.student_answer}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Expected Answer:</p>
                    <p className="text-sm bg-success/10 p-3 rounded">{q.expected_answer}</p>
                  </div>
                  
                  {q.feedback && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Feedback:</p>
                      <p className="text-sm">{q.feedback}</p>
                    </div>
                  )}
                  
                  {q.improvement_tip && (
                    <div className="bg-primary/5 p-3 rounded">
                      <p className="text-sm font-medium mb-1">💡 Improvement Tip:</p>
                      <p className="text-sm">{q.improvement_tip}</p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
            
            {questions.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No detailed question analysis available</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="concepts" className="space-y-4">
            {Object.entries(conceptWisePerf).map(([concept, data]: [string, any]) => (
              <Card key={concept} className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{concept}</h3>
                  <span className="text-sm font-medium">
                    {data.score} / {data.max_score} ({data.percentage.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={data.percentage} className="h-2" />
              </Card>
            ))}
            
            {Object.keys(conceptWisePerf).length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No concept-wise analysis available</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="improvements">
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4">Personalized Improvement Plan</h3>
              
              {evaluation.weak_areas && evaluation.weak_areas.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-2">Weak Areas:</h4>
                  <div className="flex flex-wrap gap-2">
                    {evaluation.weak_areas.map((area: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-warning/20 text-warning rounded-full text-sm">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <h4 className="font-medium mb-2">Detailed Suggestions:</h4>
                <div className="prose prose-sm max-w-none">
                  <p className="text-sm whitespace-pre-wrap">{evaluation.improvement_suggestions}</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}