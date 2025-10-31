import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowLeft, Trash2 } from "lucide-react";

export default function Courses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  const [courseName, setCourseName] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const deleteCourse = async () => {
    if (!courseToDelete) return;
    setDeleting(true);

    try {
      // Get mock paper IDs for this course
      const { data: mockPapers } = await supabase
        .from("mock_papers")
        .select("id")
        .eq("course_id", courseToDelete);
      
      const mockPaperIds = mockPapers?.map((p: any) => p.id) || [];

      // Get test attempt IDs
      const { data: attempts } = await supabase
        .from("test_attempts")
        .select("id")
        .in("mock_paper_id", mockPaperIds);
      
      const attemptIds = attempts?.map((a: any) => a.id) || [];

      // Get submission IDs
      const { data: submissions } = await supabase
        .from("post_exam_submissions")
        .select("id")
        .eq("course_id", courseToDelete);
      
      const submissionIds = submissions?.map((s: any) => s.id) || [];

      // Delete in correct order
      if (attemptIds.length > 0) {
        await supabase.from("test_answers").delete().in("test_attempt_id", attemptIds);
      }

      if (mockPaperIds.length > 0) {
        await supabase.from("test_attempts").delete().in("mock_paper_id", mockPaperIds);
        await supabase.from("user_test_attempts").delete().in("mock_paper_id", mockPaperIds);
        await supabase.from("questions").delete().in("mock_paper_id", mockPaperIds);
      }

      await supabase.from("mock_papers").delete().eq("course_id", courseToDelete);

      if (submissionIds.length > 0) {
        await supabase.from("evaluations").delete().in("submission_id", submissionIds);
      }

      await supabase.from("post_exam_submissions").delete().eq("course_id", courseToDelete);
      await supabase.from("generated_content").delete().eq("course_id", courseToDelete);
      await supabase.from("resource_materials").delete().eq("course_id", courseToDelete);

      const { error } = await supabase.from("courses").delete().eq("id", courseToDelete);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Course and all related data deleted successfully",
      });

      fetchCourses();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete course",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setCourseToDelete(null);
    }
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
                className="p-6 hover:shadow-glow transition-all relative"
              >
                <div onClick={() => navigate(`/course/${course.id}`)} className="cursor-pointer">
                  <h3 className="font-semibold text-xl mb-2">{course.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {course.description || "No description"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(course.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCourseToDelete(course.id);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the course and ALL related data including:
              study content, mock tests, test attempts, and post-exam submissions.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCourseToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteCourse}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
