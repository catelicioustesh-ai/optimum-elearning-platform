"""Generate a local preview using the same renderer used for issued certificates."""

import argparse
import os
import sys
import uuid
from datetime import date, datetime, time
from pathlib import Path
from types import SimpleNamespace


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from django.utils import timezone

from apps.engagement.certificate_pdf import render_certificate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", default="Amina Wanjiru", help="Learner name")
    parser.add_argument(
        "--course",
        default="Introduction to Python Programming",
        help="Course title",
    )
    parser.add_argument("--instructor", default="Tina Teach", help="Instructor name")
    parser.add_argument(
        "--completed-on",
        type=date.fromisoformat,
        default=date.today(),
        help="Completion date in YYYY-MM-DD format",
    )
    parser.add_argument(
        "--certificate-id",
        type=uuid.UUID,
        help="Existing certificate UUID; omit to generate a preview-only ID",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).with_name("generated-preview.pdf"),
        help="Output PDF path",
    )
    args = parser.parse_args()

    certificate_id = args.certificate_id or uuid.uuid4()
    instructor = SimpleNamespace(
        get_full_name=lambda: args.instructor,
        username=args.instructor,
    )
    student = SimpleNamespace(
        get_full_name=lambda: args.name,
        username=args.name,
    )
    course = SimpleNamespace(title=args.course, instructor=instructor)
    completed_at = timezone.make_aware(
        datetime.combine(args.completed_on, time.min)
    )
    certificate = SimpleNamespace(
        certificate_number=certificate_id,
        issued_at=timezone.now(),
        completed_at=completed_at,
        student=student,
        course=course,
    )

    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(render_certificate(certificate))
    print(f"Certificate preview written to {output}")
    if not args.certificate_id:
        print(
            "Preview-only ID generated; its QR verification page will not match "
            "an issued certificate."
        )


if __name__ == "__main__":
    main()
