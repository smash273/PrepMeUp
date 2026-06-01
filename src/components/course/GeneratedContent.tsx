import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Brain, List, Video, NotebookText, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { jsPDF } from "jspdf";
import pptxgen from "pptxgenjs";

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

    if (error) console.error("Error fetching content:", error);
    else setContent(data || []);
    setLoading(false);
  };

  const summaries = content.filter((c) => c.content_type === "summary");
  const mindmaps = content.filter((c) => c.content_type === "mindmap");
  const acronyms = content.filter((c) => c.content_type === "acronyms");
  const videos = content.filter((c) => c.content_type === "videos");
  const notes = content.filter((c) => c.content_type === "notes");

  if (loading) return <div className="text-center py-8">Loading content...</div>;

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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summaries"><FileText className="mr-2 h-4 w-4" />Summaries</TabsTrigger>
          <TabsTrigger value="mindmaps"><Brain className="mr-2 h-4 w-4" />Mind Maps</TabsTrigger>
          <TabsTrigger value="acronyms"><List className="mr-2 h-4 w-4" />Acronyms</TabsTrigger>
          <TabsTrigger value="videos"><Video className="mr-2 h-4 w-4" />Video Lessons</TabsTrigger>
          <TabsTrigger value="notes"><NotebookText className="mr-2 h-4 w-4" />Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="summaries" className="space-y-4 mt-6">
          {summaries.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No summaries available</p></Card>
          ) : (
            summaries.map((item) => (
              <Card key={item.id} className="p-6">
                <h3 className="text-xl font-semibold mb-4 text-primary">{item.module_name}</h3>
                <div className="prose dark:prose-invert max-w-none">
                  {Array.isArray(item.content) ? (
                    <ul className="space-y-3 list-none pl-0">
                      {item.content.map((bullet: string, i: number) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="text-primary font-bold mt-1 flex-shrink-0">•</span>
                          <span className="leading-relaxed">{bullet.replace(/^[•\-]\s*/, "")}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{item.content?.text ?? JSON.stringify(item.content)}</p>
                  )}
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="mindmaps" className="space-y-4 mt-6">
          {mindmaps.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No mindmaps available</p></Card>
          ) : (
            mindmaps.map((item) => (
              <Card key={item.id} className="p-6">
                <h3 className="text-xl font-semibold mb-6 text-primary">{item.module_name}</h3>
                {item.content.central && (
                  <div className="text-center mb-8">
                    <div className="inline-block bg-gradient-to-br from-primary to-purple-600 text-white px-8 py-4 rounded-full text-xl font-bold shadow-lg">
                      {item.content.central}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.isArray(item.content.branches) && item.content.branches.map((branch: any, bi: number) => (
                    <div key={bi} className="border-2 rounded-lg p-5"
                      style={{ borderColor: branch.color || "#8B5CF6", backgroundColor: `${branch.color || "#8B5CF6"}10` }}>
                      <h4 className="font-bold text-lg mb-3 flex items-center gap-2" style={{ color: branch.color || "#8B5CF6" }}>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: branch.color || "#8B5CF6" }}></span>
                        {branch.name || branch}
                      </h4>
                      {Array.isArray(branch.subbranches) && (
                        <ul className="space-y-2 ml-6">
                          {branch.subbranches.map((s: string, si: number) => (
                            <li key={si} className="flex items-start gap-2 text-sm">
                              <span className="mt-1.5 w-2 h-2 rounded-full bg-muted-foreground/60"></span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="acronyms" className="space-y-4 mt-6">
          {acronyms.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No acronyms available</p></Card>
          ) : (
            acronyms.map((item) => (
              <Card key={item.id} className="p-6">
                <h3 className="text-xl font-semibold mb-4">{item.module_name}</h3>
                {Array.isArray(item.content) ? (
                  <ul className="list-disc list-inside space-y-2">
                    {item.content.map((a: any, i: number) => (
                      <li key={i} className="text-lg"><strong>{a.acronym}</strong>: {a.meaning}</li>
                    ))}
                  </ul>
                ) : (
                  <pre className="bg-muted p-4 rounded-lg overflow-auto">{JSON.stringify(item.content, null, 2)}</pre>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="videos" className="space-y-6 mt-6">
          {videos.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No video lessons available yet. Generate study content first.</p></Card>
          ) : (
            videos.map((item) => <VideoModule key={item.id} item={item} />)
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-6 mt-6">
          {notes.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No notes available yet. Generate study content first.</p></Card>
          ) : (
            notes.map((item) => <NotesModule key={item.id} item={item} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VideoModule({ item }: { item: any }) {
  const queries: string[] = useMemo(
    () => Array.isArray(item.content?.queries) ? item.content.queries : [],
    [item]
  );
  return (
    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-4 text-primary">{item.module_name}</h3>
      {queries.length === 0 ? (
        <p className="text-muted-foreground">No video queries for this module.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {queries.map((q, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium">{q}</p>
              <div className="aspect-video w-full overflow-hidden rounded-lg border bg-black">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(q)}`}
                  title={q}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function NotesModule({ item }: { item: any }) {
  const markdown: string = item.content?.markdown || item.content?.text || "";

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    const titleLines = doc.splitTextToSize(item.module_name, maxWidth);
    doc.text(titleLines, margin, margin + 10);
    let y = margin + 10 + titleLines.length * 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const plain = markdown.replace(/^#+\s*/gm, "").replace(/[*_`>]/g, "");
    const lines = doc.splitTextToSize(plain, maxWidth);
    for (const line of lines) {
      if (y > pageHeight - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 14;
    }
    doc.save(`${item.module_name}-notes.pdf`);
  };

  const downloadPpt = async () => {
    const pptx = new pptxgen();
    pptx.layout = "LAYOUT_WIDE";
    const title = pptx.addSlide();
    title.addText(item.module_name, { x: 0.5, y: 2.5, w: 12, h: 1.5, fontSize: 40, bold: true, align: "center", color: "1E2761" });
    title.addText("Study Notes", { x: 0.5, y: 4, w: 12, h: 0.6, fontSize: 20, align: "center", color: "666666" });

    const sections = markdown.split(/\n(?=#{1,3} )/g).filter(s => s.trim());
    const chunks = sections.length ? sections : [markdown];
    for (const chunk of chunks) {
      const headingMatch = chunk.match(/^#{1,3}\s+(.+)/);
      const heading = headingMatch ? headingMatch[1] : item.module_name;
      const body = chunk.replace(/^#{1,3}\s+.+\n?/, "").replace(/[*_`>]/g, "").trim();
      const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
      let para = paragraphs;
      // Split into multiple slides if too long
      while (para.length) {
        const slide = pptx.addSlide();
        slide.addText(heading, { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: "1E2761" });
        const take = para.slice(0, 4).join("\n\n");
        slide.addText(take, { x: 0.5, y: 1.2, w: 12, h: 6, fontSize: 16, color: "333333", valign: "top" });
        para = para.slice(4);
      }
    }
    await pptx.writeFile({ fileName: `${item.module_name}-notes.pptx` });
  };

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-xl font-semibold text-primary">{item.module_name}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={downloadPdf}><Download className="mr-2 h-4 w-4" />PDF</Button>
          <Button size="sm" variant="outline" onClick={downloadPpt}><Download className="mr-2 h-4 w-4" />PPT</Button>
        </div>
      </div>
      {markdown ? (
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-muted-foreground">No notes available for this module.</p>
      )}
    </Card>
  );
}
