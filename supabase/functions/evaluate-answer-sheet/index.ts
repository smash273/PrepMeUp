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

  let submissionId: string | null = null;
  
  try {
    const body = await req.json();
    submissionId = body.submissionId;
    
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

    // Convert to base64 for Gemini - handle large files properly
    const arrayBuffer = await answerSheetData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 without spread operator to avoid stack overflow
    let base64AnswerSheet = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      base64AnswerSheet += String.fromCharCode.apply(null, Array.from(chunk));
    }
    base64AnswerSheet = btoa(base64AnswerSheet);
    
    // Detect file type
    const fileExtension = submission.answer_sheet_path.split('.').pop()?.toLowerCase();
    const isPDF = fileExtension === 'pdf';
    const mimeType = isPDF ? 'application/pdf' : 'image/jpeg';

    let ocrText = "";
    if (body.answerSheetText && typeof body.answerSheetText === 'string' && body.answerSheetText.trim().length > 0) {
      console.log("Using provided answer sheet text (client-extracted)");
      ocrText = body.answerSheetText.trim();
    } else if (Array.isArray(body.answerSheetImages) && body.answerSheetImages.length > 0) {
      console.log(`Extracting text from ${body.answerSheetImages.length} provided page images...`);
      const contentParts: any[] = [
        { type: "text", text: "You are an expert OCR system. Extract ALL text from these answer sheet images with perfect accuracy. Carefully read every word, number, symbol, and mathematical notation. Preserve the exact structure and formatting. Identify question numbers (Q1, Q2, etc.) and the student's complete answers for each question. If there are diagrams, describe them. If there are mathematical equations, transcribe them accurately. Return the extracted text in this exact format:\n\nQ1: [Complete student answer including all text, calculations, and work shown]\nQ2: [Complete student answer including all text, calculations, and work shown]\n\nBe extremely thorough and accurate. Do not skip any content." }
      ];
      for (const img of body.answerSheetImages.slice(0, 5)) {
        contentParts.push({ type: "image_url", image_url: { url: img } });
      }
      const ocrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-pro", messages: [{ role: "user", content: contentParts }] }),
      });
      if (!ocrResponse.ok) {
        const errorText = await ocrResponse.text();
        console.error("OCR failed from images:", errorText);
        throw new Error("Failed to extract text from answer sheet");
      }
      const ocrData = await ocrResponse.json();
      ocrText = ocrData.choices[0].message.content || "";
    } else {
      console.log("Extracting text from answer sheet using Gemini Vision...");

      // Extract text from answer sheet using Gemini (supports image files; PDFs should be pre-extracted client-side)
      if (isPDF) {
        console.error("PDF provided without extracted text or images");
        throw new Error("Failed to extract text from answer sheet");
      }
      const ocrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "You are an expert OCR system. Extract ALL text from this answer sheet image with perfect accuracy. Carefully read every word, number, symbol, and mathematical notation. Preserve the exact structure and formatting. Identify question numbers (Q1, Q2, etc.) and the student's complete answers for each question. If there are diagrams, describe them. If there are mathematical equations, transcribe them accurately. Return the extracted text in this exact format:\n\nQ1: [Complete student answer including all text, calculations, and work shown]\nQ2: [Complete student answer including all text, calculations, and work shown]\n\nBe extremely thorough and accurate. Do not skip any content." },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64AnswerSheet}` } }
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
      ocrText = ocrData.choices[0].message.content;
    }

    console.log("Extracted text length:", ocrText.length);

    // Handle answer key if provided
    let answerKeyText = null;
    if (body.answerKeyText && typeof body.answerKeyText === 'string' && body.answerKeyText.trim().length > 0) {
      console.log("Using provided answer key text (client-extracted)");
      answerKeyText = body.answerKeyText.trim();
    } else if (Array.isArray(body.answerKeyImages) && body.answerKeyImages.length > 0) {
      console.log(`Extracting text from ${body.answerKeyImages.length} provided answer key images...`);
      const contentParts: any[] = [
        { type: "text", text: "You are an expert OCR system. Extract ALL text from this answer key/question paper with perfect accuracy. Carefully read every word, number, symbol, and mathematical notation. Identify each question and its expected answer (if provided). If only questions are present without answers, extract the questions accurately. Return in structured format:\n\nQ1: [Question text]\nExpected Answer: [Answer if provided, or 'Not provided']\n\nQ2: [Question text]\nExpected Answer: [Answer if provided, or 'Not provided']\n\nBe extremely thorough and accurate." }
      ];
      for (const img of body.answerKeyImages.slice(0, 5)) {
        contentParts.push({ type: "image_url", image_url: { url: img } });
      }
      const keyOcrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-pro", messages: [{ role: "user", content: contentParts }] }),
      });
      if (keyOcrResponse.ok) {
        const keyOcrData = await keyOcrResponse.json();
        answerKeyText = keyOcrData.choices[0].message.content || null;
        if (answerKeyText) console.log("Extracted answer key text length:", answerKeyText.length);
      }
    } else if (submission.answer_key_path) {
      console.log("Processing answer key:", submission.answer_key_path);
      
      const { data: answerKeyData, error: keyDownloadError } = await supabase.storage
        .from("answer-keys")
        .download(submission.answer_key_path);

      if (!keyDownloadError && answerKeyData) {
        const keyArrayBuffer = await answerKeyData.arrayBuffer();
        const keyUint8Array = new Uint8Array(keyArrayBuffer);
        
        // Convert to base64 without spread operator
        let base64AnswerKey = '';
        const chunkSize = 8192;
        for (let i = 0; i < keyUint8Array.length; i += chunkSize) {
          const chunk = keyUint8Array.slice(i, i + chunkSize);
          base64AnswerKey += String.fromCharCode.apply(null, Array.from(chunk));
        }
        base64AnswerKey = btoa(base64AnswerKey);
        
        const keyExtension = submission.answer_key_path.split('.').pop()?.toLowerCase();
        const keyIsPDF = keyExtension === 'pdf';
        const keyMimeType = keyIsPDF ? 'application/pdf' : 'image/jpeg';

        // Extract text from answer key (only images; PDFs should be pre-extracted)
        if (!keyIsPDF) {
          const keyOcrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-pro",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: "You are an expert OCR system. Extract ALL text from this answer key/question paper with perfect accuracy. Carefully read every word, number, symbol, and mathematical notation. Identify each question and its expected answer (if provided). If only questions are present without answers, extract the questions accurately. Return in structured format:\n\nQ1: [Question text]\nExpected Answer: [Answer if provided, or 'Not provided']\n\nQ2: [Question text]\nExpected Answer: [Answer if provided, or 'Not provided']\n\nBe extremely thorough and accurate." },
                    { type: "image_url", image_url: { url: `data:${keyMimeType};base64,${base64AnswerKey}` } }
                  ]
                }
              ],
            }),
          });
  
          if (keyOcrResponse.ok) {
            const keyOcrData = await keyOcrResponse.json();
            answerKeyText = keyOcrData.choices[0].message.content || null;
            if (answerKeyText) console.log("Extracted answer key text length:", answerKeyText.length);
          }
        } else {
          console.error("Answer key is PDF without extracted text or images; skipping server OCR");
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
Analyze the student's performance and provide detailed evaluation including:
- Overall score and maximum possible score
- Weak areas where student needs improvement
- Detailed improvement suggestions
- Question-by-question analysis with student's answer, expected answer, score, feedback, and improvement tips
- Concept-wise performance breakdown
- Student's strengths and areas to focus on
`;

    // Use AI with function calling to get structured output
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
            content: "You are an expert exam evaluator. Analyze student answers and provide comprehensive feedback."
          },
          {
            role: "user",
            content: evaluationPrompt
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_evaluation",
              description: "Submit the comprehensive evaluation results",
              parameters: {
                type: "object",
                properties: {
                  total_score: {
                    type: "number",
                    description: "Total score obtained by student"
                  },
                  max_score: {
                    type: "number",
                    description: "Maximum possible score"
                  },
                  weak_areas: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of weak areas"
                  },
                  improvement_suggestions: {
                    type: "string",
                    description: "Detailed suggestions for improvement"
                  },
                  detailed_analytics: {
                    type: "object",
                    properties: {
                      questions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            question_number: { type: "string" },
                            question_text: { type: "string" },
                            student_answer: { type: "string" },
                            expected_answer: { type: "string" },
                            score: { type: "number" },
                            max_score: { type: "number" },
                            feedback: { type: "string" },
                            improvement_tip: { type: "string" }
                          },
                          required: ["question_number", "question_text", "student_answer", "expected_answer", "score", "max_score", "feedback", "improvement_tip"]
                        }
                      },
                      concept_wise_performance: {
                        type: "object",
                        additionalProperties: {
                          type: "object",
                          properties: {
                            score: { type: "number" },
                            max_score: { type: "number" },
                            percentage: { type: "number" }
                          }
                        }
                      },
                      strengths: {
                        type: "array",
                        items: { type: "string" }
                      },
                      areas_to_focus: {
                        type: "array",
                        items: { type: "string" }
                      }
                    },
                    required: ["questions", "concept_wise_performance", "strengths", "areas_to_focus"]
                  }
                },
                required: ["total_score", "max_score", "weak_areas", "improvement_suggestions", "detailed_analytics"]
              }
            }
          }
        ],
        tool_choice: {
          type: "function",
          function: { name: "submit_evaluation" }
        }
      }),
    });

    if (!evalResponse.ok) {
      const errorText = await evalResponse.text();
      console.error("Evaluation API error:", evalResponse.status, errorText);
      throw new Error("Failed to evaluate answer sheet");
    }

    const evalData = await evalResponse.json();
    console.log("AI response received");
    
    // Extract evaluation from function call or content fallback
    const choice = evalData.choices[0];
    const toolCall = choice.message.tool_calls?.[0];

    let evaluation;
    if (toolCall && toolCall.function.name === "submit_evaluation") {
      try {
        evaluation = JSON.parse(toolCall.function.arguments);
        console.log("Evaluation parsed from tool call");
      } catch (parseError) {
        console.error("Tool call JSON parse error:", parseError);
        console.error("Tool call arguments:", toolCall.function.arguments);
        throw new Error("Failed to parse evaluation response");
      }
    } else {
      // Fallback: try to parse message content as JSON
      let raw = choice.message.content ?? "";
      if (typeof raw !== "string") raw = String(raw);
      raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try {
        evaluation = JSON.parse(raw);
        console.log("Evaluation parsed from content fallback");
      } catch (e) {
        console.error("No valid tool call and content not JSON");
        throw new Error("Failed to get structured evaluation from AI");
      }
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
    if (submissionId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from("post_exam_submissions")
          .update({ processing_status: "failed" })
          .eq("id", submissionId);
      } catch (updateError) {
        console.error("Failed to update error status:", updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ success: false, error: "Unable to process answer sheet. Please try again." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
