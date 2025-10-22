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
    const { courseId, title, questionType, totalMarks, duration } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token!);

    if (!user) throw new Error("Unauthorized");

    // Fetch generated content for context
    const { data: content } = await supabase
      .from("generated_content")
      .select("*")
      .eq("course_id", courseId);

    if (!content || content.length === 0) {
      throw new Error("No study content found. Please generate study materials first.");
    }

    // Format content for AI context
    const contentContext = content.map(c => {
      if (c.content_type === "summary") {
        return `Module: ${c.module_name}\nSummary:\n${(c.content as string[]).join('\n')}`;
      }
      return `Module: ${c.module_name}`;
    }).join('\n\n');

    const numQuestions = questionType === "mcq" ? Math.floor(totalMarks / 1) : Math.floor(totalMarks / 10);

    // Generate questions using Lovable AI
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
            content: `You are an expert exam paper creator. Generate ${questionType === "mcq" ? "multiple choice questions with 4 options" : "long answer questions"} STRICTLY based on the provided course content. Do not add questions from outside the given material.`
          },
          {
            role: "user",
            content: `Based ONLY on the following course content, generate ${numQuestions} ${questionType === "mcq" ? "MCQ" : "long answer"} questions for a mock exam.

COURSE CONTENT:
${contentContext}

REQUIREMENTS:
- Generate EXACTLY ${numQuestions} questions
- ${questionType === "mcq" ? "Each MCQ must have 4 options with only one correct answer" : "Each question should be worth 10 marks"}
- Questions must cover different modules proportionally
- Questions should test understanding, not just recall
- Stay STRICTLY within the provided content

Format as valid JSON (no markdown, no code blocks):
{
  "questions": [
    {
      "text": "Question text",
      ${questionType === "mcq" 
        ? '"options": [{"text": "Option A", "is_correct": false}, {"text": "Option B", "is_correct": true}, {"text": "Option C", "is_correct": false}, {"text": "Option D", "is_correct": false}], "marks": 1' 
        : '"answer": "Expected answer outline", "marks": 10'},
      "concept": "Main concept/module tested"
    }
  ]
}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text().catch(() => "Unknown error");
      console.error(`AI API Error: Status ${aiResponse.status}, Response: ${errorText}`);
      throw new Error(`Failed to generate questions: ${aiResponse.status === 429 ? 'Rate limit exceeded' : 'AI service error'}`);
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices[0].message.content;
    
    // Strip markdown code blocks if present
    rawContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const questionsData = JSON.parse(rawContent);

    // Create mock paper
    const { data: paper, error: paperError } = await supabase
      .from("mock_papers")
      .insert({
        course_id: courseId,
        user_id: user.id,
        title,
        question_type: questionType,
        total_marks: totalMarks,
        duration_minutes: duration,
      })
      .select()
      .single();

    if (paperError) throw paperError;

    // Insert questions
    for (const q of questionsData.questions) {
      await supabase.from("questions").insert({
        mock_paper_id: paper.id,
        question_text: q.text,
        question_type: questionType,
        marks: q.marks,
        options: questionType === "mcq" ? q.options : null,
        correct_answer: questionType === "long_answer" ? q.answer : null,
        concept_tags: [q.concept],
      });
    }

    return new Response(
      JSON.stringify({ success: true, paperId: paper.id }),
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
