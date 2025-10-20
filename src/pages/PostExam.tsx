import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function PostExam() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [answerSheet, setAnswerSheet] = useState<File | null>(null);
  const [answerKey, setAnswerKey] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const { data } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });
    setCourses(data || []);
  };

  const handleUpload = async () => {
    if (!selectedCourse || !answerSheet) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a course and upload your answer sheet",
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload answer sheet
      const sheetFileName = `${user.id}/${Date.now()}_${answerSheet.name}`;
      const { error: sheetError } = await supabase.storage
        .from("answer-sheets")
        .upload(sheetFileName, answerSheet);

      if (sheetError) throw sheetError;

      // Upload answer key if provided
      let keyFileName = null;
      if (answerKey) {
        keyFileName = `${user.id}/${Date.now()}_${answerKey.name}`;
        const { error: keyError } = await supabase.storage
          .from("answer-keys")
          .upload(keyFileName, answerKey);

        if (keyError) throw keyError;
      }

      // Create submission
      const { data: submission, error: submissionError } = await supabase
        .from("post_exam_submissions")
        .insert({
          course_id: selectedCourse,
          user_id: user.id,
          answer_sheet_path: sheetFileName,
          answer_key_path: keyFileName,
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Trigger evaluation
      const { error: evalError } = await supabase.functions.invoke("evaluate-answer-sheet", {
        body: { submissionId: submission.id },
      });

      if (evalError) throw evalError;

      toast({
        title: "Upload successful!",
        description: "Your answer sheet is being evaluated...",
      });

      navigate(`/evaluation/${submission.id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-950/20 to-background">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-primary">Post-Exam Analysis</h1>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-8">
          <h2 className="text-2xl font-semibold mb-6">Upload Your Answer Sheet</h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="course">Select Course</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="answerSheet">Answer Sheet (Required)</Label>
              <input
                id="answerSheet"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setAnswerSheet(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("answerSheet")?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {answerSheet ? answerSheet.name : "Upload Answer Sheet"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Upload a scanned copy of your exam answer sheet
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="answerKey">Answer Key (Optional)</Label>
              <input
                id="answerKey"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setAnswerKey(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("answerKey")?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {answerKey ? answerKey.name : "Upload Answer Key"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Optionally provide an answer key for more accurate evaluation
              </p>
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedCourse || !answerSheet}
              className="w-full"
              variant="hero"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Upload & Evaluate"
              )}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
