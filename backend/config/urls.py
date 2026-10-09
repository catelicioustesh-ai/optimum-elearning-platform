from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

admin.site.site_header = "Optimum ERP LMS Administration"
admin.site.site_title = "Optimum ERP LMS Admin"
admin.site.index_title = "Platform Administration"

urlpatterns = [
    path("admin/", admin.site.urls),
]

api_urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.courses.urls")),
    path("", include("apps.enrollment.urls")),
    path("progress/", include("apps.progress.urls")),
    path("", include("apps.submissions.urls")),
    path("", include("apps.quizzes.urls")),
    path("execute/", include("apps.execution.urls")),
    path("dashboard/", include("apps.dashboards.urls")),
    path("engagement/", include("apps.engagement.urls")),
    path("risk/", include("apps.risk.urls")),
    path("sequencing/", include("apps.sequencing.urls")),
    path("allocation/", include("apps.allocation.urls")),
]

if settings.DEBUG:
    from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

    # Dev-only. Serve ONLY public assets (course cover images). Submissions and
    # lesson PDFs are private: they're delivered by authenticated API endpoints
    # (/api/submissions/<id>/download/, /api/lesson-attachments/<id>/download/)
    # that re-check enrollment, module locking and ownership. In production make
    # sure nginx/object storage exposes course_covers/ only.
    from django.urls import re_path
    from django.views.static import serve

    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
        path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
        re_path(r"^media/(?P<path>course_covers/.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]

urlpatterns.append(path("api/", include(api_urlpatterns)))
