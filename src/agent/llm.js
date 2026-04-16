import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const mergeStepSchema = {
  type: "object",
  properties: {
    operation: {
      type: "string",
      const: "merge",
    },
    files: {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 2,
      maxItems: 2,
    },
    options: {
      type: "object",
      additionalProperties: true,
    },
  },
  required: ["operation", "files", "options"],
  additionalProperties: false,
};

const splitStepSchema = {
  type: "object",
  properties: {
    operation: {
      type: "string",
      const: "split",
    },
    files: {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 1,
      maxItems: 1,
    },
    options: {
      type: "object",
      properties: {
        ranges: {
          type: "array",
          items: {
            type: "array",
            items: {
              type: "integer",
            },
            minItems: 2,
            maxItems: 2,
          },
          minItems: 1,
        },
      },
      required: ["ranges"],
      additionalProperties: false,
    },
  },
  required: ["operation", "files", "options"],
  additionalProperties: false,
};

const insertStepSchema = {
  type: "object",
  properties: {
    operation: {
      type: "string",
      const: "insert",
    },
    files: {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 2,
      maxItems: 2,
    },
    options: {
      type: "object",
      properties: {
        position: {
          type: "integer",
          minimum: 1,
        },
      },
      required: ["position"],
      additionalProperties: false,
    },
  },
  required: ["operation", "files", "options"],
  additionalProperties: false,
};

const pageListStepSchema = (operation) => ({
  type: "object",
  properties: {
    operation: {
      type: "string",
      const: operation,
    },
    files: {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 1,
      maxItems: 1,
    },
    options: {
      type: "object",
      properties: {
        pages: {
          type: "array",
          items: {
            type: "integer",
            minimum: 1,
          },
          minItems: 1,
        },
      },
      required: ["pages"],
      additionalProperties: false,
    },
  },
  required: ["operation", "files", "options"],
  additionalProperties: false,
});

const workflowSchema = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        oneOf: [
          mergeStepSchema,
          splitStepSchema,
          insertStepSchema,
          pageListStepSchema("delete"),
          pageListStepSchema("reorder"),
        ],
      },
      minItems: 1,
      maxItems: 10,
    },
  },
  required: ["steps"],
  additionalProperties: false,
};

export async function parsePdfAction(prompt, files = [], context = {}) {
  const fileEntries = (context.files || files).map(
    (file) => `${file.fileId || file.originalname || file}: ${file.originalname || file}`
  );
  const feedback = context.feedback ? `\nPrevious error: ${context.feedback}` : "";
  const lastAction = context.lastAction
    ? `\nPrevious action: ${JSON.stringify(context.lastAction)}`
    : "";

  const systemPrompt = `
You are a PDF action planner.
Return ONLY valid JSON.
Allowed operations: merge, split, insert, delete, reorder.

Return a workflow object with this shape:
{
  "steps": [
    {
      "operation": "merge",
      "files": ["file1.pdf", "file2.pdf"],
      "options": {}
    }
  ]
}

Workflow rules:
- "steps" must contain 1 to 10 actions
- Each step must follow the existing action rules
- A step can reference the previous step output by using "__previous__" in files
- Use "__previous__" only when chaining a later step from a prior step output
- Do not use "__previous__" in the first step
- If a step is split, it should usually be the last step because it returns multiple PDFs

Rules:
- Never return markdown or extra text.
- Files must be referenced only by their IDs: file_1, file_2.
- Do not use original file names in the workflow.
- Never mention files not provided.
- Never assume more than 2 files.
- If the operation is merge or insert, use exactly 2 files.
- If the operation is split, delete, or reorder, use exactly 1 file.
- If no options are needed, use an empty object.

Examples:
{"steps":[{"operation":"merge","files":["file1.pdf","file2.pdf"],"options":{}},{"operation":"merge","files":["__previous__","file1.pdf"],"options":{}}]}
{"steps":[{"operation":"split","files":["file1.pdf"],"options":{"ranges":[[1,3],[5,6]]}}]}
{"steps":[{"operation":"insert","files":["file1.pdf","file2.pdf"],"options":{"position":2}}]}
{"steps":[{"operation":"delete","files":["file1.pdf"],"options":{"pages":[2,4]}}]}
{"steps":[{"operation":"reorder","files":["file1.pdf"],"options":{"pages":[3,1,2]}}]}
`;

  const userPrompt = `
User prompt: ${prompt}
Available files:
${fileEntries.join("\n")}
${feedback}${lastAction}
`;

  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "user", parts: [{ text: userPrompt }] },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: workflowSchema,
      temperature: 0,
    },
  });

  const rawText = result.text?.trim() || "";

  if (!rawText) {
    throw new Error("LLM returned an empty response");
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error("LLM returned invalid JSON");
  }
}
