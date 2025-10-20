import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, FileText, CheckCircle, TrendingUp, Upload, Clock } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero py-20 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-left animate-fade-in">
              <h1 className="text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
                Ace Your Exams with AI-Powered Prep
              </h1>
              <p className="text-xl text-primary-foreground/90 mb-8">
                Upload your syllabus, get personalized study materials, practice with mock tests, and analyze your performance - all in one place.
              </p>
              <div className="flex gap-4">
                <Button variant="hero" size="lg">Get Started Free</Button>
                <Button variant="outline" size="lg" className="bg-white/10 border-white/20 text-primary-foreground hover:bg-white/20">Learn More</Button>
              </div>
            </div>
            <div className="animate-slide-up">
              <img src={heroImage} alt="Students preparing for exams" className="rounded-2xl shadow-hover" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need to Excel</h2>
            <p className="text-xl text-muted-foreground">From preparation to post-exam analysis</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Pre-Exam Card */}
            <Card className="shadow-card hover:shadow-hover transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Pre-Exam Preparation</CardTitle>
                <CardDescription>Smart study materials tailored to your syllabus</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Upload className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Upload Materials</h4>
                    <p className="text-sm text-muted-foreground">Syllabus, textbooks, and past papers</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-secondary mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">AI-Generated Content</h4>
                    <p className="text-sm text-muted-foreground">PPTs, mind maps, acronyms & summaries</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-accent mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Timed Mock Tests</h4>
                    <p className="text-sm text-muted-foreground">MCQs and long-answer practice</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Post-Exam Card */}
            <Card className="shadow-card hover:shadow-hover transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
                <CardTitle className="text-2xl">Post-Exam Analysis</CardTitle>
                <CardDescription>Detailed insights into your performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Upload className="w-5 h-5 text-success mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Upload Answer Sheets</h4>
                    <p className="text-sm text-muted-foreground">OCR technology reads your responses</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Automated Evaluation</h4>
                    <p className="text-sm text-muted-foreground">AI-powered grading and scoring</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-accent mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Performance Analytics</h4>
                    <p className="text-sm text-muted-foreground">Identify weak areas and improve</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <Button variant="hero" size="lg">Start Your Prep Journey</Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
