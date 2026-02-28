import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import CoursePage from "./pages/CoursePage";
import PostExam from "./pages/PostExam";
import EvaluationResults from "./pages/EvaluationResults";
import TakeTest from "./pages/TakeTest";
import ViewTest from "./pages/ViewTest";
import TestResults from "./pages/TestResults";
import Certificate from "./pages/Certificate";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/course/:courseId" element={<CoursePage />} />
          <Route path="/post-exam" element={<PostExam />} />
          <Route path="/evaluation/:submissionId" element={<EvaluationResults />} />
          <Route path="/test/:paperId" element={<TakeTest />} />
          <Route path="/test/:paperId/view" element={<ViewTest />} />
          <Route path="/test/:paperId/results" element={<TestResults />} />
          <Route path="/certificate/:courseId" element={<Certificate />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
