"""
Run with: pytest tests/ (from the risk-engine/ root, after training a model)
"""

import pathlib
import sys
from types import SimpleNamespace
from unittest.mock import patch

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))

from features import build_features, FEATURE_COLUMNS, composite_score  # noqa: E402
from predict import RiskEngine, _validate_feature_contract  # noqa: E402


def _snapshot(week, **overrides):
    base = {
        "student_id": "STU-TEST", "course_id": "TEST-101", "week_index": week,
        "quiz_avg": 80, "assignment_avg": 80, "exam_avg": 0,
        "completion_rate": 0.1 * (week + 1), "retries": 0, "deadlines_missed": 0,
        "login_count": 5, "active_days": 5, "time_spent_minutes": 300,
        "video_watch_minutes": 100, "content_consumed_pct": 0.9,
        "attendance_rate": 0.9, "late_submissions": 0,
        "inactivity_streak_days": 0, "resources_opened": 3, "skipped_lessons": 0,
    }
    base.update(overrides)
    return base


def test_composite_score_ignores_zero_exam_weeks():
    # An exam-less week shouldn't get dragged down by averaging in a 0.
    with_exam = composite_score(80, 80, 80)
    without_exam = composite_score(80, 80, 0)
    assert without_exam == pytest.approx(80, abs=1)
    assert with_exam == pytest.approx(80, abs=1)


def test_build_features_requires_minimum_history():
    with pytest.raises(ValueError):
        build_features([_snapshot(0), _snapshot(1)])  # only 2 weeks


def test_build_features_returns_all_columns():
    snaps = [_snapshot(w) for w in range(6)]
    feat = build_features(snaps)
    for col in FEATURE_COLUMNS:
        assert col in feat


def test_declining_student_shows_negative_trend():
    snaps = [_snapshot(w, quiz_avg=90 - w * 8, assignment_avg=90 - w * 8) for w in range(6)]
    feat = build_features(snaps)
    assert feat["score_trend"] < 0
    assert feat["quiz_improvement_slope"] < 0


def test_improving_student_shows_positive_trend():
    snaps = [_snapshot(w, quiz_avg=50 + w * 6, assignment_avg=50 + w * 6) for w in range(6)]
    feat = build_features(snaps)
    assert feat["score_trend"] > 0


def test_score_many_returns_cohort_envelope_and_skips_short_histories():
    engine = RiskEngine.__new__(RiskEngine)
    valid_snapshots = [_snapshot(week) for week in range(3)]
    scored_card = {"student_id": "STU-TEST", "risk_probability": 0.4}

    with patch.object(engine, "score_student", return_value=scored_card) as score_student:
        result = engine.score_many({
            "STU-TEST": valid_snapshots,
            "STU-NEW": valid_snapshots[:2],
        })

    assert result == {
        "scored": [scored_card],
        "skipped_insufficient_history": ["STU-NEW"],
    }
    score_student.assert_called_once_with(valid_snapshots)


def test_score_many_does_not_hide_invalid_snapshot_errors():
    engine = RiskEngine.__new__(RiskEngine)
    valid_length_snapshots = [_snapshot(week) for week in range(3)]

    with patch.object(engine, "score_student", side_effect=ValueError("invalid snapshot")):
        with pytest.raises(ValueError, match="invalid snapshot"):
            engine.score_many({"STU-TEST": valid_length_snapshots})


def test_risk_level_uses_inclusive_data_derived_boundaries():
    engine = RiskEngine.__new__(RiskEngine)
    engine.thresholds = {"medium": 0.22, "high": 0.93}

    assert engine._risk_level(0.219) == "low"
    assert engine._risk_level(0.22) == "medium"
    assert engine._risk_level(0.929) == "medium"
    assert engine._risk_level(0.93) == "high"


def _model_with_feature_count(feature_count):
    estimator = SimpleNamespace(n_features_in_=feature_count)
    classifier = SimpleNamespace(estimator=estimator)
    return SimpleNamespace(calibrated_classifiers_=[classifier, classifier])


def test_feature_contract_accepts_matching_artifacts():
    _validate_feature_contract(
        _model_with_feature_count(len(FEATURE_COLUMNS)),
        {"feature_columns": FEATURE_COLUMNS.copy()},
    )


def test_feature_contract_rejects_metadata_order_mismatch():
    mismatched_columns = FEATURE_COLUMNS.copy()
    mismatched_columns.reverse()

    with pytest.raises(ValueError, match="feature order"):
        _validate_feature_contract(
            _model_with_feature_count(len(FEATURE_COLUMNS)),
            {"feature_columns": mismatched_columns},
        )


def test_feature_contract_rejects_model_feature_count_mismatch():
    with pytest.raises(ValueError, match="feature count"):
        _validate_feature_contract(
            _model_with_feature_count(len(FEATURE_COLUMNS) - 1),
            {"feature_columns": FEATURE_COLUMNS.copy()},
        )
