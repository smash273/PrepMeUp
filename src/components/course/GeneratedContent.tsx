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
                <h3 className="text-xl font-semibold mb-4 text-primary">{item.module_name}</h3>
                <div className="prose dark:prose-invert max-w-none">
                  {Array.isArray(item.content) ? (
                    <ul className="space-y-3 list-none pl-0">
                      {item.content.map((bullet: string, bulletIdx: number) => (
                        <li key={bulletIdx} className="flex items-start gap-3">
                          <span className="text-primary font-bold mt-1 flex-shrink-0">•</span>
                          <span className="leading-relaxed">{bullet.replace(/^[•\-]\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  ) : item.content?.text ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{item.content.text}</p>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{JSON.stringify(item.content)}</p>
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
                <h3 className="text-xl font-semibold mb-6 text-primary">{item.module_name}</h3>
                <div className="space-y-6">
                  {item.content.central && (
                    <div className="text-center mb-8">
                      <div className="inline-block bg-gradient-to-br from-primary to-purple-600 text-white px-8 py-4 rounded-full text-xl font-bold shadow-lg">
                        {item.content.central}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {item.content.branches?.map((branch: any, branchIdx: number) => (
                      <div
                        key={branchIdx}
                        className="border-2 rounded-lg p-5 hover:shadow-lg transition-all duration-200"
                        style={{
                          borderColor: branch.color || '#8B5CF6',
                          backgroundColor: `${branch.color || '#8B5CF6'}10`
                        }}
                      >
                        <h4
                          className="font-bold text-lg mb-3 flex items-center gap-2"
                          style={{ color: branch.color || '#8B5CF6' }}
                        >
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: branch.color || '#8B5CF6' }}></span>
                          {branch.name || branch}
                        </h4>
                        {Array.isArray(branch.subbranches) && (
                          <ul className="space-y-2 ml-6">
                            {branch.subbranches.map((sub: string, subIdx: number) => (
                              <li key={subIdx} className="flex items-start gap-2 text-sm">
                                <span className="mt-1.5 w-2 h-2 rounded-full bg-muted-foreground/60"></span>
                                <span>{sub}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>

                  {item.content.branches && !Array.isArray(item.content.branches) && (
                    <div className="space-y-3">
                      {Object.entries(item.content.branches).map(([key, value]: [string, any]) => (
                        <div key={key} className="border-l-4 border-primary pl-4 py-2">
                          <h4 className="font-semibold text-lg">{key}</h4>
                          {Array.isArray(value) && (
                            <ul className="ml-4 mt-2 space-y-1">
                              {value.map((v: string, vIdx: number) => (
                                <li key={vIdx} className="text-sm text-muted-foreground">• {v}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
