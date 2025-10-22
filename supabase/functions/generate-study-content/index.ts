import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper function to return JSON responses with correct headers
const json = (data: unknown, status = 200) => {
  console.log(`Returning status: ${status}`); // Log every status code return
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

// Robust function to extract the storage key from various file path formats
function extractStorageKey(input: string) {
  if (!input) return "";
  try {
    if (input.startsWith("http")) {
      const u = new URL(input);
      let p = u.pathname;
      const marker = "/storage/v1/object/";
      const idx = p.indexOf(marker);
      if (idx !== -1) p = p.slice(idx + marker.length);
      // Remove known bucket prefixes. Note: "syllabus" is the bucket name
      p = p.replace(/^sign\//, "").replace(/^public\//, "").replace(/^syllabus\//, "");
      return p;
    }
    return input.replace(/^syllabus\//, "");
  } catch {
    return input.replace(/^syllabus\//, "");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed. Only POST is accepted." }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized: missing Bearer token in Authorization header." }, 401);
    }
    const token = authHeader.split(" ")[1];

    const { courseId } = await req.json().catch(() => ({}));
    if (!courseId) return json({ error: "Request body is missing or 'courseId' is not provided." }, 400);
    
    // --- Environment Variables Check ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!supabaseUrl || !serviceKey || !lovableApiKey) {
      console.error("Missing environment variables. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or LOVABLE_API_KEY secrets.");
      return json({ error: "Server configuration error (missing API key/URL)." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // --- User Validation ---
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) {
        console.error("JWT validation failed:", userError?.message);
        return json({ error: "Unauthorized: Invalid or expired user token." }, 401);
    }

    // --- Fetch Course Materials ---
    const { data: materials, error: materialsError } = await admin
      .from("resource_materials")
      .select("resource_type, file_path")
      .eq("course_id", courseId)
      .eq("user_id", user.id); // Ensure only student's own resources are used (Personalization)

    if (materialsError) {
      console.error("DB Error fetching materials:", materialsError);
      return json({ error: "Database error during material fetch: " + materialsError.message }, 500);
    }
    if (!materials?.length) return json({ error: "No resources found for this course and user." }, 404);

    // --- Find Syllabus File ---
    const syllabusFile = materials.find((m) => m.resource_type === "syllabus");
    if (!syllabusFile?.file_path) return json({ error: "Mandatory syllabus file path not found." }, 404);

    // --- Download Syllabus File ---
    const key = extractStorageKey(syllabusFile.file_path);
    if (!key) return json({ error: "Invalid storage key extracted from file path." }, 500);
    console.log(`Attempting to download file with key: ${key}`);
    
    const { data: syllabusBlob, error: downloadError } = await admin.storage
      .from("syllabus")
      .download(key);

    if (downloadError) {
      console.error("Error downloading syllabus:", downloadError);
      // This is a common 404/403 failure, usually RLS or bad key.
      return json({ error: `Failed to download syllabus from storage. Check RLS policies or file path. (${downloadError.message})` }, 404);
    }

    const syllabusText = await syllabusBlob.text();
    if (syllabusText.length < 50) return json({ error: "Syllabus content is too short or empty after download." }, 400);

    // --- Call Lovable AI ---
    console.log(`Syllabus length for AI call: ${syllabusText.length} characters.`);
    
      const payload = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are an expert educator creating study materials. Generate comprehensive, detailed study content strictly based ONLY on the provided syllabus. Cover ALL topics and subtopics mentioned in the syllabus with detailed bullet points, a mindmap structure, and acronyms.",
        },
        {
          role: "user",
          content: `You are an expert educator creating comprehensive study materials. Analyze this syllabus carefully and generate detailed study content that strictly follows it.

SYLLABUS CONTENT:
${syllabusText}

YOUR TASK:
1. Identify ALL modules/units/topics mentioned in the syllabus
2. For EACH module, create:
   - Comprehensive bullet-point summary covering ALL subtopics (10-20 detailed points per module)
   - A colorful, hierarchical mindmap with central topic, main branches, and sub-branches
   - Helpful acronyms for memorizing key concepts

CRITICAL REQUIREMENTS:
- Stay 100% within syllabus scope - DO NOT add external topics
- Every major and minor topic from the syllabus MUST be covered
- Bullet points should be detailed explanations, not just topic names
- Each module MUST have its own complete mindmap with multiple branches
- Use diverse, vibrant colors for mindmap branches (#FF6B6B, #4ECDC4, #95E1D3, #FFA500, #9D50BB, #FF69B4, #32CD32, #FFD700)
- Each mindmap should have 4-8 main branches with 2-5 subbranches each

OUTPUT FORMAT:
Return ONLY a valid JSON object (no markdown, no code blocks, no extra text):
{
  "modules": [
    {
      "name": "Module 1 - Exact Name from Syllabus",
      "summary": [
        "• First major concept: detailed explanation covering key aspects and importance",
        "• Second major concept: comprehensive coverage of subtopics and relationships",
        "• Third concept: in-depth description with examples and applications",
        "... (10-20 detailed bullet points covering ALL topics)"
      ],
      "mindmap": {
        "central": "🎯 Module 1 Core Topic",
        "branches": [
          {
            "name": "Main Branch 1",
            "color": "#FF6B6B",
            "subbranches": ["Subtopic 1.1", "Subtopic 1.2", "Subtopic 1.3"]
          },
          {
            "name": "Main Branch 2",
            "color": "#4ECDC4",
            "subbranches": ["Subtopic 2.1", "Subtopic 2.2", "Subtopic 2.3"]
          },
          {
            "name": "Main Branch 3",
            "color": "#FFA500",
            "subbranches": ["Subtopic 3.1", "Subtopic 3.2"]
          },
          {
            "name": "Main Branch 4",
            "color": "#9D50BB",
            "subbranches": ["Subtopic 4.1", "Subtopic 4.2", "Subtopic 4.3"]
          }
        ]
      },
      "acronyms": [
        {"acronym": "SMART", "meaning": "Specific, Measurable, Achievable, Relevant, Time-bound"},
        {"acronym": "ACID", "meaning": "Atomicity, Consistency, Isolation, Durability"}
      ]
    }
  ]
}`,
        },
      ],
    };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text().catch(() => "N/A");
      console.error(`AI API Error: Status ${aiResponse.status}. Details: ${detail}`);
      return json({ 
        error: `AI service error (${aiResponse.status}). ${aiResponse.status === 429 ? 'Rate limit exceeded. Please try again in a moment.' : 'Please try again.'}` 
      }, 502);
    }

    const aiData = await aiResponse.json();

    // --- Robust JSON Parsing ---
    let rawContent = aiData?.choices?.[0]?.message?.content;

    if (!rawContent || typeof rawContent !== "string") {
      console.error("Malformed AI response: Content field missing or invalid.", aiData);
      return json({ error: "Malformed AI response: Content field is missing or not a string." }, 502);
    }
    
    // Remove markdown code fences (```json ... ```) that LLMs often include
    rawContent = rawContent.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();

    let content: any;
    try {
      content = JSON.parse(rawContent);
    } catch (e) {
      console.error(`JSON parse failed. Error: ${e}. Raw content: ${rawContent}`);
      return json({ error: "AI output is not valid JSON. Please try again." }, 502);
    }

    if (!Array.isArray(content.modules)) {
      return json({ error: "AI output missing the mandatory 'modules' array." }, 502);
    }

    // --- Database Insertion ---
    const rows = [];
    for (const module of content.modules) {
      // Ensure content fields are present before inserting (avoids null errors)
      rows.push(
        { course_id: courseId, user_id: user.id, module_name: module.name, content_type: "summary", content: module.summary || [] },
        { course_id: courseId, user_id: user.id, module_name: module.name, content_type: "mindmap", content: module.mindmap || {} },
        { course_id: courseId, user_id: user.id, module_name: module.name, content_type: "acronyms", content: module.acronyms || [] },
      );
    }

    const { error: insertError } = await admin.from("generated_content").insert(rows);
    if (insertError) {
      console.error("DB Insert error:", insertError);
      return json({ error: "Failed to store generated content. Check RLS for 'generated_content': " + insertError.message }, 500);
    }

    return json({ success: true, message: `Successfully generated and stored content for ${content.modules.length} modules.` }, 201);
  } catch (error) {
    console.error("UNHANDLED Edge Function error:", error);
    // 500 for any unexpected runtime error (e.g., memory limit, Deno runtime crash)
    return json({ error: `Internal server error: ${(error as Error).message}` }, 500);
  }
});
