import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { LayoutDashboard, BookOpen, FileCheck, Users, Upload, Plus, FileText, ChevronUp, ChevronDown, Trash2, Eye, CirclePlus, CalendarDays } from 'lucide-react'
import LessonVideo from '../components/LessonVideo.jsx'
import DashboardLayout from '../components/DashboardLayout.jsx'
import ExpandableList from '../components/ExpandableList.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'

const navItems = [
  { to: '/dashboard/instructor', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/instructor/content', label: 'Course Content', icon: BookOpen },
  { to: '/dashboard/instructor/submissions', label: 'Submissions', icon: FileCheck },
  { to: '/dashboard/instructor/students', label: 'Students', icon: Users },
]

export default function InstructorContent() {
  const { auth } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedCourseId = searchParams.get('course')

  const [courses, setCourses] = useState([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [courseListReload, setCourseListReload] = useState(0)
  const [courseId, setCourseId] = useState('')
  const [newCourse, setNewCourse] = useState({ title: '', description: '' })
  const [courseEdit, setCourseEdit] = useState({ title: '', description: '' })
  const [liveSessions, setLiveSessions] = useState([])
  const [newLiveSession, setNewLiveSession] = useState({ title: '', starts_at: '', meeting_url: '' })
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [courseCoverFile, setCourseCoverFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState('')

  const [modules, setModules] = useState([])
  const [moduleId, setModuleId] = useState('')
  const [newModuleTitle, setNewModuleTitle] = useState('')

  const [lessons, setLessons] = useState([])
  const [lessonId, setLessonId] = useState('')
  const [newLesson, setNewLesson] = useState({ title: '', video_url: '', learning_objectives: '', tutorial_content: '' })
  const [newLessonVideoFile, setNewLessonVideoFile] = useState(null)

  const [attachments, setAttachments] = useState([])
  const [pdfTitle, setPdfTitle] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [activityDraft, setActivityDraft] = useState({ activity_type: 'assignment', title: '', instructions: '', max_score: 100, max_attempts: 1, pass_percentage: 50, is_required: true, deadline: '', language: 'javascript', starter_code: '', test_cases: '[]' })
  const [quizDraft, setQuizDraft] = useState({ title: '', instructions: '', time_limit_minutes: 30, pass_mark_percentage: 70, max_attempts: 1, is_required: true })
  const [quizQuestions, setQuizQuestions] = useState([{ text: '', marks: 1, choice_a: '', choice_b: '', correct_choice_index: 0 }])

  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([api.get('/dashboard/instructor/'), api.get('/courses/')])
      .then(([dashboard, allCourses]) => {
        if (cancelled) return
        const visibleIds = new Set((dashboard.my_courses || []).map((course) => course.id))
        const instructorCourses = allCourses.filter((course) => visibleIds.has(course.id))
        setCourses(instructorCourses)
        const requestedCourse = instructorCourses.find((course) => String(course.id) === requestedCourseId)
        if (requestedCourse) {
          setCourseId(requestedCourseId)
          setCourseEdit({ title: requestedCourse.title || '', description: requestedCourse.description || '' })
          setModuleId('')
          setModules([])
          setLessonId('')
          setLessons([])
          setVideoUrl('')
          setAttachments([])
          setLiveSessions([])
          Promise.all([
            api.get(`/courses/${requestedCourseId}/`),
            api.get(`/modules/?course=${requestedCourseId}`),
            api.get(`/live-sessions/?course=${requestedCourseId}`),
          ])
            .then(([detail, rows, sessions]) => {
              if (cancelled) return
              setCourses((items) => items.map((item) => item.id === detail.id ? detail : item))
              setCourseEdit({ title: detail.title, description: detail.description || '' })
              setModules(rows)
              setLiveSessions(sessions)
            })
            .catch((err) => {
              if (!cancelled) setError(err.message)
            })
        }
      })
      .catch((err) => {
        if (!cancelled) setError(`Unable to load your courses: ${err.message}`)
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false)
      })
    return () => { cancelled = true }
  }, [courseListReload, requestedCourseId])

  // Selecting a course/module/lesson is always a direct user action (a
  // <select> onChange or a list item onClick below), never a prop changing
  // out from under this component — so the "reset the downstream selection
  // and fetch its children" logic belongs in these handlers, not in an
  // effect reacting to state this same component just set.
  function handleSelectCourse(id) {
    setCourseId(id)
    setModuleId('')
    setModules([])
    setLessonId('')
    setLessons([])
    setVideoUrl('')
    setAttachments([])
    setLiveSessions([])
    if (!id) return
    const course = courses.find((item) => String(item.id) === String(id))
    setCourseEdit({ title: course?.title || '', description: course?.description || '' })
    Promise.all([
      api.get(`/courses/${id}/`),
      api.get(`/modules/?course=${id}`),
      api.get(`/live-sessions/?course=${id}`),
    ])
      .then(([detail, rows, sessions]) => {
        setCourses((items) => items.map((item) => item.id === detail.id ? detail : item))
        setCourseEdit({ title: detail.title, description: detail.description || '' })
        setModules(rows)
        setLiveSessions(sessions)
      })
      .catch((err) => setError(err.message))
  }

  function handleSelectModule(id) {
    setModuleId(id)
    setLessonId('')
    setLessons([])
    setVideoUrl('')
    setAttachments([])
    if (!id) return
    api.get(`/lessons/?module=${id}`).then(setLessons).catch((err) => setError(err.message))
  }

  function handleSelectLesson(lesson) {
    setLessonId(String(lesson.id))
    setVideoUrl(lesson.video_url || '')
    setNewLessonVideoFile(null)
    setAttachments(lesson.attachments || [])
    setNewLesson((current) => ({ ...current, title: lesson.title, video_url: lesson.video_url || '', tutorial_content: lesson.tutorial_content || '' }))
  }

  const selectedLesson = lessons.find((l) => String(l.id) === String(lessonId))

  useEffect(() => {
    // Genuinely synchronizing with an external system here: creating/
    // revoking a blob: object URL for the file picker preview. The cleanup
    // function (revoking the previous URL) is exactly the effect-cleanup
    // pattern effects exist for — this isn't derivable during render.
    if (!thumbnailFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThumbnailPreview('')
      return
    }

    const objectUrl = URL.createObjectURL(thumbnailFile)
    setThumbnailPreview(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [thumbnailFile])

  function flash(message) {
    setStatus(message)
    setError('')
    setTimeout(() => setStatus(''), 3000)
  }

  async function handleAddCourse(e) {
    e.preventDefault()
    if (!newCourse.title.trim()) return
    setBusy(true)
    try {
      let created
      if (thumbnailFile) {
        const formData = new FormData()
        formData.append('title', newCourse.title.trim())
        formData.append('description', newCourse.description.trim())
        formData.append('status', 'draft')
        formData.append('thumbnail', thumbnailFile)
        created = await api.upload('/courses/', formData)
      } else {
        created = await api.post('/courses/', {
          title: newCourse.title.trim(),
          description: newCourse.description.trim(),
          status: 'draft',
        })
      }

      setCourses((prev) => [...prev, created])
      handleSelectCourse(String(created.id))
      setNewCourse({ title: '', description: '' })
      setThumbnailFile(null)
      setThumbnailPreview('')
      e.target.reset()
      flash('Draft course created.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveCourse(e) {
    e.preventDefault()
    if (!courseId) return
    setBusy(true)
    try {
      let updated
      if (courseCoverFile) {
        const formData = new FormData()
        formData.append('title', courseEdit.title.trim())
        formData.append('description', courseEdit.description.trim())
        formData.append('thumbnail', courseCoverFile)
        updated = await api.put(`/courses/${courseId}/`, formData, { isFormData: true })
      } else {
        updated = await api.patch(`/courses/${courseId}/`, {
          title: courseEdit.title.trim(),
          description: courseEdit.description.trim(),
        })
      }
      setCourses((items) => items.map((item) => item.id === updated.id ? updated : item))
      setCourseCoverFile(null)
      flash('Course details saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function setCourseStatus(action) {
    if (!courseId) return
    setBusy(true)
    try {
      const updated = await api.post(`/courses/${courseId}/${action}/`)
      setCourses((items) => items.map((item) => item.id === updated.id ? updated : item))
      flash(action === 'publish' ? 'Course published.' : 'Changes saved as draft.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddLiveSession(event) {
    event.preventDefault()
    if (!courseId || !newLiveSession.title.trim() || !newLiveSession.starts_at || !newLiveSession.meeting_url.trim()) return
    setBusy(true)
    try {
      const created = await api.post('/live-sessions/', {
        course: Number(courseId),
        title: newLiveSession.title.trim(),
        starts_at: new Date(newLiveSession.starts_at).toISOString(),
        meeting_url: newLiveSession.meeting_url.trim(),
      })
      setLiveSessions((current) => [...current, created].sort(
        (left, right) => new Date(left.starts_at) - new Date(right.starts_at),
      ))
      setNewLiveSession({ title: '', starts_at: '', meeting_url: '' })
      flash('Live session scheduled. Enrolled instructor-led students will receive reminders.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteLiveSession(session) {
    if (!window.confirm(`Cancel “${session.title}”?`)) return
    setBusy(true)
    try {
      await api.del(`/live-sessions/${session.id}/`)
      setLiveSessions((current) => current.filter((item) => item.id !== session.id))
      flash('Live session cancelled.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteCourse() {
    const course = courses.find((item) => String(item.id) === String(courseId))
    if (!course || !window.confirm(`Delete “${course.title}” and all its course content? This cannot be undone.`)) return
    setBusy(true)
    try {
      await api.del(`/courses/${courseId}/`)
      setCourses((items) => items.filter((item) => String(item.id) !== String(courseId)))
      handleSelectCourse('')
      flash('Course deleted.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function moveItem(kind, index, direction) {
    const rows = kind === 'module' ? modules : lessons
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const ordered = [...rows]
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    setBusy(true)
    try {
      const saved = kind === 'module'
        ? await api.post('/modules/reorder/', { course: Number(courseId), module_ids: ordered.map((item) => item.id) })
        : await api.post(`/modules/${moduleId}/reorder-lessons/`, { lesson_ids: ordered.map((item) => item.id) })
      if (kind === 'module') setModules(saved)
      else setLessons(saved)
      flash(`${kind === 'module' ? 'Module' : 'Lesson'} order saved.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteModule(module) {
    if (!window.confirm(`Delete “${module.title}” and all its lessons and activities?`)) return
    setBusy(true)
    try {
      await api.del(`/modules/${module.id}/`)
      const remaining = await api.get(`/modules/?course=${courseId}`)
      setModules(remaining)
      if (String(moduleId) === String(module.id)) handleSelectModule('')
      flash('Module and its content deleted.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteLesson(lesson) {
    if (!window.confirm(`Delete “${lesson.title}” and its activities/resources?`)) return
    setBusy(true)
    try {
      await api.del(`/lessons/${lesson.id}/`)
      const remaining = await api.get(`/lessons/?module=${moduleId}`)
      setLessons(remaining)
      if (String(lessonId) === String(lesson.id)) {
        setLessonId('')
        setAttachments([])
      }
      flash('Lesson and its content deleted.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddModule(e) {
    e.preventDefault()
    if (!courseId || !newModuleTitle.trim()) return
    setBusy(true)
    try {
      const created = await api.post('/modules/', {
        course: courseId,
        title: newModuleTitle,
        order: Math.max(0, ...modules.map((module) => module.order)) + 1,
      })
      setModules([...modules, created])
      setNewModuleTitle('')
      flash('Module added.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddLesson(e) {
    e.preventDefault()
    if (!moduleId || !newLesson.title.trim()) return
    setBusy(true)
    try {
      let created
      if (newLessonVideoFile) {
        const formData = new FormData()
        formData.append('module', moduleId)
        formData.append('title', newLesson.title.trim())
        formData.append('order', String(Math.max(0, ...lessons.map((lesson) => lesson.order)) + 1))
        formData.append('learning_objectives', newLesson.learning_objectives)
        formData.append('tutorial_content', newLesson.tutorial_content)
        formData.append('video_file', newLessonVideoFile)
        created = await api.upload('/lessons/', formData)
      } else {
        created = await api.post('/lessons/', {
          module: moduleId,
          title: newLesson.title.trim(),
          order: Math.max(0, ...lessons.map((lesson) => lesson.order)) + 1,
          learning_objectives: newLesson.learning_objectives,
          video_url: newLesson.video_url,
          tutorial_content: newLesson.tutorial_content,
        })
      }
      setLessons((items) => [...items, created])
      setNewLesson({ title: '', video_url: '', learning_objectives: '', tutorial_content: '' })
      setNewLessonVideoFile(null)
      flash('Lesson added.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveVideoUrl(e) {
    e.preventDefault()
    if (!lessonId) return
    setBusy(true)
    try {
      const updated = await api.patch(`/lessons/${lessonId}/`, { video_url: videoUrl, ...(videoUrl ? { video_file: null } : {}) })
      setLessons(lessons.map((l) => (l.id === updated.id ? updated : l)))
      flash('Video link saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleUploadLessonVideo(e) {
    e.preventDefault()
    if (!lessonId || !newLessonVideoFile) return
    setBusy(true)
    try {
      const formData = new FormData()
      formData.append('video_url', '')
      formData.append('video_file', newLessonVideoFile)
      const updated = await api.upload(`/lessons/${lessonId}/`, formData)
      setLessons((items) => items.map((lesson) => lesson.id === updated.id ? updated : lesson))
      setVideoUrl('')
      setNewLessonVideoFile(null)
      e.target.reset()
      flash('Uploaded video saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleUploadPdf(e) {
    e.preventDefault()
    if (!lessonId || !pdfFile) return
    setBusy(true)
    try {
      const formData = new FormData()
      formData.append('lesson', lessonId)
      formData.append('title', pdfTitle || pdfFile.name)
      formData.append('file', pdfFile)
      const created = await api.upload('/lesson-attachments/', formData)
      setAttachments([...attachments, created])
      setPdfTitle('')
      setPdfFile(null)
      e.target.reset()
      flash('PDF uploaded and stored.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveLesson(e) {
    e.preventDefault()
    if (!lessonId) return
    setBusy(true)
    try {
      const updated = await api.patch(`/lessons/${lessonId}/`, {
        title: newLesson.title.trim(),
        learning_objectives: newLesson.learning_objectives,
        tutorial_content: newLesson.tutorial_content,
      })
      setLessons((items) => items.map((lesson) => lesson.id === updated.id ? updated : lesson))
      await refreshCourseModules()
      flash('Lesson details saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateActivity(e) {
    e.preventDefault()
    if (!lessonId || !activityDraft.title.trim()) return
    let testCases = null
    if (activityDraft.language !== 'html') {
      try {
        testCases = JSON.parse(activityDraft.test_cases || '[]')
        if (!Array.isArray(testCases)) throw new Error('Test cases must be a JSON array.')
      } catch {
        setError('Test cases must be valid JSON in an array.')
        return
      }
    }
    setBusy(true)
    try {
      await api.post('/activities/', {
        ...activityDraft,
        lesson: Number(lessonId),
        max_score: Number(activityDraft.max_score),
        max_attempts: Number(activityDraft.max_attempts),
        pass_percentage: Number(activityDraft.pass_percentage),
        deadline: activityDraft.deadline ? new Date(activityDraft.deadline).toISOString() : null,
        test_cases: activityDraft.activity_type === 'exercise' || activityDraft.activity_type === 'lab' ? testCases : null,
      })
      await refreshSelectedLesson()
      setActivityDraft((value) => ({ ...value, title: '', instructions: '', deadline: '', starter_code: '', test_cases: '[]' }))
      flash('Activity added.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateQuiz(e) {
    e.preventDefault()
    if (!lessonId || !quizDraft.title.trim()) return
    const questions = quizQuestions.map((question) => ({
      text: question.text.trim(),
      marks: Number(question.marks),
      choices: [question.choice_a, question.choice_b].map((text) => ({ text: text.trim() })),
      correct_choice_index: Number(question.correct_choice_index),
    }))
    if (questions.some((question) => !question.text || question.choices.some((choice) => !choice.text))) {
      setError('Every quiz question needs text and at least two non-empty choices.')
      return
    }
    setBusy(true)
    try {
      await api.post('/quizzes/build/', {
        lesson: Number(lessonId),
        activity: {
          title: quizDraft.title.trim(),
          instructions: quizDraft.instructions,
          max_attempts: Number(quizDraft.max_attempts),
          max_score: questions.reduce((sum, question) => sum + question.marks, 0),
          pass_percentage: Number(quizDraft.pass_mark_percentage),
          is_required: quizDraft.is_required,
        },
        quiz: {
          time_limit_minutes: Number(quizDraft.time_limit_minutes),
          pass_mark_percentage: Number(quizDraft.pass_mark_percentage),
        },
        questions,
      })
      await refreshSelectedLesson()
      setQuizDraft((value) => ({ ...value, title: '', instructions: '' }))
      setQuizQuestions([{ text: '', marks: 1, choice_a: '', choice_b: '', correct_choice_index: 0 }])
      flash('Quiz and questions added.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function refreshSelectedLesson() {
    const refreshed = await api.get(`/lessons/?module=${moduleId}`)
    setLessons(refreshed)
    const selected = refreshed.find((lesson) => String(lesson.id) === String(lessonId))
    if (selected) handleSelectLesson(selected)
    await refreshCourseModules()
  }

  async function refreshCourseModules() {
    const refreshedModules = await api.get(`/modules/?course=${courseId}`)
    setModules(refreshedModules)
  }

  async function deleteActivity(activity) {
    if (!window.confirm(`Delete “${activity.title}” and its quiz/submissions?`)) return
    setBusy(true)
    try {
      await api.del(`/activities/${activity.id}/`)
      await refreshSelectedLesson()
      flash('Activity deleted.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteAttachment(attachment) {
    if (!window.confirm(`Delete resource “${attachment.title}”?`)) return
    try {
      await api.del(`/lesson-attachments/${attachment.id}/`)
      setAttachments((items) => items.filter((item) => item.id !== attachment.id))
      flash('Resource deleted.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <DashboardLayout navItems={navItems} user={{ name: auth?.email || 'Instructor' }}>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

      <div className="space-y-6">
        <div className="rounded-2xl border border-blue-200 bg-linear-to-r from-blue-50 via-white to-sky-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-600">Instructor workspace</p>
              <h2 className="mt-1 text-2xl font-bold text-ink">Course content</h2>
              <p className="mt-1 text-sm text-text-muted">
                Select one of your courses to manage its curriculum, or create a new course below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => document.getElementById('create-course-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500"
            >
              New course
            </button>
          </div>
        </div>

        {status && (
          <div className="rounded-lg border border-mint/40 bg-mint/10 px-4 py-3 text-sm text-mint">{status}</div>
        )}
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-coral-tint px-4 py-3 text-sm text-coral-dim" role="alert">
            <span>{error}</span>
            {courses.length === 0 && !coursesLoading && (
              <button type="button" onClick={() => { setCoursesLoading(true); setError(''); setCourseListReload((value) => value + 1) }} className="rounded border border-current px-3 py-1.5 font-semibold">Retry course list</button>
            )}
          </div>
        )}

        {coursesLoading && <p className="rounded-lg border border-line bg-paper px-4 py-3 text-sm text-text-muted" role="status">Loading your courses…</p>}

        {courses.length > 0 && (
          <div className="rounded-2xl border border-line bg-paper p-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-semibold text-ink">Your courses</h3>
                <p className="mt-1 text-sm text-text-muted">Choose a course to manage its details, modules, lessons, videos, and resources.</p>
              </div>
              <span className="text-xs text-text-muted">{courses.length} course{courses.length === 1 ? '' : 's'}</span>
            </div>
            <ExpandableList items={courses} label="courses" listClassName="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(course) => {
                const image = course.thumbnail_url || (course.thumbnail ? `http://localhost:8000/${course.thumbnail}` : null)
                return (
                  <article key={course.id} className={`overflow-hidden rounded-xl border bg-slate-50 ${String(courseId) === String(course.id) ? 'border-blue-500 ring-2 ring-blue-100' : 'border-line'}`}>
                    <div className="h-28 w-full overflow-hidden bg-slate-100">
                      {image ? (
                        <img src={image} alt={course.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-linear-to-br from-blue-100 to-slate-100 text-sm font-medium text-blue-700">
                          No cover
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="min-w-0 text-sm font-semibold text-ink">{course.title}</h4>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${course.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                          {course.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-text-muted">{course.module_count || 0} module{course.module_count === 1 ? '' : 's'}</p>
                      <button type="button" onClick={() => handleSelectCourse(String(course.id))} disabled={busy} className="mt-3 w-full rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                        {String(courseId) === String(course.id) ? 'Managing course' : 'Manage course'}
                      </button>
                    </div>
                  </article>
                )
              }}
            </ExpandableList>
          </div>
        )}

        {/* Create a course or switch between existing courses. */}
        <div id="create-course-section" className="rounded-2xl border border-line bg-paper p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-lg">
              <label className="mb-1.5 block text-sm font-medium text-ink">Select a course</label>
              {coursesLoading ? (
                <p className="text-sm text-text-muted" role="status">Loading your courses…</p>
              ) : courses.length === 0 ? (
                <p className="text-sm text-text-muted">
                  You don't have any courses yet — create one below to start building your curriculum.
                </p>
              ) : (
                <select
                  value={courseId}
                  onChange={(e) => handleSelectCourse(e.target.value)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
                >
                  <option value="">Select a course…</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              )}
            </div>

            <form onSubmit={handleAddCourse} className="w-full max-w-xl space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">New course title</label>
                <input
                  value={newCourse.title}
                  onChange={(e) => setNewCourse((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Web Development Bootcamp"
                  className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-text-dim"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Description</label>
                <textarea
                  value={newCourse.description}
                  onChange={(e) => setNewCourse((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Short description for the course"
                  rows={3}
                  className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-text-dim"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Course thumbnail</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                  className="w-full rounded-md border border-dashed border-line bg-white px-3 py-2 text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-blue-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-blue-700"
                />
                {thumbnailPreview && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-blue-200 bg-blue-50">
                    <img src={thumbnailPreview} alt="Course thumbnail preview" className="h-28 w-full object-cover" />
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={busy || !newCourse.title.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              >
                <Plus size={16} /> Create course
              </button>
            </form>
          </div>
        </div>

        {courseId && (
          <section className="rounded-2xl border border-line bg-paper p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ink">Course details</h3>
                <p className="mt-1 text-xs text-text-muted">
                  Certificate eligibility is based on completing the required activities in every module.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${courses.find((item) => String(item.id) === String(courseId))?.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                {courses.find((item) => String(item.id) === String(courseId))?.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSaveCourse}>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Title
                <input required maxLength={200} value={courseEdit.title} onChange={(event) => setCourseEdit((value) => ({ ...value, title: event.target.value }))} className="rounded-md border border-line bg-paper px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink md:col-span-2">
                Description
                <textarea rows={3} value={courseEdit.description} onChange={(event) => setCourseEdit((value) => ({ ...value, description: event.target.value }))} className="rounded-md border border-line bg-paper px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink md:col-span-2">
                Replace course cover
                <input type="file" accept="image/*" onChange={(event) => setCourseCoverFile(event.target.files?.[0] || null)} className="rounded-md border border-dashed border-line bg-paper px-3 py-2 text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-blue-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-blue-700" />
                {courseCoverFile && <span className="text-xs font-normal text-text-muted">New cover: {courseCoverFile.name}</span>}
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <button type="submit" disabled={busy || !courseEdit.title.trim()} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60">Save details</button>
                <button type="button" disabled={busy} onClick={() => setCourseStatus('save_draft')} className="rounded-md border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-60">Save as draft</button>
                <button type="button" disabled={busy} onClick={() => setCourseStatus('publish')} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">Publish course</button>
                <button type="button" onClick={() => setPreviewOpen((value) => !value)} className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink"><Eye size={15} /> {previewOpen ? 'Close preview' : 'Student preview'}</button>
                <button type="button" disabled={busy} onClick={handleDeleteCourse} className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"><Trash2 size={15} /> Delete course</button>
              </div>
            </form>
          </section>
        )}

        {courseId && (
          <section className="rounded-2xl border border-blue-200 bg-paper p-6" aria-labelledby="instructor-sessions-heading">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-blue-100 p-2 text-blue-800">
                <CalendarDays size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="instructor-sessions-heading" className="font-semibold text-ink">Live sessions</h3>
                <p className="mt-1 text-sm text-text-muted">
                  Schedule sessions for students who choose instructor-led learning. They receive in-app reminders 24 hours and 1 hour before.
                </p>
                <form onSubmit={handleAddLiveSession} className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Session title
                    <input
                      required
                      maxLength={200}
                      value={newLiveSession.title}
                      onChange={(event) => setNewLiveSession((current) => ({ ...current, title: event.target.value }))}
                      placeholder="e.g. Weekly question and answer"
                      className="rounded-md border border-line bg-paper px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Date and time
                    <input
                      type="datetime-local"
                      required
                      value={newLiveSession.starts_at}
                      onChange={(event) => setNewLiveSession((current) => ({ ...current, starts_at: event.target.value }))}
                      className="rounded-md border border-line bg-paper px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Secure meeting link
                    <input
                      type="url"
                      required
                      value={newLiveSession.meeting_url}
                      onChange={(event) => setNewLiveSession((current) => ({ ...current, meeting_url: event.target.value }))}
                      placeholder="https://..."
                      className="rounded-md border border-line bg-paper px-3 py-2"
                    />
                  </label>
                  <div className="md:col-span-3">
                    <button
                      type="submit"
                      disabled={busy || !newLiveSession.title.trim() || !newLiveSession.starts_at || !newLiveSession.meeting_url.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                    >
                      <Plus size={16} aria-hidden="true" /> Schedule session
                    </button>
                  </div>
                </form>
                {liveSessions.length ? (
                  <ul className="mt-4 space-y-2">
                    {liveSessions.map((session) => (
                      <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel/50 p-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{session.title}</p>
                          <p className="mt-1 text-xs text-text-muted">
                            {new Date(session.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteLiveSession(session)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                        >
                          <Trash2 size={15} aria-hidden="true" /> Cancel
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-text-muted" role="status">No live sessions scheduled for this course.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {courseId && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Step 2: modules */}
            <div className="rounded-2xl border border-line bg-paper p-6">
              <h3 className="font-semibold text-ink">Modules</h3>
              <p className="mt-1 text-sm text-text-muted">Add a module, then select it to create lessons and videos.</p>

              <div className="mt-4">
                {modules.length ? (
                  <ExpandableList items={modules} label="modules" listClassName="space-y-2">
                    {(m, index) => (
                      <div key={m.id} className="flex items-center gap-1">
                    <button type="button" onClick={() => handleSelectModule(String(m.id))} className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-left text-sm ${String(moduleId) === String(m.id) ? 'border-coral bg-coral-tint text-coral-dim' : 'border-line text-ink hover:border-text-dim'}`}>
                      {m.order}. {m.title}
                    </button>
                    <button type="button" aria-label={`Move ${m.title} up`} title="Move up" disabled={busy || index === 0} onClick={() => moveItem('module', index, -1)} className="rounded border border-line p-2 text-ink disabled:opacity-35"><ChevronUp size={15} /></button>
                    <button type="button" aria-label={`Move ${m.title} down`} title="Move down" disabled={busy || index === modules.length - 1} onClick={() => moveItem('module', index, 1)} className="rounded border border-line p-2 text-ink disabled:opacity-35"><ChevronDown size={15} /></button>
                    <button type="button" aria-label={`Delete ${m.title}`} title="Delete module" disabled={busy} onClick={() => deleteModule(m)} className="rounded border border-rose-200 p-2 text-rose-700 disabled:opacity-35"><Trash2 size={15} /></button>
                  </div>
                    )}
                  </ExpandableList>
                ) : <p className="text-sm text-text-muted" role="status">No modules yet. Add the first module to start the course outline.</p>}
              </div>

              <form onSubmit={handleAddModule} className="mt-4 flex gap-2 border-t border-line pt-4">
                <input
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  placeholder="New module title, e.g. 'JavaScript Fundamentals'"
                  className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-text-dim"
                />
                <button
                  disabled={busy || !newModuleTitle.trim()}
                  className="flex items-center gap-1 rounded-md bg-coral px-3 py-2 text-sm font-medium text-white hover:bg-coral-dim disabled:opacity-60"
                >
                  <Plus size={16} /> Add module
                </button>
              </form>
            </div>

            {/* Step 3: lessons */}
            {moduleId && (
              <div className="rounded-2xl border border-line bg-paper p-6">
                <h3 className="font-semibold text-ink">Lessons</h3>

                <div className="mt-4">
                  {lessons.length ? (
                    <ExpandableList items={lessons} label="lessons" listClassName="space-y-2">
                      {(l, index) => (
                        <div key={l.id} className="flex items-center gap-1">
                      <button type="button" onClick={() => handleSelectLesson(l)} className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-left text-sm ${String(lessonId) === String(l.id) ? 'border-coral bg-coral-tint text-coral-dim' : 'border-line text-ink hover:border-text-dim'}`}>
                        {l.order}. {l.title}
                      </button>
                      <button type="button" aria-label={`Move ${l.title} up`} title="Move up" disabled={busy || index === 0} onClick={() => moveItem('lesson', index, -1)} className="rounded border border-line p-2 text-ink disabled:opacity-35"><ChevronUp size={15} /></button>
                      <button type="button" aria-label={`Move ${l.title} down`} title="Move down" disabled={busy || index === lessons.length - 1} onClick={() => moveItem('lesson', index, 1)} className="rounded border border-line p-2 text-ink disabled:opacity-35"><ChevronDown size={15} /></button>
                      <button type="button" aria-label={`Delete ${l.title}`} title="Delete lesson" disabled={busy} onClick={() => deleteLesson(l)} className="rounded border border-rose-200 p-2 text-rose-700 disabled:opacity-35"><Trash2 size={15} /></button>
                    </div>
                      )}
                    </ExpandableList>
                  ) : <p className="text-sm text-text-muted" role="status">No lessons yet.</p>}
                </div>

                <form onSubmit={handleAddLesson} className="mt-4 space-y-2 border-t border-line pt-4">
                  <input
                    value={newLesson.title}
                    onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })}
                    placeholder="New lesson title"
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-text-dim"
                  />
                  <input
                    value={newLesson.video_url}
                    onChange={(e) => setNewLesson({ ...newLesson, video_url: e.target.value })}
                    placeholder="YouTube, Vimeo, or direct HTTPS video URL"
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-text-dim"
                    disabled={!!newLessonVideoFile}
                  />
                  <label className="block text-xs font-medium text-text-muted">Or upload MP4, WebM, OGG, or MOV (up to 500 MB)
                    <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.ogg,.mov" onChange={(event) => setNewLessonVideoFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-sm" />
                  </label>
                  <input value={newLesson.learning_objectives} onChange={(event) => setNewLesson({ ...newLesson, learning_objectives: event.target.value })} placeholder="Learning objectives — optional" className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-text-dim" />
                  <textarea
                    value={newLesson.tutorial_content}
                    onChange={(e) => setNewLesson({ ...newLesson, tutorial_content: e.target.value })}
                    placeholder="Tutorial text — optional"
                    rows={2}
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-text-dim"
                  />
                  <button
                    disabled={busy || !newLesson.title.trim()}
                    className="flex items-center gap-1 rounded-md bg-coral px-3 py-2 text-sm font-medium text-white hover:bg-coral-dim disabled:opacity-60"
                  >
                    <Plus size={16} /> Add lesson
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Step 4: selected lesson — video link + PDFs */}
        {lessonId && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-paper p-6">
              <h3 className="font-semibold text-ink">Video · {selectedLesson?.title}</h3>
              <p className="mt-1 text-sm text-text-muted">Paste a YouTube, Vimeo, or direct HTTPS video URL and press Save, or upload a video file below.</p>
              <form onSubmit={handleSaveLesson} className="mt-4 space-y-2 border-b border-line pb-4">
                <input required maxLength={200} value={newLesson.title} onChange={(event) => setNewLesson({ ...newLesson, title: event.target.value })} aria-label="Lesson title" className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink" />
                <input value={newLesson.learning_objectives} onChange={(event) => setNewLesson({ ...newLesson, learning_objectives: event.target.value })} placeholder="Learning objectives" className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink" />
                <textarea rows={3} value={newLesson.tutorial_content} onChange={(event) => setNewLesson({ ...newLesson, tutorial_content: event.target.value })} placeholder="Tutorial content" className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink" />
                <button type="submit" disabled={busy || !newLesson.title.trim()} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50">Save lesson details</button>
              </form>
              <form onSubmit={handleSaveVideoUrl} className="mt-4 flex gap-2">
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                  className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-text-dim"
                />
                <button
                  disabled={busy}
                  className="rounded-md bg-coral px-3 py-2 text-sm font-medium text-white hover:bg-coral-dim disabled:opacity-60"
                >
                  Save
                </button>
              </form>
              {selectedLesson?.video_url && (
                <>
                  <div className="mt-4">
                    <LessonVideo lessonId={selectedLesson.id} url={selectedLesson.video_url} showSummary />
                  </div>
                  <p className="mt-3 text-xs text-text-muted">
                    Currently saved: <a className="text-coral hover:underline" href={selectedLesson.video_url} target="_blank" rel="noreferrer">{selectedLesson.video_url}</a>
                  </p>
                </>
              )}
              {selectedLesson?.video_file_url && (
                <div className="mt-4"><LessonVideo key={selectedLesson.video_file_url} lessonId={selectedLesson.id} url={selectedLesson.video_file_url} uploadedVideo showSummary /></div>
              )}
              <form onSubmit={handleUploadLessonVideo} className="mt-4 space-y-2 border-t border-line pt-4">
                <label className="block text-xs font-medium text-text-muted">Upload or replace video (MP4, WebM, OGG, MOV; max 500 MB)
                  <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.ogg,.mov" onChange={(event) => setNewLessonVideoFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-sm" />
                </label>
                <button type="submit" disabled={busy || !newLessonVideoFile} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><Upload size={15} /> Save uploaded video</button>
              </form>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-6">
              <h3 className="font-semibold text-ink">PDF attachments</h3>
              <div className="mt-3 space-y-2">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-md border border-line px-3 py-2">
                    <button type="button" onClick={() => api.download(a.download_url.replace(/^\/api/, ''), `${a.title}.pdf`).catch((err) => window.alert(err.message))} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-ink hover:text-blue-700">
                      <FileText size={16} className="shrink-0 text-coral" /> {a.title}
                    </button>
                    <button type="button" aria-label={`Delete ${a.title}`} onClick={() => deleteAttachment(a)} className="rounded p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 size={15} /></button>
                  </div>
                ))}
                {attachments.length === 0 && <p className="text-sm text-text-muted">No PDFs attached yet.</p>}
              </div>

              <form onSubmit={handleUploadPdf} className="mt-4 space-y-2 border-t border-line pt-4">
                <input
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  placeholder="Display name, e.g. 'Week 3 slides'"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-text-dim"
                />
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-text-muted"
                />
                <button
                  disabled={busy || !pdfFile}
                  className="flex items-center gap-1 rounded-md bg-coral px-3 py-2 text-sm font-medium text-white hover:bg-coral-dim disabled:opacity-60"
                >
                  <Upload size={16} /> Upload PDF
                </button>
              </form>
            </div>
          </div>
        )}

        {selectedLesson && (
          <section className="rounded-2xl border border-line bg-paper p-6" aria-label="Lesson activities">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-ink">Activities · {selectedLesson.title}</h3>
                <p className="mt-1 text-xs text-text-muted">Required activities contribute to module completion and certificate eligibility.</p>
              </div>
            </div>
            <ul className="mb-5 divide-y divide-line">
              {(selectedLesson.activities || []).map((activity) => (
                <li key={activity.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{activity.activity_type}: {activity.title}</p>
                    <p className="text-xs text-text-muted">{activity.max_score} points · pass {activity.pass_percentage}% · {activity.is_required ? 'required' : 'optional'}{activity.quiz_id ? ' · quiz questions ready' : ''}</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => deleteActivity(activity)} aria-label={`Delete ${activity.title}`} className="rounded border border-rose-200 p-2 text-rose-700 disabled:opacity-50"><Trash2 size={15} /></button>
                </li>
              ))}
              {!selectedLesson.activities?.length && <li className="py-3 text-sm text-text-muted">No activities yet.</li>}
            </ul>
            <div className="grid gap-6 xl:grid-cols-2">
              <form onSubmit={handleCreateActivity} className="space-y-3 border-t border-line pt-4">
                <h4 className="font-semibold text-ink">Assignment, lab, or exercise</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-medium text-text-muted">Type
                    <select value={activityDraft.activity_type} onChange={(event) => setActivityDraft({ ...activityDraft, activity_type: event.target.value })} className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink"><option value="assignment">Assignment</option><option value="lab">Lab</option><option value="exercise">Coding exercise</option></select>
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-text-muted">Title
                    <input required maxLength={200} value={activityDraft.title} onChange={(event) => setActivityDraft({ ...activityDraft, title: event.target.value })} className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-text-muted">Maximum score
                    <input type="number" min="1" value={activityDraft.max_score} onChange={(event) => setActivityDraft({ ...activityDraft, max_score: event.target.value })} className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-text-muted">Pass percentage
                    <input type="number" min="0" max="100" value={activityDraft.pass_percentage} onChange={(event) => setActivityDraft({ ...activityDraft, pass_percentage: event.target.value })} className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-text-muted">Attempts
                    <input type="number" min="1" value={activityDraft.max_attempts} onChange={(event) => setActivityDraft({ ...activityDraft, max_attempts: event.target.value })} className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-text-muted">Deadline
                    <input type="datetime-local" value={activityDraft.deadline} onChange={(event) => setActivityDraft({ ...activityDraft, deadline: event.target.value })} className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                  </label>
                </div>
                <textarea rows={3} value={activityDraft.instructions} onChange={(event) => setActivityDraft({ ...activityDraft, instructions: event.target.value })} placeholder="Student instructions" className="w-full rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                {(activityDraft.activity_type === 'lab' || activityDraft.activity_type === 'exercise') && <>
                  <label className="grid max-w-xs gap-1 text-xs font-medium text-text-muted">Code language
                    <select value={activityDraft.language} onChange={(event) => setActivityDraft({ ...activityDraft, language: event.target.value })} className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink">
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="c">C</option>
                      <option value="cpp">C++</option>
                      <option value="java">Java</option>
                      <option value="html">HTML</option>
                    </select>
                  </label>
                  <textarea rows={3} value={activityDraft.starter_code} onChange={(event) => setActivityDraft({ ...activityDraft, starter_code: event.target.value })} placeholder="Starter code (optional)" className="w-full rounded border border-line bg-paper px-2 py-2 font-mono text-sm text-ink" />
                  {activityDraft.language === 'html' ? (
                    <p className="text-xs text-text-muted">HTML activities use a restricted browser preview and do not support runner test cases.</p>
                  ) : (
                    <textarea rows={3} value={activityDraft.test_cases} onChange={(event) => setActivityDraft({ ...activityDraft, test_cases: event.target.value })} aria-label="Test cases JSON" placeholder={'Test cases JSON, e.g. [{"input":"1","expected_output":"1","public":true}]'} className="w-full rounded border border-line bg-paper px-2 py-2 font-mono text-xs text-ink" />
                  )}
                </>}
                <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={activityDraft.is_required} onChange={(event) => setActivityDraft({ ...activityDraft, is_required: event.target.checked })} /> Required for module completion</label>
                <button type="submit" disabled={busy || !activityDraft.title.trim()} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} /> Add activity</button>
              </form>

              <form onSubmit={handleCreateQuiz} className="space-y-3 border-t border-line pt-4">
                <h4 className="font-semibold text-ink">Quiz</h4>
                <label className="grid gap-1 text-xs font-medium text-text-muted">Quiz title
                  <input required maxLength={200} value={quizDraft.title} onChange={(event) => setQuizDraft({ ...quizDraft, title: event.target.value })} className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                </label>
                <textarea rows={2} value={quizDraft.instructions} onChange={(event) => setQuizDraft({ ...quizDraft, instructions: event.target.value })} placeholder="Instructions" className="w-full rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-xs font-medium text-text-muted">Time limit (minutes)
                    <input type="number" min="1" value={quizDraft.time_limit_minutes} onChange={(event) => setQuizDraft({ ...quizDraft, time_limit_minutes: event.target.value })} className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-text-muted">Pass percentage
                    <input type="number" min="0" max="100" value={quizDraft.pass_mark_percentage} onChange={(event) => setQuizDraft({ ...quizDraft, pass_mark_percentage: event.target.value })} className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                  </label>
                </div>
                {quizQuestions.map((question, index) => (
                  <fieldset key={index} className="space-y-2 rounded-md border border-line p-3">
                    <legend className="px-1 text-xs font-semibold text-text-muted">Question {index + 1}</legend>
                    <input required value={question.text} onChange={(event) => setQuizQuestions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} placeholder="Question text" className="w-full rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input required value={question.choice_a} onChange={(event) => setQuizQuestions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, choice_a: event.target.value } : item))} placeholder="Choice A" className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                      <input required value={question.choice_b} onChange={(event) => setQuizQuestions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, choice_b: event.target.value } : item))} placeholder="Choice B" className="rounded border border-line bg-paper px-2 py-2 text-sm text-ink" />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-xs text-text-muted">Correct answer
                        <select value={question.correct_choice_index} onChange={(event) => setQuizQuestions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, correct_choice_index: Number(event.target.value) } : item))} className="ml-2 rounded border border-line bg-paper px-2 py-1 text-sm text-ink"><option value={0}>A</option><option value={1}>B</option></select>
                      </label>
                      <label className="text-xs text-text-muted">Marks
                        <input type="number" min="1" value={question.marks} onChange={(event) => setQuizQuestions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, marks: event.target.value } : item))} className="ml-2 w-16 rounded border border-line bg-paper px-2 py-1 text-sm text-ink" />
                      </label>
                      {quizQuestions.length > 1 && <button type="button" onClick={() => setQuizQuestions((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="text-xs font-semibold text-rose-700">Remove question</button>}
                    </div>
                  </fieldset>
                ))}
                <button type="button" onClick={() => setQuizQuestions((items) => [...items, { text: '', marks: 1, choice_a: '', choice_b: '', correct_choice_index: 0 }])} className="inline-flex items-center gap-1 rounded border border-line px-3 py-2 text-sm font-semibold text-ink"><CirclePlus size={15} /> Add question</button>
                <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={quizDraft.is_required} onChange={(event) => setQuizDraft({ ...quizDraft, is_required: event.target.checked })} /> Required for module completion</label>
                <button type="submit" disabled={busy || !quizDraft.title.trim()} className="block rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Create quiz</button>
              </form>
            </div>
          </section>
        )}

        {previewOpen && courseId && (
          <section className="rounded-2xl border border-blue-200 bg-paper p-6" aria-label="Student course preview">
            <div className="mb-5 border-b border-line pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Student preview · {courses.find((item) => String(item.id) === String(courseId))?.status === 'published' ? 'published' : 'draft'}</p>
              <h3 className="mt-1 text-xl font-bold text-ink">{courseEdit.title}</h3>
              {courseEdit.description && <p className="mt-2 text-sm text-text-muted">{courseEdit.description}</p>}
            </div>
            <div className="space-y-6">
              {modules.map((module) => (
                <article key={module.id} className="border-b border-line pb-5 last:border-0">
                  <h4 className="font-semibold text-ink">Module {module.order}: {module.title}</h4>
                  <div className="mt-3 space-y-4">
                    {(module.lessons || []).map((lesson) => (
                      <div key={lesson.id} className="rounded-lg border border-line p-4">
                        <h5 className="font-medium text-ink">{lesson.order}. {lesson.title}</h5>
                        {lesson.learning_objectives && <p className="mt-1 text-xs text-text-muted">{lesson.learning_objectives}</p>}
                        {lesson.video_file_url && <div className="mt-3"><LessonVideo lessonId={lesson.id} url={lesson.video_file_url} uploadedVideo /></div>}
                        {lesson.video_url && <div className="mt-3"><LessonVideo lessonId={lesson.id} url={lesson.video_url} /></div>}
                        {lesson.tutorial_content && <p className="mt-3 whitespace-pre-wrap text-sm text-text-muted">{lesson.tutorial_content}</p>}
                        {!!lesson.attachments?.length && <p className="mt-3 text-xs text-text-muted">{lesson.attachments.map((item) => item.title).join(' · ')}</p>}
                        {!!lesson.activities?.length && <ul className="mt-3 list-inside list-disc text-sm text-text-muted">{lesson.activities.map((activity) => <li key={activity.id}>{activity.activity_type}: {activity.title}</li>)}</ul>}
                      </div>
                    ))}
                    {!module.lessons?.length && <p className="text-sm text-text-muted">No lessons in this module yet.</p>}
                  </div>
                </article>
              ))}
              {!modules.length && <p className="text-sm text-text-muted">Add modules and lessons to preview the course.</p>}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  )
}
