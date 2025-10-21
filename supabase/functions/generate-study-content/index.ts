import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Extract a storage key relative to bucket root,
// whether you stored a full public URL or a path that might include the bucket name.
function extractStorageKey(input: string) {
  if (!input) return input;
  try {
    // If it's a public URL, strip the URL prefix and the "public/<bucket>/" part
    if (input.startsWith("http")) {
      const u = new URL(input);
      // e.g. /storage/v1/object/public/syllabus/folder/file.pdf
      let p = u.pathname;
      const marker = "/storage/v1/object/";
      const idx = p.indexOf(marker);
      if (idx !== -1) p = p.slice(idx + marker.length);
      // remove optional prefixes
      p = p.replace(/^sign\//, "");    // signed URLs
      p = p.replace(/^public\//, "");  // public bucket prefix
      p = p.replace(/^syllabus\//, "");// bucket name if present
      return p;
    }
    // If it's a relative path, ensure it does not contain the bucket name
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
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized: missing Bearer token" }, 401);
    }
    const token = authHeader.split(" ")[1];

    const { courseId } = await req.json().catch(() => ({}));
    if (!courseId) return json({ error: "courseId is required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    if (!lovableApiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    // Admin client (bypasses RLS). We’ll still validate user from token.
    const admin = createClient(supabaseUrl, serviceKey);

    // Validate user from JWT
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    // Fetch course materials
    const { data: materials, error: materialsError } = await admin
      .from("resource_materials")
      .select("*")
      .eq("course_id", courseId);

    if (materialsError) return json({ error: "DB error: " + materialsError.message }, 500);
    if (!materials?.length) return json({ error: "No materials found for this course" }, 404);

    // Find syllabus file
    const syllabusFile = materials.find((m) => m.resource_type === "syllabus");
    if (!syllabusFile?.file_path) return json({ error: "Syllabus not found" }, 404);

    // Download syllabus file from storage (use robust key extraction)
    const key = extractStorageKey(syllabusFile.file_path);
    const { data: syllabusBlob, error: downloadError } = await admin.storage
      .from("syllabus")
      .download(key);

    if (downloadError) {
      console.error("Error downloading syllabus:", downloadError);
      return json({ error: "Failed to download syllabus: " + downloadError.message }, 404);
    }

    const syllabusText = await syllabusBlob.text();

    // Call Lovable AI
    const payload = {
      model: "google/gemini-2.5-flash",
      temperature: 0.2,
      // If supported by your gateway, uncomment to force JSON.
      // response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert educator creating study materials. Generate comprehensive, detailed study content strictly based ONLY on the provided syllabus. Cover ALL topics and subtopics mentioned in the syllabus with detailed bullet points. Create colorful, well-structured mindmaps for EACH module that visually represent the relationships between concepts.",
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
      const detail = await aiResponse.text().catch(() => "");
      console.error("AI API Error:", aiResponse.status, detail);
      return json({ error: `AI provider error (${aiResponse.status})` }, 502);
    }

    const aiData = await aiResponse.json();

    // Support different shapes just in case
    let rawContent =
      aiData?.choices?.[0]?.message?.content ??
      aiData?.choices?.[0]?.text ??
      aiData?.choices?.[0]?.message?.content?.[0]?.text;

    if (!rawContent || typeof rawContent !== "string") {
      console.error("Unexpected AI response:", aiData);
      return json({ error: "Malformed AI response" }, 502);
    }

    // Strip code fences and parse JSON
    rawContent = rawContent.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();

    let content: any;
    try {
      content = JSON.parse(rawContent);
    } catch {
      console.error("JSON parse failed. Raw begins with:", rawContent.slice(0, 500));
      return json({ error: "AI JSON parse failed" }, 502);
    }

    if (!Array.isArray(content.modules)) {
      return json({ error: "AI output missing modules[]" }, 502);
    }

    // Build inserts and write once
    const rows = [];
    for (const module of content.modules) {
      rows.push(
        { course_id: courseId, user_id: user.id, module_name: module.name, content_type: "summary", content: module.summary },
        { course_id: courseId, user_id: user.id, module_name: module.name, content_type: "mindmap", content: module.mindmap },
        { course_id: courseId, user_id: user.id, module_name: module.name, content_type: "acronyms", content: module.acronyms },
      );
    }

    const { error: insertError } = await admin.from("generated_content").insert(rows);
    if (insertError) {
      console.error("Insert error:", insertError);
      return json({ error: "Failed to store content: " + insertError.message }, 500);
    }

    return json({ success: true, modules: content.modules.length }, 201);
  } catch (error) {
    console.error("Unhandled error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
