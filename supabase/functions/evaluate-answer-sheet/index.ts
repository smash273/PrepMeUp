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
    const { submissionId } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch submission
    const { data: submission, error: submissionError } = await supabase
      .from("post_exam_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (submissionError) throw submissionError;

    // Update processing status
    await supabase
      .from("post_exam_submissions")
      .update({ processing_status: "processing" })
      .eq("id", submissionId);

    // In a real app, you would:
    // 1. Download the answer sheet file
    // 2. Use OCR to extract text
    // 3. Compare with course materials/answer key
    
    // Simulated OCR text
    const ocrText = "Sample OCR extracted text from answer sheet";

    // Fetch course materials for context
    const { data: materials } = await supabase
      .from("resource_materials")
      .select("*")
      .eq("course_id", submission.course_id);

    const { data: generatedContent } = await supabase
      .from("generated_content")
      .select("*")
      .eq("course_id", submission.course_id);

    // Use AI to evaluate
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
            content: "You are an expert exam evaluator. Analyze the student's answers and provide detailed feedback, scoring, and improvement suggestions."
          },
          {
            role: "user",
            content: `Evaluate this exam answer sheet:

OCR Text: ${ocrText}

Provide evaluation as JSON:
{
  "total_score": 75,
  "max_score": 100,
  "weak_areas": ["Topic A", "Topic B"],
  "improvement_suggestions": "Detailed suggestions",
  "detailed_analytics": {
    "question_wise": [...],
    "concept_wise_performance": {...}
  }
}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error("Failed to evaluate answer sheet");
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices[0].message.content;
    
    // Strip markdown code blocks if present
    rawContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const evaluation = JSON.parse(rawContent);

    // Store OCR text
    await supabase
      .from("post_exam_submissions")
      .update({ 
        ocr_text: ocrText,
        processing_status: "completed"
      })
      .eq("id", submissionId);

    // Store evaluation
    await supabase.from("evaluations").insert({
      submission_id: submissionId,
      user_id: submission.user_id,
      total_score: evaluation.total_score,
      max_score: evaluation.max_score,
      weak_areas: evaluation.weak_areas,
      improvement_suggestions: evaluation.improvement_suggestions,
      detailed_analytics: evaluation.detailed_analytics,
    });

    return new Response(
      JSON.stringify({ success: true, evaluation }),
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
