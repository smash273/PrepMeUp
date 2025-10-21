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

    // Extract syllabus content
    const syllabusFile = materials.find((m) => m.resource_type === "syllabus");
    if (!syllabusFile) {
      return new Response(
        JSON.stringify({ error: "Syllabus not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download syllabus file from storage to read its content
    const { data: syllabusBlob, error: downloadError } = await supabase.storage
      .from("syllabus")
      .download(syllabusFile.file_path.split("/").pop()!);

    if (downloadError) {
      console.error("Error downloading syllabus:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download syllabus" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read syllabus content
    const syllabusText = await syllabusBlob.text();

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
            content: "You are an expert educator creating study materials. Generate comprehensive, detailed study content strictly based ONLY on the provided syllabus. Cover ALL topics and subtopics mentioned in the syllabus with detailed bullet points. Create colorful, well-structured mindmaps for EACH module that visually represent the relationships between concepts."
          },
          {
            role: "user",
            content: `Based on this exact syllabus, generate detailed study content for ALL modules/topics mentioned:

SYLLABUS:
${syllabusText}

IMPORTANT INSTRUCTIONS:
1. Create content for EVERY module/topic in the syllabus
2. Summaries MUST be in detailed bullet points covering ALL major and minor topics
3. Include 8-15 bullet points per module covering key concepts, definitions, applications, and examples
4. Create a colorful, hierarchical mindmap for EACH module with:
   - Central topic (use emoji or icon)
   - Main branches for major topics (assign different colors)
   - Sub-branches for subtopics
   - Clear visual relationships
5. Generate helpful acronyms for key concepts in each module
6. Stay strictly within the syllabus content - do not add external information

Format the response as JSON with this exact structure:
{
  "modules": [
    {
      "name": "Module Name (as per syllabus)",
      "summary": [
        "• Detailed bullet point 1",
        "• Detailed bullet point 2",
        "• Continue for 8-15 points..."
      ],
      "mindmap": {
        "central": "🎯 Central Topic",
        "branches": [
          {
            "name": "Main Branch 1",
            "color": "#FF6B6B",
            "subbranches": [
              "Subtopic 1",
              "Subtopic 2"
            ]
          },
          {
            "name": "Main Branch 2", 
            "color": "#4ECDC4",
            "subbranches": ["Subtopic 1"]
          }
        ]
      },
      "acronyms": [
        {"acronym": "ABC", "meaning": "Actual Meaning from Syllabus"}
      ]
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
      // Store summary as array of bullet points
      await supabase.from("generated_content").insert({
        course_id: courseId,
        user_id: user.id,
        module_name: module.name,
        content_type: "summary",
        content: module.summary, // Already an array of strings
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
