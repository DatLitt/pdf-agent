import { useMemo, useState } from "react";

const examples = [
  "merge these PDFs",
  "split the first PDF into pages 1-2 and 3-4",
  "insert the second PDF into the first at page 2",
  "delete pages 2 and 4 from the first PDF",
  "reorder the first PDF pages as 3,1,2",
];

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("Idle");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && files.length > 0, [prompt, files]);

  const handleFileChange = (event) => {
    const selected = Array.from(event.target.files || []).slice(0, 2);
    setFiles(selected);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await runRequest("/execute", "Running agent...");
  };

  const runRequest = async (endpoint, busyLabel) => {
    setBusy(true);
    setStatus(busyLabel);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("prompt", prompt);

      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        const errorBody = contentType.includes("application/json")
          ? await response.json()
          : { error: await response.text() };
        throw new Error(errorBody.error || "Request failed");
      }

      if (contentType.includes("application/json")) {
        const data = await response.json();
        setResult({ type: "json", data });
        setStatus("Done");
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const disposition = response.headers.get("content-disposition") || "";
        const filenameMatch = disposition.match(/filename="([^"]+)"/i);
        const downloadName = filenameMatch?.[1] || (contentType.includes("zip") ? "result.zip" : "result.pdf");

        setResult({ type: "file", url, downloadName });
        setStatus("Done");
      }
    } catch (error) {
      setStatus("Error");
      setResult({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell">
      <div className="glow glow-a" />
      <div className="glow glow-b" />

      <main className="card">
        <section className="hero">
          <p className="eyebrow">PDF Agent</p>
          <h1>Prompt-driven PDF editing, with a clean React UI.</h1>
          <p className="subhead">
            Upload up to 2 PDFs, describe the change in plain English, and let the backend pick the right PDF action.
          </p>
        </section>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: merge these PDFs"
              rows={5}
            />
          </label>

          <div className="chips">
            {examples.map((item) => (
              <button
                key={item}
                type="button"
                className="chip"
                onClick={() => setPrompt(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="field">
            <span>PDF files</span>
            <input type="file" accept=".pdf" multiple onChange={handleFileChange} />
          </label>

          <div className="file-list">
            {files.length === 0 ? (
              <p>No files selected.</p>
            ) : (
              files.map((file) => <div key={`${file.name}-${file.size}`}>{file.name}</div>)
            )}
          </div>

          <button className="button" type="submit" disabled={!canSubmit || busy}>
            {busy ? "Working..." : "Run Agent"}
          </button>
        </form>

        <section className="status">
          <div>
            <span className="status-label">Status</span>
            <strong>{status}</strong>
          </div>

          {result?.type === "file" && (
            <a className="download" href={result.url} download={result.downloadName}>
              Download {result.downloadName}
            </a>
          )}

          {result?.type === "json" && (
            <pre className="result-json">{JSON.stringify(result.data, null, 2)}</pre>
          )}

          {result?.type === "error" && <p className="error">{result.message}</p>}
        </section>
      </main>
    </div>
  );
}
