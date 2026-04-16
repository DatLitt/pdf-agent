const ALLOWED_OPERATIONS = new Set([
  "merge",
  "split",
  "insert",
  "delete",
  "reorder",
]);

const PREVIOUS_OUTPUT_TOKEN = "__previous__";

const isPositiveInteger = (value) =>
  Number.isInteger(value) && value > 0;

const isSplitRange = (range) =>
  Array.isArray(range) &&
  range.length === 2 &&
  Number.isInteger(range[0]) &&
  Number.isInteger(range[1]) &&
  range[0] > 0 &&
  range[1] >= range[0];

const validateOptions = (operation, options = {}) => {
  if (typeof options !== "object" || Array.isArray(options)) {
    throw new Error("Action options must be an object");
  }

  if (operation === "split") {
    const { ranges } = options;

    if (!Array.isArray(ranges) || ranges.length === 0) {
      throw new Error("Split requires options.ranges");
    }

    for (const range of ranges) {
      if (!isSplitRange(range)) {
        throw new Error("Split ranges must be [start, end] integer pairs");
      }
    }
  }

  if (operation === "insert") {
    const { position } = options;

    if (!isPositiveInteger(position)) {
      throw new Error("Insert requires options.position as a positive integer");
    }
  }

  if (operation === "delete" || operation === "reorder") {
    const { pages } = options;

    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error(`${operation} requires options.pages`);
    }
  }
};

const validateStepFiles = (stepFiles, uploadedFiles, allowPrevious) => {
  if (!Array.isArray(stepFiles) || stepFiles.length === 0) {
    throw new Error("Each step must include files");
  }

  if (stepFiles.length > 2) {
    throw new Error("Each step cannot reference more than 2 files");
  }

  const availableFiles = (uploadedFiles || []).map((file) => file.fileId);

  let previousCount = 0;

  for (const fileName of stepFiles) {
    if (fileName === PREVIOUS_OUTPUT_TOKEN) {
      previousCount += 1;
      if (!allowPrevious) {
        throw new Error("The first step cannot reference the previous output");
      }
      continue;
    }

    if (!availableFiles.includes(fileName)) {
      throw new Error(`Unknown file referenced by action: ${fileName}`);
    }
  }

  if (previousCount > 1) {
    throw new Error("A step can reference the previous output only once");
  }
};

const validateStep = (step, uploadedFiles, allowPrevious) => {
  if (!step || typeof step !== "object" || Array.isArray(step)) {
    throw new Error("Each workflow step must be an object");
  }

  const { operation, files, options = {} } = step;

  if (!ALLOWED_OPERATIONS.has(operation)) {
    throw new Error(`Unsupported operation: ${operation}`);
  }

  validateStepFiles(files, uploadedFiles, allowPrevious);
  validateOptions(operation, options);

  if (operation === "merge" && files.length !== 2) {
    throw new Error("Merge requires exactly 2 files");
  }

  if (
    (operation === "split" ||
      operation === "delete" ||
      operation === "reorder") &&
    files.length !== 1
  ) {
    throw new Error(`${operation} requires exactly 1 file`);
  }

  if (operation === "insert" && files.length !== 2) {
    throw new Error("Insert requires exactly 2 files");
  }
};

export function validatePdfAction(action, uploadedFiles = []) {
  if (!action || typeof action !== "object") {
    throw new Error("Invalid action payload");
  }

  if (!Array.isArray(action.steps) || action.steps.length === 0) {
    throw new Error("Action must include a non-empty steps array");
  }

  if (action.steps.length > 10) {
    throw new Error("Action cannot contain more than 10 steps");
  }

  action.steps.forEach((step, index) => {
    validateStep(step, uploadedFiles, index > 0);
  });

  return action;
}

export { PREVIOUS_OUTPUT_TOKEN };
