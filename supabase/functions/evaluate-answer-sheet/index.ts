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
    
    if (!submissionId) {
      return new Response(
        JSON.stringify({ error: "Submission ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Fetching submission:", submissionId);

    // Fetch submission
    const { data: submission, error: submissionError } = await supabase
      .from("post_exam_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (submissionError) {
      console.error("Submission fetch error:", submissionError);
      throw new Error("Unable to fetch submission data");
    }

    // Update processing status
    await supabase
      .from("post_exam_submissions")
      .update({ processing_status: "processing" })
      .eq("id", submissionId);

    console.log("Processing answer sheet:", submission.answer_sheet_path);

    // Download answer sheet from storage
    const { data: answerSheetData, error: downloadError } = await supabase.storage
      .from("answer-sheets")
      .download(submission.answer_sheet_path);

    if (downloadError) {
      console.error("Download error:", downloadError);
      throw new Error("Failed to download answer sheet");
    }

    // Convert to base64 for Gemini
    const arrayBuffer = await answerSheetData.arrayBuffer();
    const base64AnswerSheet = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    console.log("Extracting text from answer sheet using Gemini Vision...");

    // Extract text from answer sheet using Gemini Vision
    const ocrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text from this answer sheet image. Identify question numbers and student's answers. Return in format: Q1: [student answer], Q2: [student answer], etc."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64AnswerSheet}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error("OCR failed:", errorText);
      throw new Error("Failed to extract text from answer sheet");
    }

    const ocrData = await ocrResponse.json();
    const ocrText = ocrData.choices[0].message.content;
    console.log("Extracted text length:", ocrText.length);

    // Handle answer key if provided
    let answerKeyText = null;
    if (submission.answer_key_path) {
      console.log("Processing answer key:", submission.answer_key_path);
      
      const { data: answerKeyData, error: keyDownloadError } = await supabase.storage
        .from("answer-keys")
        .download(submission.answer_key_path);

      if (!keyDownloadError && answerKeyData) {
        const keyArrayBuffer = await answerKeyData.arrayBuffer();
        const base64AnswerKey = btoa(String.fromCharCode(...new Uint8Array(keyArrayBuffer)));

        // Extract text from answer key
        const keyOcrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract text from this answer key/question paper. Identify questions and their expected answers if present. Return in structured format."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${base64AnswerKey}`
                    }
                  }
                ]
              }
            ],
          }),
        });

        if (keyOcrResponse.ok) {
          const keyOcrData = await keyOcrResponse.json();
          answerKeyText = keyOcrData.choices[0].message.content;
          console.log("Extracted answer key text length:", answerKeyText.length);
        }
      }
    }

    // Fetch course materials for context
    const { data: materials } = await supabase
      .from("resource_materials")
      .select("*")
      .eq("course_id", submission.course_id);

    const { data: generatedContent } = await supabase
      .from("generated_content")
      .select("*")
      .eq("course_id", submission.course_id);

    console.log("Evaluating with Gemini...");

    // Build evaluation prompt
    let evaluationPrompt = `You are an expert exam evaluator. Analyze the student's answers and provide detailed evaluation.

STUDENT'S ANSWER SHEET:
${ocrText}
`;

    if (answerKeyText) {
      evaluationPrompt += `\nANSWER KEY/QUESTIONS PROVIDED:
${answerKeyText}

If the answer key contains only questions without answers, generate the expected answers based on the course context below.
`;
    }

    if (materials && materials.length > 0) {
      evaluationPrompt += `\nCOURSE CONTEXT:
Available materials: ${materials.map(m => m.file_name).join(", ")}
`;
    }

    evaluationPrompt += `
Provide a comprehensive evaluation as a JSON object with this structure:
{
  "total_score": <number>,
  "max_score": <number>,
  "weak_areas": ["area1", "area2"],
  "improvement_suggestions": "<detailed suggestions>",
  "detailed_analytics": {
    "questions": [
      {
        "question_number": "Q1",
        "question_text": "What is...",
        "student_answer": "Student wrote...",
        "expected_answer": "Correct answer should be...",
        "score": 7,
        "max_score": 10,
        "feedback": "Good effort but...",
        "improvement_tip": "To improve, focus on..."
      }
    ],
    "concept_wise_performance": {
      "Concept A": {"score": 15, "max_score": 20, "percentage": 75},
      "Concept B": {"score": 8, "max_score": 15, "percentage": 53.33}
    },
    "strengths": ["Good understanding of...", "Clear explanation of..."],
    "areas_to_focus": ["Review topic X", "Practice more on Y"]
  }
}

IMPORTANT: Return ONLY valid JSON, no markdown or explanation.`;

    // Use AI to evaluate
    const evalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: "You are an expert exam evaluator. Always respond with valid JSON only, no markdown formatting."
          },
          {
            role: "user",
            content: evaluationPrompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!evalResponse.ok) {
      const errorText = await evalResponse.text();
      console.error("Evaluation API error:", evalResponse.status, errorText);
      throw new Error("Failed to evaluate answer sheet");
    }

    const evalData = await evalResponse.json();
    let rawContent = evalData.choices[0].message.content;
    
    console.log("Raw AI response preview:", rawContent.substring(0, 200));
    
    // Strip markdown code blocks if present
    rawContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let evaluation;
    try {
      evaluation = JSON.parse(rawContent);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw content:", rawContent);
      throw new Error("Failed to parse evaluation response");
    }

    console.log("Storing evaluation results...");

    // Store OCR text
    await supabase
      .from("post_exam_submissions")
      .update({ 
        ocr_text: ocrText,
        processing_status: "completed"
      })
      .eq("id", submissionId);

    // Store evaluation
    const { error: insertError } = await supabase.from("evaluations").insert({
      submission_id: submissionId,
      user_id: submission.user_id,
      total_score: evaluation.total_score || 0,
      max_score: evaluation.max_score || 100,
      weak_areas: evaluation.weak_areas || [],
      improvement_suggestions: evaluation.improvement_suggestions || "",
      detailed_analytics: evaluation.detailed_analytics || {},
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to store evaluation results");
    }

    console.log("Evaluation completed successfully");

    return new Response(
      JSON.stringify({ success: true, evaluation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Evaluation error:", error);
    
    // Update submission status to failed
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { submissionId } = await req.json();
      if (submissionId) {
        await supabase
          .from("post_exam_submissions")
          .update({ processing_status: "failed" })
          .eq("id", submissionId);
      }
    } catch (updateError) {
      console.error("Failed to update error status:", updateError);
    }
    
    return new Response(
      JSON.stringify({ error: "Unable to process answer sheet. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
