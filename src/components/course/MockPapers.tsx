import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MockPapersProps {
  courseId: string;
}

export default function MockPapers({ courseId }: MockPapersProps) {
  const [papers, setPapers] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [questionType, setQuestionType] = useState<"mcq" | "long_answer">("mcq");
  const [totalMarks, setTotalMarks] = useState(100);
  const [duration, setDuration] = useState(60);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchPapers();
  }, [courseId]);

  const fetchPapers = async () => {
    const { data, error } = await supabase
      .from("mock_papers")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching papers:", error);
    } else {
      setPapers(data || []);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-mock-paper", {
        body: {
          courseId,
          title,
          questionType,
          totalMarks,
          duration,
        },
      });

      if (error) throw error;

      toast({
        title: "Mock paper generated!",
        description: "Your test is ready.",
      });
      
      setIsDialogOpen(false);
      setTitle("");
      fetchPapers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: error.message,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-semibold">Mock Test Papers</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="mr-2 h-4 w-4" />
              Generate Mock Paper
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Mock Test Paper</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Test Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Mid-term Mock Test"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Question Type</Label>
                <Select value={questionType} onValueChange={(v: any) => setQuestionType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice Questions</SelectItem>
                    <SelectItem value="long_answer">Long Answer Questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="marks">Total Marks</Label>
                  <Input
                    id="marks"
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(parseInt(e.target.value))}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    min={1}
                  />
                </div>
              </div>
              <Button type="submit" disabled={generating} className="w-full">
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Paper"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {papers.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Mock Papers Yet</h3>
          <p className="text-muted-foreground">
            Generate your first mock test to start practicing
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {papers.map((paper) => (
            <Card key={paper.id} className="p-6 hover:shadow-glow transition-all">
              <h4 className="font-semibold text-lg mb-2">{paper.title}</h4>
              <div className="space-y-1 text-sm text-muted-foreground mb-4">
                <p>Type: {paper.question_type === "mcq" ? "MCQs" : "Long Answer"}</p>
                <p>Marks: {paper.total_marks}</p>
                <p>Duration: {paper.duration_minutes} minutes</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => navigate(`/test/${paper.id}`)}
                >
                  Take Test
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => navigate(`/test/${paper.id}/view`)}
                >
                  View
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
