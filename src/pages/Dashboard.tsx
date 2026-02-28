import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, FileText, Target, TrendingUp, LogOut, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CourseSelector from "@/components/dashboard/CourseSelector";

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [courseSelectorOpen, setCourseSelectorOpen] = useState(false);
  const [selectorConfig, setSelectorConfig] = useState({
    title: "",
    description: "",
    action: "" as "study" | "mock" | "post-exam" | "certificate"
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
    fetchCourses();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
    
    // Fetch user's full name from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    
    if (profile?.full_name) {
      setUserName(profile.full_name);
    }
    
    setLoading(false);
  };

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching courses:", error);
    } else {
      setCourses(data || []);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out successfully",
    });
    navigate("/");
  };

  const handleCourseAction = (action: "study" | "mock" | "post-exam" | "certificate", title: string, description: string) => {
    setSelectorConfig({ title, description, action });
    setCourseSelectorOpen(true);
  };

  const handleCourseSelect = (courseId: string) => {
    if (selectorConfig.action === "study") {
      navigate(`/course/${courseId}?tab=content`);
    } else if (selectorConfig.action === "mock") {
      navigate(`/course/${courseId}?tab=mocks`);
    } else if (selectorConfig.action === "post-exam") {
      navigate("/post-exam");
    } else if (selectorConfig.action === "certificate") {
      navigate(`/certificate/${courseId}`);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-950/20 to-background">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">PrepMeUp</h1>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome {userName || ""}!</h2>
          <p className="text-muted-foreground">Ready to ace your exams?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="p-6 hover:shadow-glow transition-all cursor-pointer" onClick={() => navigate("/courses")}>
            <BookOpen className="h-12 w-12 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">My Courses</h3>
            <p className="text-sm text-muted-foreground">
              {courses.length} active courses
            </p>
          </Card>

          <Card className="p-6 hover:shadow-glow transition-all cursor-pointer" onClick={() => handleCourseAction("study", "Select Course for Study Content", "Choose a course to view AI-generated study materials")}>
            <FileText className="h-12 w-12 text-accent mb-4" />
            <h3 className="font-semibold text-lg mb-2">Study Content</h3>
            <p className="text-sm text-muted-foreground">
              AI-generated summaries & mindmaps
            </p>
          </Card>

          <Card className="p-6 hover:shadow-glow transition-all cursor-pointer" onClick={() => handleCourseAction("mock", "Select Course for Mock Tests", "Choose a course to practice with AI-generated tests")}>
            <Target className="h-12 w-12 text-success mb-4" />
            <h3 className="font-semibold text-lg mb-2">Mock Tests</h3>
            <p className="text-sm text-muted-foreground">
              Practice with AI-generated tests
            </p>
          </Card>

          <Card className="p-6 hover:shadow-glow transition-all cursor-pointer" onClick={() => navigate("/post-exam")}>
            <TrendingUp className="h-12 w-12 text-warning mb-4" />
            <h3 className="font-semibold text-lg mb-2">Post-Exam Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Evaluate & improve
            </p>
          </Card>

          <Card className="p-6 hover:shadow-glow transition-all cursor-pointer" onClick={() => handleCourseAction("certificate", "Select Course for Certificate", "Choose a course to view your certificate of appreciation")}>
            <Award className="h-12 w-12 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Certification</h3>
            <p className="text-sm text-muted-foreground">
              View your certificates
            </p>
          </Card>
        </div>

        {courses.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="text-xl font-semibold mb-4">Get Started</h3>
            <p className="text-muted-foreground mb-6">
              Create your first course to begin your exam preparation journey
            </p>
            <Button variant="hero" onClick={() => navigate("/courses")}>
              Create Course
            </Button>
          </Card>
        ) : (
          <div>
            <h3 className="text-2xl font-bold mb-6">Recent Courses</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.slice(0, 6).map((course) => (
                <Card key={course.id} className="p-6 hover:shadow-glow transition-all cursor-pointer">
                  <h4 className="font-semibold text-lg mb-2">{course.name}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {course.description || "No description"}
                  </p>
                  <Button 
                    className="mt-4 w-full" 
                    variant="outline"
                    onClick={() => navigate(`/course/${course.id}`)}
                  >
                    View Course
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      <CourseSelector
        open={courseSelectorOpen}
        onOpenChange={setCourseSelectorOpen}
        title={selectorConfig.title}
        description={selectorConfig.description}
        onSelect={handleCourseSelect}
      />
    </div>
  );
}
