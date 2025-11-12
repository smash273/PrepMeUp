import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, Loader2, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";

export default function PostExam() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [answerSheet, setAnswerSheet] = useState<File | null>(null);
  const [answerKey, setAnswerKey] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewCourse, setViewCourse] = useState("");
  const [previousEvaluations, setPreviousEvaluations] = useState<any[]>([]);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
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

  const fetchPreviousEvaluations = async (courseId: string) => {
    if (!courseId) return;
    setLoadingEvaluations(true);
    
    const { data: submissions } = await supabase
      .from("post_exam_submissions")
      .select(`
        *,
        evaluations (*)
      `)
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    setPreviousEvaluations(submissions || []);
    setLoadingEvaluations(false);
  };

  useEffect(() => {
    if (viewCourse) {
      fetchPreviousEvaluations(viewCourse);
    }
  }, [viewCourse]);

  // Extract text from PDF using pdfjs-dist with improved structure preservation
  const extractPdfText = async (file: File) => {
    try {
      const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const workerUrl: any = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default;
      if (pdfjs?.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      let fullText = "";
      const pageCount = Math.min(pdf.numPages, 20);
      
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const content: any = await page.getTextContent();
        
        // Preserve structure by tracking vertical positions
        const textLines: { y: number; text: string }[] = [];
        let currentLine = { y: 0, text: "" };
        
        content.items.forEach((item: any, idx: number) => {
          const y = item.transform[5];
          const text = item.str || "";
          
          // New line if Y position changed significantly (>5 units)
          if (idx > 0 && Math.abs(y - currentLine.y) > 5) {
            if (currentLine.text.trim()) textLines.push({ ...currentLine });
            currentLine = { y, text };
          } else {
            currentLine.y = y;
            currentLine.text += (currentLine.text ? " " : "") + text;
          }
        });
        
        if (currentLine.text.trim()) textLines.push(currentLine);
        
        // Sort by Y position (top to bottom) and join
        textLines.sort((a, b) => b.y - a.y);
        const pageText = textLines.map(line => line.text.trim()).filter(t => t).join("\n");
        
        fullText += `\n\n--- Page ${i} ---\n${pageText}`;
      }
      
      return fullText.trim();
    } catch (e) {
      console.error("PDF extraction failed", e);
      return "";
    }
  };

  // Render PDF pages to high-quality JPEG data URLs for OCR
  const renderPdfToImages = async (file: File) => {
    const images: string[] = [];
    try {
      const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const workerUrl: any = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default;
      if (pdfjs?.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      const pageCount = Math.min(pdf.numPages, 5);
      
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        // Increase scale for better OCR accuracy
        const viewport = page.getViewport({ scale: 3.0 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Use higher quality rendering
        await page.render({ 
          canvasContext: ctx as any, 
          viewport,
          intent: 'print' // Use print quality
        }).promise;
        
        // Higher JPEG quality for better OCR
        images.push(canvas.toDataURL("image/jpeg", 0.98));
      }
    } catch (e) {
      console.error("PDF render to images failed", e);
    }
    return images;
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

      // Trigger evaluation with optional pre-extracted PDF text
      let sheetText = "";
      let keyText = "";
      let sheetImages: string[] | undefined = undefined;
      let keyImages: string[] | undefined = undefined;
      if (answerSheet && answerSheet.type.includes("pdf")) {
        sheetText = await extractPdfText(answerSheet);
        if (!sheetText) {
          sheetImages = await renderPdfToImages(answerSheet);
        }
      }
      if (answerKey && answerKey.type.includes("pdf")) {
        keyText = await extractPdfText(answerKey);
        if (!keyText) {
          keyImages = await renderPdfToImages(answerKey);
        }
      }

      const { data: evalData, error: evalError } = await supabase.functions.invoke("evaluate-answer-sheet", {
        body: { submissionId: submission.id, answerSheetText: sheetText, answerKeyText: keyText, answerSheetImages: sheetImages, answerKeyImages: keyImages },
      });

      if (evalError) throw evalError;
      if (evalData && evalData.success === false) {
        toast({ variant: "destructive", title: "Evaluation error", description: evalData.error || "Failed to evaluate. Please try again." });
      }

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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="upload">New Analysis</TabsTrigger>
            <TabsTrigger value="history">View Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
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
          </TabsContent>

          <TabsContent value="history">
            <Card className="p-8">
              <h2 className="text-2xl font-semibold mb-6">Previous Analytics</h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="viewCourse">Select Course</Label>
                  <Select value={viewCourse} onValueChange={setViewCourse}>
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

                {loadingEvaluations ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : previousEvaluations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {viewCourse ? "No previous evaluations found for this course" : "Select a course to view analytics"}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {previousEvaluations.map((submission: any) => (
                      <Card 
                        key={submission.id} 
                        className="p-4 hover:shadow-glow transition-all cursor-pointer"
                        onClick={() => navigate(`/evaluation/${submission.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <History className="h-4 w-4 text-primary" />
                              <p className="font-medium">
                                {new Date(submission.created_at).toLocaleDateString()} at{" "}
                                {new Date(submission.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                            {submission.evaluations && submission.evaluations.length > 0 && (
                              <div className="text-sm text-muted-foreground">
                                Score: {submission.evaluations[0].total_score}/{submission.evaluations[0].max_score}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Status: {submission.processing_status}
                            </p>
                          </div>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
