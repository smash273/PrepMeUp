import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Brain, List } from "lucide-react";

interface GeneratedContentProps {
  courseId: string;
}

export default function GeneratedContent({ courseId }: GeneratedContentProps) {
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, [courseId]);

  const fetchContent = async () => {
    const { data, error } = await supabase
      .from("generated_content")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching content:", error);
    } else {
      setContent(data || []);
    }
    setLoading(false);
  };

  const summaries = content.filter((c) => c.content_type === "summary");
  const mindmaps = content.filter((c) => c.content_type === "mindmap");
  const acronyms = content.filter((c) => c.content_type === "acronyms");

  if (loading) {
    return <div className="text-center py-8">Loading content...</div>;
  }

  if (content.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Content Generated Yet</h3>
        <p className="text-muted-foreground">
          Upload materials and generate study content to see them here
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="summaries">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summaries">
            <FileText className="mr-2 h-4 w-4" />
            Summaries
          </TabsTrigger>
          <TabsTrigger value="mindmaps">
            <Brain className="mr-2 h-4 w-4" />
            Mind Maps
          </TabsTrigger>
          <TabsTrigger value="acronyms">
            <List className="mr-2 h-4 w-4" />
            Acronyms
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summaries" className="space-y-4 mt-6">
          {summaries.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No summaries available</p>
            </Card>
          ) : (
            summaries.map((item) => (
              <Card key={item.id} className="p-6">
                <h3 className="text-xl font-semibold mb-4">{item.module_name}</h3>
                <div className="prose dark:prose-invert max-w-none">
                  {typeof item.content === "string" ? (
                    <p>{item.content}</p>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: JSON.stringify(item.content, null, 2) }} />
                  )}
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="mindmaps" className="space-y-4 mt-6">
          {mindmaps.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No mindmaps available</p>
            </Card>
          ) : (
            mindmaps.map((item) => (
              <Card key={item.id} className="p-6">
                <h3 className="text-xl font-semibold mb-4">{item.module_name}</h3>
                <div className="space-y-2">
                  <pre className="bg-muted p-4 rounded-lg overflow-auto">
                    {JSON.stringify(item.content, null, 2)}
                  </pre>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="acronyms" className="space-y-4 mt-6">
          {acronyms.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No acronyms available</p>
            </Card>
          ) : (
            acronyms.map((item) => (
              <Card key={item.id} className="p-6">
                <h3 className="text-xl font-semibold mb-4">{item.module_name}</h3>
                <div className="space-y-2">
                  {Array.isArray(item.content) ? (
                    <ul className="list-disc list-inside space-y-2">
                      {item.content.map((acronym: any, index: number) => (
                        <li key={index} className="text-lg">
                          <strong>{acronym.acronym}</strong>: {acronym.meaning}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <pre className="bg-muted p-4 rounded-lg overflow-auto">
                      {JSON.stringify(item.content, null, 2)}
                    </pre>
                  )}
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
