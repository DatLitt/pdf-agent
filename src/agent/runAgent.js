import { parsePdfAction } from "./llm.js";
import {
  PREVIOUS_OUTPUT_TOKEN,
  validatePdfAction,
} from "./validateAction.js";
import { executePdfAction } from "../tools/runTool.js";

export const MAX_AGENT_STEPS = 10;
const MAX_VALIDATION_RETRIES = 2;

export function assertAgentStepLimit(stepCount) {
  if (!Number.isInteger(stepCount) || stepCount < 0) {
    throw new Error("Step count must be a non-negative integer");
  }

  if (stepCount >= MAX_AGENT_STEPS) {
    throw new Error(`Agent step limit reached (${MAX_AGENT_STEPS})`);
  }
}

const isGeminiQuotaError = (error) => {
  const message = String(error?.message || "");

  return (
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("Quota exceeded") ||
    message.includes("429") ||
    message.includes("503") ||
    message.includes("UNAVAILABLE")
  );
};

const getUploadedFileMap = (files) => {
  const map = new Map();

  for (const file of files || []) {
    map.set(file.fileId, file);
  }

  return map;
};

const normalizeFiles = (files = []) =>
  files.map((file, index) => ({
    ...file,
    fileId: `file_${index + 1}`,
  }));

const resolveStepFiles = (stepFiles, uploadedFiles, previousOutputFile) => {
  const uploadedFileMap = getUploadedFileMap(uploadedFiles);

  return stepFiles.map((fileName) => {
    if (fileName === PREVIOUS_OUTPUT_TOKEN) {
      if (!previousOutputFile) {
        throw new Error("Previous output is not available for this step");
      }

      return previousOutputFile;
    }

    const file = uploadedFileMap.get(fileName);

    if (!file) {
      throw new Error(`Unknown file referenced by step: ${fileName}`);
    }

    return file;
  });
};

const executeWorkflow = async (workflow, uploadedFiles) => {
  let previousOutputFile = null;
  let lastOutput = null;
  const tempOutputs = [];
  const cleanupPaths = (uploadedFiles || []).map((file) => file.path);

  for (let index = 0; index < workflow.steps.length; index += 1) {
    const step = workflow.steps[index];
    console.log(`Executing step ${index + 1}/${workflow.steps.length}`);

    const stepFiles = resolveStepFiles(
      step.files,
      uploadedFiles,
      previousOutputFile
    );

    const output = await executePdfAction(step, stepFiles);

    if (Array.isArray(output)) {
      if (index !== workflow.steps.length - 1) {
        throw new Error("Split can only be the last step in a workflow");
      }

      return {
        action: workflow,
        output,
        stepsUsed: workflow.steps.length,
        cleanupPaths,
      };
    }

    previousOutputFile = {
      originalname: `step-${index + 1}.pdf`,
      filename: `step-${index + 1}.pdf`,
      path: output,
    };
    tempOutputs.push(output);
    lastOutput = output;
  }

  if (tempOutputs.length > 1) {
    cleanupPaths.push(...tempOutputs.slice(0, -1));
  }

  return {
    action: workflow,
    output: lastOutput,
    stepsUsed: workflow.steps.length,
    cleanupPaths,
  };
};

export async function runPdfAgent(prompt, files = []) {
  const normalizedFiles = normalizeFiles(files);
  let feedback = "";
  let lastAction = null;

  for (let attempt = 0; attempt < MAX_AGENT_STEPS; attempt += 1) {
    assertAgentStepLimit(attempt);
    let workflow = null;

    try {
      console.log(`Agent attempt ${attempt + 1}/${MAX_AGENT_STEPS}`);

      workflow = await parsePdfAction(prompt, files, {
        feedback,
        lastAction,
        attempt,
        files: normalizedFiles,
      });

      console.log("LLM workflow:", JSON.stringify(workflow, null, 2));

      validatePdfAction(workflow, normalizedFiles);
      return await executeWorkflow(workflow, normalizedFiles);
    } catch (error) {
      console.log(`Agent attempt ${attempt + 1} failed: ${error.message}`);

      if (isGeminiQuotaError(error)) {
        throw new Error(
          "Gemini rate limit or quota reached. Please wait and try again."
        );
      }

      feedback = error.message;
      if (workflow) {
        lastAction = workflow;
      }

      const isValidationIssue =
        error.message.includes("Action must") ||
        error.message.includes("requires") ||
        error.message.includes("Unsupported operation") ||
        error.message.includes("Unknown file referenced") ||
        error.message.includes("Split ranges must") ||
        error.message.includes("Each workflow step must");

      if (isValidationIssue && attempt >= MAX_VALIDATION_RETRIES - 1) {
        throw new Error(
          `Agent failed after ${attempt + 1} attempts: ${error.message}`
        );
      }

      if (attempt === MAX_AGENT_STEPS - 1) {
        throw new Error(
          `Agent failed after ${MAX_AGENT_STEPS} attempts: ${error.message}`
        );
      }
    }
  }

  throw new Error(`Agent failed after ${MAX_AGENT_STEPS} attempts`);
}
