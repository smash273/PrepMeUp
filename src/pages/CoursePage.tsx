import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, FileText, Target, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import UploadSection from "@/components/course/UploadSection";
import GeneratedContent from "@/components/course/GeneratedContent";
import MockPapers from "@/components/course/MockPapers";

export default function CoursePage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upload");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchCourse();
    
    // Check for tab query parameter
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'content') {
      setActiveTab('content');
    } else if (tab === 'mocks') {
      setActiveTab('mocks');
    }
  }, [courseId]);

  const fetchCourse = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load course",
      });
      navigate("/courses");
    } else {
      setCourse(data);
    }
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
            <Button variant="ghost" onClick={() => navigate("/courses")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">{course?.name}</h1>
              <p className="text-sm text-muted-foreground">{course?.description}</p>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-3xl mx-auto">
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload Materials
            </TabsTrigger>
            <TabsTrigger value="content">
              <FileText className="mr-2 h-4 w-4" />
              Study Content
            </TabsTrigger>
            <TabsTrigger value="mocks">
              <Target className="mr-2 h-4 w-4" />
              Mock Tests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <UploadSection courseId={courseId!} />
          </TabsContent>

          <TabsContent value="content">
            <GeneratedContent courseId={courseId!} />
          </TabsContent>

          <TabsContent value="mocks">
            <MockPapers courseId={courseId!} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
