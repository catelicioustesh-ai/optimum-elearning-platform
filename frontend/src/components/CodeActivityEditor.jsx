import { useState } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor/editor.api.js'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import 'monaco-editor/languages/definitions/javascript/register.js'
import 'monaco-editor/languages/definitions/python/register.js'
import 'monaco-editor/languages/definitions/html/register.js'
import { CircleCheckBig, Eye, Play, RotateCcw, Send } from 'lucide-react'
import { api } from '../lib/api.js'

globalThis.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new JsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'typescript':
      case 'javascript':
        return new TsWorker()
      default:
        return new EditorWorker()
    }
  },
}

loader.config({ monaco })

const LANGUAGE_LABELS = {
  javascript: 'JavaScript',
  python: 'Python',
  html: 'HTML',
}

const MAX_RUN_CODE_LENGTH = 20_000
const MAX_SUBMISSION_CODE_LENGTH = 50_000
const HTML_PREVIEW_POLICY = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; media-src data:; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; navigate-to \'none\'">'

export default function CodeActivityEditor({ activity, onSubmitted }) {
  const language = activity.language
  const [code, setCode] = useState(activity.starter_code || '')
  const [output, setOutput] = useState(null)
  const [previewHtml, setPreviewHtml] = useState(null)
  const [testResults, setTestResults] = useState(null)
  const [status, setStatus] = useState('')
  const [isError, setIsError] = useState(false)
  const [busy, setBusy] = useState(false)
  const codeIsBlank = !code.trim()
  const runCodeIsTooLong = code.length > MAX_RUN_CODE_LENGTH
  const submissionIsTooLong = code.length > MAX_SUBMISSION_CODE_LENGTH

  function handleCodeChange(value) {
    setCode(value ?? '')
    setOutput(null)
    setTestResults(null)
    setPreviewHtml(null)
    setStatus('')
    setIsError(false)
  }

  async function handleRun() {
    setBusy(true)
    setOutput(null)
    setStatus('')
    setIsError(false)
    try {
      setOutput(await api.post('/execute/run/', { language, code }))
    } catch (err) {
      setOutput({ error: err.message })
    } finally {
      setBusy(false)
    }
  }

  function handlePreview() {
    setPreviewHtml(code)
    setOutput(null)
    setTestResults(null)
    setStatus('')
  }

  function handleReset() {
    setCode(activity.starter_code || '')
    setOutput(null)
    setPreviewHtml(null)
    setTestResults(null)
    setStatus('')
    setIsError(false)
  }

  async function handleRunTests() {
    setBusy(true)
    setTestResults(null)
    setStatus('')
    try {
      setTestResults(await api.post('/execute/test/', { language, code, activity_id: activity.id }))
    } catch (err) {
      setTestResults({ error: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit() {
    setBusy(true)
    setStatus('')
    try {
      await api.post('/submissions/', { activity: activity.id, content: code })
      setIsError(false)
      setStatus('Submitted! Your instructor will grade it.')
      onSubmitted?.()
    } catch (err) {
      setIsError(true)
      setStatus(err.status === 429 ? 'You are submitting too quickly. Please wait a moment.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!LANGUAGE_LABELS[language]) {
    return (
      <div className="rounded-lg border border-rose-800 bg-[#3b1d1d] p-4 text-sm text-rose-200" role="alert">
        This activity uses an unsupported coding language. Ask your instructor to update its language setting.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#30363d] bg-[#1e1e1e] text-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#30363d] bg-[#252526] px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-[#cccccc]">
          <span className="h-2 w-2 rounded-full bg-[#4ec9b0]" />
          <span>{activity.title}</span>
          <span className="text-[#858585]">· {LANGUAGE_LABELS[language]}</span>
        </div>
        <span className="text-[11px] text-[#858585]">Language · configured by instructor</span>
      </div>

      <Editor
        height="380px"
        path={`activities/${activity.id}.${language === 'python' ? 'py' : language === 'html' ? 'html' : 'js'}`}
        language={language}
        value={code}
        onChange={handleCodeChange}
        theme="vs-dark"
        loading={<div className="px-4 py-6 text-sm text-[#858585]">Loading code editor…</div>}
        options={{
          automaticLayout: true,
          readOnly: busy,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          tabSize: language === 'python' ? 4 : 2,
          insertSpaces: true,
          autoIndent: 'full',
          formatOnPaste: true,
          bracketPairColorization: { enabled: true },
          padding: { top: 12, bottom: 12 },
        }}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-[#30363d] bg-[#252526] px-3 py-2">
        {language === 'html' ? (
          <button onClick={handlePreview} disabled={busy || codeIsBlank || submissionIsTooLong} className="flex items-center gap-1.5 rounded-md bg-[#0e639c] px-3 py-1.5 text-sm font-medium hover:bg-[#1177bb] disabled:opacity-60">
            <Eye size={14} /> Preview
          </button>
        ) : (
          <>
            <button onClick={handleRun} disabled={busy || codeIsBlank || runCodeIsTooLong} className="flex items-center gap-1.5 rounded-md bg-[#0e639c] px-3 py-1.5 text-sm font-medium hover:bg-[#1177bb] disabled:opacity-60">
              <Play size={14} /> {busy ? 'Running…' : 'Run'}
            </button>
            <button onClick={handleRunTests} disabled={busy || codeIsBlank || runCodeIsTooLong} className="flex items-center gap-1.5 rounded-md border border-[#555] px-3 py-1.5 text-sm text-[#ddd] hover:bg-[#333] disabled:opacity-60">
              <CircleCheckBig size={14} /> {busy ? 'Working…' : 'Run tests'}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={handleReset}
          disabled={busy || code === (activity.starter_code || '')}
          title="Restore the instructor-provided starter code"
          className="flex items-center gap-1.5 rounded-md border border-[#555] px-3 py-1.5 text-sm text-[#ddd] hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw size={14} /> Reset to starter
        </button>
        <button onClick={handleSubmit} disabled={busy || codeIsBlank || submissionIsTooLong} className="ml-auto flex items-center gap-1.5 rounded-md bg-coral px-3 py-1.5 text-sm font-medium text-white hover:bg-coral-dim disabled:opacity-60">
          <Send size={14} /> {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>
      {(codeIsBlank || runCodeIsTooLong || submissionIsTooLong) && (
        <ul className="space-y-1 border-t border-[#30363d] px-4 py-2 text-xs text-[#f48771]" role="status">
          {codeIsBlank && <li>Enter code before running, testing, or submitting.</li>}
          {runCodeIsTooLong && <li>Code is over the {MAX_RUN_CODE_LENGTH.toLocaleString()}-character run limit.</li>}
          {submissionIsTooLong && <li>Code is over the {MAX_SUBMISSION_CODE_LENGTH.toLocaleString()}-character limit.</li>}
        </ul>
      )}

      {previewHtml !== null && (
        <section className="border-t border-[#30363d] bg-[#1e1e1e]">
          <h3 className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#858585]">HTML preview · scripts and external resources blocked</h3>
          <iframe
            title={`${activity.title} HTML preview`}
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={`${HTML_PREVIEW_POLICY}${previewHtml}`}
            className="h-80 w-full border-0 bg-white"
          />
        </section>
      )}

      {(output || testResults || status) && (
        <div className="space-y-3 border-t border-[#30363d] bg-[#1e1e1e] p-4 text-sm">
          {output && (
            <div aria-live="polite">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#858585]">Terminal</p>
              {output.error ? (
                <pre className="whitespace-pre-wrap font-mono text-xs text-[#f48771]">{output.error}</pre>
              ) : (
                <div className="font-mono text-xs">
                  {output.timed_out && <p className="mb-1 text-[#f48771]">Stopped: your code ran too long (time limit).</p>}
                  {output.stdout && <pre className="whitespace-pre-wrap text-[#d4d4d4]">{output.stdout}</pre>}
                  {output.stderr && <pre className="whitespace-pre-wrap text-[#f48771]">{output.stderr}</pre>}
                  {!output.stdout && !output.stderr && !output.timed_out && <span className="text-[#858585]">(no output)</span>}
                </div>
              )}
            </div>
          )}

          {testResults && (
            <div aria-live="polite">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#858585]">Tests</p>
              {testResults.error ? (
                <span className="text-[#f48771]">{testResults.error}</span>
              ) : (
                <>
                  <p className="font-semibold text-[#d4d4d4]">{testResults.passed} of {testResults.total} tests passed</p>
                  <ul className="mt-2 space-y-1.5">
                    {testResults.results.map((result) => (
                      <li key={result.index} className={result.passed ? 'text-[#89d185]' : 'text-[#f48771]'}>
                        Test {result.index}: {result.passed ? 'passed' : result.timed_out ? 'timed out' : 'failed'}
                        {result.expected_output !== undefined && !result.passed && (
                          <span className="block font-mono text-xs text-[#aaa]">expected “{result.expected_output}” · got “{result.actual_output}”</span>
                        )}
                        {result.error && <span className="block whitespace-pre-wrap font-mono text-xs">{result.error}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {status && <p role={isError ? 'alert' : 'status'} className={isError ? 'text-[#f48771]' : 'text-[#89d185]'}>{status}</p>}
        </div>
      )}
    </div>
  )
}
