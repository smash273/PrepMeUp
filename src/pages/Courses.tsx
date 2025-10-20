import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowLeft } from "lucide-react";

export default function Courses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load courses",
      });
    } else {
      setCourses(data || []);
    }
  };

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("courses").insert({
      user_id: user.id,
      name: courseName,
      description: courseDescription,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Success",
        description: "Course created successfully!",
      });
      setIsDialogOpen(false);
      setCourseName("");
      setCourseDescription("");
      fetchCourses();
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-950/20 to-background">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-primary">My Courses</h1>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="mr-2 h-4 w-4" />
                New Course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Course</DialogTitle>
              </DialogHeader>
              <form onSubmit={createCourse} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Course Name</Label>
                  <Input
                    id="name"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="e.g., Data Structures & Algorithms"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    placeholder="Brief description of the course"
                    rows={3}
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  Create Course
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {courses.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="text-xl font-semibold mb-4">No Courses Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first course to start preparing for exams
            </p>
            <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Course
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card 
                key={course.id} 
                className="p-6 hover:shadow-glow transition-all cursor-pointer"
                onClick={() => navigate(`/course/${course.id}`)}
              >
                <h3 className="font-semibold text-xl mb-2">{course.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {course.description || "No description"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(course.created_at).toLocaleDateString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
