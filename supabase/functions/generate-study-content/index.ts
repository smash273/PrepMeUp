import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseId } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch course materials
    const { data: materials, error: materialsError } = await supabase
      .from("resource_materials")
      .select("*")
      .eq("course_id", courseId);

    if (materialsError) throw materialsError;

    if (!materials || materials.length === 0) {
      return new Response(
        JSON.stringify({ error: "No materials found for this course" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract syllabus content (in a real app, you'd read the file content)
    const syllabusFile = materials.find((m) => m.resource_type === "syllabus");
    if (!syllabusFile) {
      return new Response(
        JSON.stringify({ error: "Syllabus not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate content using Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert educator creating study materials. Generate comprehensive summaries, mindmaps, and acronyms for easy memorization."
          },
          {
            role: "user",
            content: `Based on a course syllabus, generate study content for 3 major modules/topics. For each module, create:
1. A comprehensive summary (3-4 paragraphs)
2. A structured mindmap (key concepts and relationships)
3. Helpful acronyms for memorization

Format the response as JSON with this structure:
{
  "modules": [
    {
      "name": "Module Name",
      "summary": "Summary text",
      "mindmap": {"central": "topic", "branches": [...]},
      "acronyms": [{"acronym": "ABC", "meaning": "Always Be Coding"}]
    }
  ]
}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error("AI API Error:", error);
      throw new Error("Failed to generate content");
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices[0].message.content;
    
    // Strip markdown code blocks if present
    rawContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const content = JSON.parse(rawContent);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token!);

    if (!user) throw new Error("Unauthorized");

    // Store generated content
    for (const module of content.modules) {
      // Store summary
      await supabase.from("generated_content").insert({
        course_id: courseId,
        user_id: user.id,
        module_name: module.name,
        content_type: "summary",
        content: { text: module.summary },
      });

      // Store mindmap
      await supabase.from("generated_content").insert({
        course_id: courseId,
        user_id: user.id,
        module_name: module.name,
        content_type: "mindmap",
        content: module.mindmap,
      });

      // Store acronyms
      await supabase.from("generated_content").insert({
        course_id: courseId,
        user_id: user.id,
        module_name: module.name,
        content_type: "acronyms",
        content: module.acronyms,
      });
    }

    return new Response(
      JSON.stringify({ success: true, modules: content.modules.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
