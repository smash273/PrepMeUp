import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Award } from "lucide-react";

export default function Certificate() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [mockTestCount, setMockTestCount] = useState(0);
  const [avgAccuracy, setAvgAccuracy] = useState(0);

  useEffect(() => {
    fetchCertificateData();
  }, [courseId]);

  const fetchCertificateData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    setUserName(profile?.full_name || "Student");

    // Fetch course
    const { data: course } = await supabase
      .from("courses")
      .select("name")
      .eq("id", courseId!)
      .single();
    setCourseName(course?.name || "Unknown Course");

    // Fetch mock papers for this course
    const { data: papers } = await supabase
      .from("mock_papers")
      .select("id")
      .eq("course_id", courseId!);

    if (papers && papers.length > 0) {
      const paperIds = papers.map((p) => p.id);

      // Fetch user_test_attempts for these papers
      const { data: attempts } = await supabase
        .from("user_test_attempts")
        .select("mock_paper_id, answers")
        .eq("user_id", user.id)
        .in("mock_paper_id", paperIds);

      if (attempts && attempts.length > 0) {
        setMockTestCount(attempts.length);

        // Get all question IDs from all attempts to fetch correct answers
        const allQuestionIds = new Set<string>();
        for (const attempt of attempts) {
          const answers = attempt.answers as Array<{ question_id: string; user_answer: string }>;
          if (Array.isArray(answers)) {
            answers.forEach((a) => allQuestionIds.add(a.question_id));
          }
        }

        // Fetch correct answers for all questions
        const { data: questions } = await supabase
          .from("questions")
          .select("id, correct_answer, options, question_type")
          .in("id", Array.from(allQuestionIds));

        if (questions) {
          const questionMap = new Map(questions.map((q) => [q.id, q]));

          // Calculate accuracy per attempt then average
          const accuracies: number[] = [];
          for (const attempt of attempts) {
            const answers = attempt.answers as Array<{ question_id: string; user_answer: string }>;
            if (!Array.isArray(answers) || answers.length === 0) continue;

            let correct = 0;
            let total = 0;
            for (const ans of answers) {
              const question = questionMap.get(ans.question_id);
              if (!question) continue;
              total++;

              if (question.question_type === "mcq" && question.options) {
                const options = question.options as string[];
                const correctIdx = parseInt(question.correct_answer || "0");
                const correctText = options[correctIdx];
                if (ans.user_answer === correctText || ans.user_answer === question.correct_answer) {
                  correct++;
                }
              } else {
                // For long answer, skip accuracy calc or mark as attempted
                // We can't auto-grade long answers accurately here
              }
            }
            if (total > 0) {
              accuracies.push((correct / total) * 100);
            }
          }

          if (accuracies.length > 0) {
            const avg = accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;
            setAvgAccuracy(Math.round(avg));
          }
        }
      }
    }

    setLoading(false);
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (mockTestCount === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-purple-950/20 to-background flex flex-col items-center justify-center p-4">
        <Award className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Certificate Available</h2>
        <p className="text-muted-foreground mb-6 text-center">
          Complete at least one mock test in <span className="font-semibold">{courseName}</span> to earn your certificate.
        </p>
        <Button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-950/20 to-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-6" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        {/* Certificate */}
        <div
          id="certificate"
          className="relative bg-card border-4 border-double border-primary/40 rounded-2xl p-8 md:p-16 text-center shadow-2xl"
        >
          {/* Decorative corners */}
          <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-primary/30 rounded-tl-lg" />
          <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-primary/30 rounded-tr-lg" />
          <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-primary/30 rounded-bl-lg" />
          <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-primary/30 rounded-br-lg" />

          <Award className="h-16 w-16 text-primary mx-auto mb-4" />

          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-2">
            Certificate of Appreciation
          </p>

          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-1">PrepMeUp</h1>

          <div className="my-8">
            <p className="text-muted-foreground mb-2">This is proudly presented to</p>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground font-serif italic border-b-2 border-primary/20 inline-block pb-2 px-6">
              {userName}
            </h2>
          </div>

          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed mb-4">
            For successfully completing{" "}
            <span className="font-semibold text-foreground">
              {mockTestCount} mock test{mockTestCount > 1 ? "s" : ""}
            </span>{" "}
            in{" "}
            <span className="font-semibold text-foreground">{courseName}</span>.
          </p>

          <div className="inline-flex items-center gap-2 bg-primary/10 rounded-lg px-6 py-3 mb-6">
            <span className="text-muted-foreground">Average Accuracy:</span>
            <span className="text-2xl font-bold text-primary">{avgAccuracy}%</span>
          </div>

          <div className="flex justify-between items-end mt-8 px-4 md:px-12">
            <div className="text-left">
              <p className="text-sm text-muted-foreground">{currentDate}</p>
              <p className="text-xs text-muted-foreground">Date of Issue</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground border-t border-muted-foreground/30 pt-1 px-4">
                PrepMeUp Team
              </p>
              <p className="text-xs text-muted-foreground">Authorized</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
