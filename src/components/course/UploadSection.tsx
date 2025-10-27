import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadSectionProps {
  courseId: string;
}

export default function UploadSection({ courseId }: UploadSectionProps) {
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [textbookFile, setTextbookFile] = useState<File | null>(null);
  const [pyqFile, setPyqFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (
    file: File,
    resourceType: "syllabus" | "textbook" | "pyq"
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const bucket = resourceType === "syllabus" ? "syllabus" : resourceType === "textbook" ? "textbooks" : "pyqs";

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase.from("resource_materials").insert({
      course_id: courseId,
      user_id: user.id,
      resource_type: resourceType,
      file_name: file.name,
      file_path: fileName,
      file_size: file.size,
    });

    if (dbError) throw dbError;

    return fileName;
  };

  const handleUpload = async () => {
    if (!syllabusFile) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Syllabus is required",
      });
      return;
    }

    setUploading(true);

    try {
      await handleFileUpload(syllabusFile, "syllabus");
      
      if (textbookFile) {
        await handleFileUpload(textbookFile, "textbook");
      }
      
      if (pyqFile) {
        await handleFileUpload(pyqFile, "pyq");
      }

      toast({
        title: "Success",
        description: "Files uploaded successfully!",
      });

      // Reset files
      setSyllabusFile(null);
      setTextbookFile(null);
      setPyqFile(null);
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

  const handleGenerateContent = async () => {
    // Ensure user is logged in and syllabus exists before invoking the function
    const [{ data: userData }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);

    const user = userData?.user;
    const session = sessionData?.session;

    if (!user || !session?.access_token) {
      toast({
        variant: "destructive",
        title: "Sign in required",
        description: "Please sign in to generate study content.",
      });
      return;
    }

    // Check syllabus presence and get its file_path
    const { data: syllabusRows, error: syllabusErr } = await supabase
      .from("resource_materials")
      .select("file_path")
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .eq("resource_type", "syllabus")
      .limit(1);

    if (syllabusErr) {
      toast({ variant: "destructive", title: "Error", description: syllabusErr.message });
      return;
    }
    const filePath = syllabusRows?.[0]?.file_path as string | undefined;
    if (!filePath) {
      toast({
        variant: "destructive",
        title: "Syllabus required",
        description: "Upload a syllabus first, then try generating content.",
      });
      return;
    }

    setGenerating(true);
    try {
      // Download the private syllabus file and extract text client-side with pdf.js
      const { data: fileBlob, error: dlErr } = await supabase.storage
        .from("syllabus")
        .download(filePath);
      if (dlErr || !fileBlob) throw dlErr || new Error("Unable to download syllabus file");

      // Dynamic import to keep bundle light and work with Vite
      const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const workerUrl: any = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default;
      if (pdfjs?.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

      const arrayBuffer = await fileBlob.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      let syllabusText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        syllabusText += (content.items as any[])
          .map((it: any) => (it && it.str) ? it.str : '')
          .join(' ') + '\n';
      }
      syllabusText = syllabusText.trim();

      if (!syllabusText || syllabusText.length < 5) {
        throw new Error('Could not read text from syllabus (likely a scanned PDF).');
      }

      const { data, error } = await supabase.functions.invoke("generate-study-content", {
        body: { courseId, syllabusText },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      toast({
        title: "Content Generated!",
        description: "Your study materials are ready.",
      });
    } catch (error: any) {
      const message =
        error?.status === 429
          ? "Rate limit exceeded. Please wait a moment and try again."
          : error?.status === 402
          ? "AI credits exhausted. Please add credits and retry."
          : error?.message || "Something went wrong.";
      toast({ variant: "destructive", title: "Generation failed", description: message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Upload Study Materials</h3>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="syllabus">Syllabus (Required)</Label>
            <div className="flex items-center gap-4">
              <input
                id="syllabus"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("syllabus")?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {syllabusFile ? syllabusFile.name : "Choose Syllabus"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="textbook">Textbook (Optional)</Label>
            <div className="flex items-center gap-4">
              <input
                id="textbook"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setTextbookFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("textbook")?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {textbookFile ? textbookFile.name : "Choose Textbook"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pyq">Previous Year Questions (Optional)</Label>
            <div className="flex items-center gap-4">
              <input
                id="pyq"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setPyqFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("pyq")?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {pyqFile ? pyqFile.name : "Choose PYQs"}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploading || !syllabusFile}
            className="w-full"
            variant="hero"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Generate Study Content</h3>
        <p className="text-sm text-muted-foreground mb-4">
          After uploading your materials, generate AI-powered summaries, mindmaps, and study aids.
        </p>
        <Button
          onClick={handleGenerateContent}
          disabled={generating}
          variant="success"
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Content...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Generate Study Materials
            </>
          )}
        </Button>
      </Card>
    </div>
  );
}
