# Integrating into Optimum LMS's Django backend

**Integration status:** the backend integration described in sections 1–4
below is implemented. Weekly snapshots are stored as
`apps.dashboards.PerformanceSnapshot` and populated by
`python manage.py compute_snapshots`; scoring is provided by `apps.risk` at
`GET /api/risk/cohort/` and
`GET /api/risk/student/<student_id>/course/<course_id>/`. The examples below
document the data and service contracts; they are not outstanding setup steps.

This package is deliberately backend-agnostic — it's plain Python, not a
web service. The cleanest integration is **import it directly into Django**
rather than running it as a separate microservice, since you already have
one backend and don't need the operational overhead of a second one
talking to it over HTTP. (If you do want it as a separate service later —
e.g. to scale it independently — see "Alternative: standalone API" below.)

## 1. What Django needs to produce: `PerformanceSnapshot`

The engine consumes one row per student, per course, per week. Add a model
like this (fields match `src/schema.py` exactly):

```python
# models.py
class PerformanceSnapshot(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    week_start = models.DateField()

    quiz_avg = models.FloatField()
    assignment_avg = models.FloatField()
    exam_avg = models.FloatField(default=0)
    completion_rate = models.FloatField()
    retries = models.IntegerField(default=0)
    deadlines_missed = models.IntegerField(default=0)

    login_count = models.IntegerField(default=0)
    active_days = models.IntegerField(default=0)
    time_spent_minutes = models.FloatField(default=0)
    video_watch_minutes = models.FloatField(default=0)
    content_consumed_pct = models.FloatField(default=0)

    attendance_rate = models.FloatField(default=0)
    late_submissions = models.IntegerField(default=0)
    inactivity_streak_days = models.IntegerField(default=0)
    resources_opened = models.IntegerField(default=0)
    skipped_lessons = models.IntegerField(default=0)

    class Meta:
        unique_together = ("student", "course", "week_start")
```

Populate it with a **weekly management command** (`manage.py compute_snapshots`)
that aggregates that week's activity/submission/quiz tables into one row per
enrolled student. This is the one piece Copilot needs your actual data
model to write — the shape above is the contract, the aggregation logic
depends on your existing tables.

## 2. Where the model files live

Copy this whole `risk-engine/` folder into your Django project, e.g. as
`backend/risk_engine/`. After running `python src/train.py` you'll have:

```
risk_engine/models/risk_model.joblib
risk_engine/models/metadata.json
```

Commit `metadata.json` (it's small, human-readable config) but **not**
`risk_model.joblib` to git if your repo has size limits — ship it via your
deploy pipeline or a small artifact store instead, same as any ML model
binary.

## 3. The service call

```python
# services/risk_scoring.py
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "risk_engine" / "src"))
from predict import RiskEngine  # noqa: E402

_engine = None

def get_engine():
    global _engine
    if _engine is None:
        _engine = RiskEngine()  # loads the model once per worker process
    return _engine


def score_student(student_id: str, course_id: str) -> dict | None:
    from .models import PerformanceSnapshot

    snapshots = list(
        PerformanceSnapshot.objects
        .filter(student_id=student_id, course_id=course_id)
        .order_by("week_start")
        .values()[:12]  # last ~12 weeks is plenty
    )
    if len(snapshots) < 3:
        return None  # not enough history yet — don't show a risk card

    return get_engine().score_student(snapshots)
```

## 4. The endpoint

```python
# views.py  (DRF)
class StudentRiskView(APIView):
    permission_classes = [IsInstructorOrAdmin]

    def get(self, request, student_id, course_id):
        card = score_student(student_id, course_id)
        if card is None:
            return Response({"detail": "Not enough history to score this student yet."}, status=204)
        return Response(card)
```

Matches the contract the frontend's `src/api/` layer already expects for a
per-student risk card — `student_health_score`, `risk_level`,
`risk_probability`, `top_factors`, `recommended_action`.

For an instructor's whole-cohort dashboard, add a batch endpoint that calls
`get_engine().score_many({student_id: snapshots, ...})` and returns the
sorted `scored` list — that's what should back a "students by risk" table.

## 5. Retraining

`python src/train.py` regenerates `risk_model.joblib` + `metadata.json`
from whatever's in `data/student_snapshots.csv` + `data/labels.csv`. For
production:

1. Write an export management command that pulls real `PerformanceSnapshot`
   rows into that same CSV shape, plus real outcome labels (did the student
   actually fail/drop/need support in the following weeks — this needs a
   few months of real history before it's trainable on real data).
2. Point `train.py`'s `load_training_table()` at the export instead of the
   synthetic generator.
3. Re-run `train.py` on a schedule (monthly, or after each cohort
   completes) — the spec's "retraining loop" and "model drift" concerns
   are real for this kind of model; a `metadata.json.test_metrics` you
   track over time is a cheap first drift check.

## 6. What's simplified in this MVP (be upfront about this internally)

- **Labels are synthetic.** There's no real "did this student actually
  struggle" ground truth yet — that only exists once you've run a cohort
  or two with `PerformanceSnapshot` data and known outcomes. Until then,
  this model is demonstrating the *pipeline*, not making production-grade
  predictions. Don't surface `risk_level` to instructors as authoritative
  until it's been retrained on real outcomes and someone's checked its
  precision/recall on a held-out real cohort.
- **`relative_score_vs_class`** compares against the class average at
  training time — recompute this from live data periodically rather than
  letting it go stale.
- **No fairness/bias audit yet.** Before this influences real academic
  interventions, check it doesn't systematically flag any demographic
  group more than warranted by actual performance — the spec's "fairness
  checks" line is not optional once real students are affected by this.

## Alternative: standalone API (if you want it as a separate service)

If you'd rather run this as its own microservice instead of importing it
into Django directly (e.g. to scale/deploy the model independently), wrap
`RiskEngine` in a small FastAPI app:

```python
# api.py
from fastapi import FastAPI
from predict import RiskEngine

app = FastAPI()
engine = RiskEngine()

@app.post("/score")
def score(snapshots: list[dict]):
    return engine.score_student(snapshots)
```

Run with `uvicorn api:app`, and have Django call it over HTTP instead of
importing it. Only worth the extra moving part if you actually need to
scale inference separately from the rest of the backend — for a cohort of
tens/hundreds of students, direct import is simpler and has one less
thing that can go down.
