import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'
import { CircleCheckBig, Eye, Play, RotateCcw, Send } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'

const LANGUAGE_LABELS = {
  javascript: 'JavaScript',
  python: 'Python',
  html: 'HTML',
  c: 'C',
  cpp: 'C++',
  java: 'Java',
}

const LANGUAGE_EXTENSION_LOADERS = {
  javascript: () => import('@codemirror/lang-javascript').then(({ javascript }) => javascript()),
  python: () => import('@codemirror/lang-python').then(({ python }) => python()),
  html: () => import('@codemirror/lang-html').then(({ html }) => html()),
  c: () => import('@codemirror/lang-cpp').then(({ cpp }) => cpp()),
  cpp: () => import('@codemirror/lang-cpp').then(({ cpp }) => cpp()),
  java: () => import('@codemirror/lang-java').then(({ java }) => java()),
}

const MAX_RUN_CODE_LENGTH = 20_000
const MAX_SUBMISSION_CODE_LENGTH = 50_000
const RUNNER_UNAVAILABLE_MESSAGE = 'Your code could not run because the isolated runner is unavailable. You can still submit your code for grading; Run and Run tests will work once the runner is started and configured.'
const HTML_PREVIEW_POLICY = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; media-src data:; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; navigate-to \'none\'">'

function restoreCodeDraft(key, starterCode) {
  try {
    const savedCode = sessionStorage.getItem(key)
    return {
      code: savedCode ?? starterCode,
      status: savedCode === null ? 'Autosave ready.' : 'Draft restored from this tab.',
    }
  } catch {
    return {
      code: starterCode,
      status: 'Autosave is unavailable in this browser tab. Keep this lesson open to avoid losing your code.',
    }
  }
}

export default function CodeActivityEditor({ activity, onSubmitted }) {
  const language = activity.language
  const { auth } = useAuth()
  const draftKey = `optimum-lms:activity-draft:${encodeURIComponent(auth?.email?.toLowerCase() || 'guest')}:${activity.id}`
  const [initialDraft] = useState(() => restoreCodeDraft(draftKey, activity.starter_code || ''))
  const [code, setCode] = useState(initialDraft.code)
  const [draftStatus, setDraftStatus] = useState(initialDraft.status)
  const [output, setOutput] = useState(null)
  const [previewHtml, setPreviewHtml] = useState(null)
  const [testResults, setTestResults] = useState(null)
  const [languageEditor, setLanguageEditor] = useState(null)
  const [status, setStatus] = useState('')
  const [isError, setIsError] = useState(false)
  const [busy, setBusy] = useState(false)
  const codeIsBlank = !code.trim()
  const runCodeIsTooLong = code.length > MAX_RUN_CODE_LENGTH
  const submissionIsTooLong = code.length > MAX_SUBMISSION_CODE_LENGTH

  useEffect(() => {
    let cancelled = false
    LANGUAGE_EXTENSION_LOADERS[language]()
      .then((extension) => {
        if (!cancelled) setLanguageEditor({ language, extension })
      })
      .catch((error) => {
        if (!cancelled) {
          setLanguageEditor({
            language,
            error: error?.message || 'Could not load this language editor.',
          })
        }
      })
    return () => { cancelled = true }
  }, [language])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        if (code) sessionStorage.setItem(draftKey, code)
        else sessionStorage.removeItem(draftKey)
        setDraftStatus('Draft saved on this device.')
      } catch {
        setDraftStatus('Could not save your draft on this device. Keep this lesson open and copy your code as a backup.')
      }
    }, 350)
    return () => window.clearTimeout(timeoutId)
  }, [code, draftKey])

  function handleCodeChange(value) {
    setCode(value ?? '')
    setDraftStatus('Saving draft…')
    setOutput(null)
    setTestResults(null)
    setPreviewHtml(null)
    setStatus('')
    setIsError(false)
  }

  async function handleRun() {
    setBusy(true)
    setOutput(null)
    setTestResults(null)
    setPreviewHtml(null)
    setStatus('')
    setIsError(false)
    try {
      setOutput(await api.post('/execute/run/', { language, code }))
    } catch (err) {
      setOutput({ error: err.code === 'CODE_RUNNER_UNAVAILABLE' ? RUNNER_UNAVAILABLE_MESSAGE : err.message })
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
    if (code !== (activity.starter_code || '') && !window.confirm('Discard your current code and restore the instructor-provided starter code?')) return
    setCode(activity.starter_code || '')
    setDraftStatus('Saving draft…')
    setOutput(null)
    setPreviewHtml(null)
    setTestResults(null)
    setStatus('')
    setIsError(false)
  }

  async function handleRunTests() {
    setBusy(true)
    setOutput(null)
    setTestResults(null)
    setPreviewHtml(null)
    setStatus('')
    try {
      setTestResults(await api.post('/execute/test/', { language, code, activity_id: activity.id }))
    } catch (err) {
      setTestResults({ error: err.code === 'CODE_RUNNER_UNAVAILABLE' ? RUNNER_UNAVAILABLE_MESSAGE : err.message })
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit() {
    setBusy(true)
    setOutput(null)
    setTestResults(null)
    setPreviewHtml(null)
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
    <div className="code-activity-editor overflow-hidden rounded-xl border border-[#30363d] bg-[#1e1e1e] text-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#30363d] bg-[#252526] px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-[#cccccc]">
          <span className="h-2 w-2 rounded-full bg-[#4ec9b0]" />
          <span>{activity.title}</span>
          <span className="text-[#858585]">· {LANGUAGE_LABELS[language]}</span>
        </div>
        <span className="text-[11px] text-[#858585]">Language · configured by instructor</span>
      </div>

      {languageEditor?.language === language && languageEditor.extension ? (
        <CodeMirror
          height="380px"
          value={code}
          onChange={handleCodeChange}
          theme={oneDark}
          extensions={[
            languageEditor.extension,
            EditorView.lineWrapping,
            EditorState.tabSize.of(language === 'python' ? 4 : 2),
          ]}
          readOnly={busy}
          editable={!busy}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            indentOnInput: true,
          }}
          className="code-mirror-editor"
          style={{ fontSize: 14 }}
          editorProps={{ 'aria-label': `${LANGUAGE_LABELS[language]} code editor` }}
        />
      ) : (
        <div
          className={`min-h-[380px] px-4 py-6 text-sm ${languageEditor?.language === language && languageEditor.error ? 'text-rose-300' : 'text-[#858585]'}`}
          role={languageEditor?.language === language && languageEditor.error ? 'alert' : 'status'}
        >
          {languageEditor?.language === language && languageEditor.error
            ? languageEditor.error
            : 'Loading code editor…'}
        </div>
      )}

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
      <p className="editor-muted border-t border-[#30363d] px-4 py-2 text-xs" role="status" aria-live="polite">
        {draftStatus}
      </p>
      {(codeIsBlank || runCodeIsTooLong || submissionIsTooLong) && (
        <ul className="editor-error space-y-1 border-t border-[#30363d] px-4 py-2 text-xs" role="status">
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
              <p className="editor-muted mb-1 text-xs font-semibold uppercase tracking-wide">Terminal</p>
              {output.error ? (
                <pre className="whitespace-pre-wrap font-mono text-xs text-[#f48771]">{output.error}</pre>
              ) : (
                <div className="font-mono text-xs">
                  {output.timed_out && <p className="editor-error mb-1">Stopped: your code ran too long (time limit).</p>}
                  {output.stdout && <pre className="whitespace-pre-wrap text-[#d4d4d4]">{output.stdout}</pre>}
                  {output.stderr && <pre className="whitespace-pre-wrap text-[#f48771]">{output.stderr}</pre>}
                  {!output.stdout && !output.stderr && !output.timed_out && <span className="editor-muted">(no output)</span>}
                </div>
              )}
            </div>
          )}

          {testResults && (
            <div aria-live="polite">
              <p className="editor-muted mb-1 text-xs font-semibold uppercase tracking-wide">Tests</p>
              {testResults.error ? (
                <span className="editor-error">{testResults.error}</span>
              ) : (
                <>
                  <p className="font-semibold">{testResults.passed} of {testResults.total} tests passed</p>
                  <ul className="mt-2 space-y-1.5">
                    {testResults.results.map((result) => (
                      <li key={result.index} className={result.passed ? 'editor-success' : 'editor-error'}>
                        Test {result.index}: {result.passed ? 'passed' : result.timed_out ? 'timed out' : 'failed'}
                        {result.expected_output !== undefined && !result.passed && (
                          <span className="editor-subtle block font-mono text-xs">expected “{result.expected_output}” · got “{result.actual_output}”</span>
                        )}
                        {result.error && <span className="block whitespace-pre-wrap font-mono text-xs">{result.error}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {status && <p role={isError ? 'alert' : 'status'} className={isError ? 'editor-error' : 'editor-success'}>{status}</p>}
        </div>
      )}
    </div>
  )
}
