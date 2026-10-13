from django.conf import settings  # pyright: ignore[reportMissingModuleSource]
from django.contrib import admin  # pyright: ignore[reportMissingModuleSource]
from django.urls import include, path  # pyright: ignore[reportMissingModuleSource]

admin.site.site_header = "Optimum ERP LMS Administration"
admin.site.site_title = "Optimum ERP LMS Admin"
admin.site.index_title = "Platform Administration"

try:
    from drf_spectacular.views import (  # pyright: ignore[reportMissingImports]
        SpectacularAPIView,
        SpectacularRedocView,
        SpectacularSwaggerView,
    )
except ImportError:  # pragma: no cover
    SpectacularAPIView = None
    SpectacularRedocView = None
    SpectacularSwaggerView = None


urlpatterns = [
    # ------------------------------------------------------------------
    # Admin
    # ------------------------------------------------------------------
    path("admin/", admin.site.urls),

    # ------------------------------------------------------------------
    # API documentation (drf-spectacular)
    # ------------------------------------------------------------------
]

if SpectacularAPIView is not None:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="swagger-ui",
        ),
        path(
            "api/redoc/",
            SpectacularRedocView.as_view(url_name="schema"),
            name="redoc",
        ),
    ]

urlpatterns += [
    # ------------------------------------------------------------------
    # API routes
    # ------------------------------------------------------------------
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.courses.urls")),
    path("api/", include("apps.enrollment.urls")),
    path("api/progress/", include("apps.progress.urls")),
    path("api/", include("apps.submissions.urls")),
    path("api/", include("apps.quizzes.urls")),
    path("api/execute/", include("apps.execution.urls")),
    path("api/dashboard/", include("apps.dashboards.urls")),
    path("api/engagement/", include("apps.engagement.urls")),
    path("api/risk/", include("apps.risk.urls")),
    path("api/sequencing/", include("apps.sequencing.urls")),
    path("api/allocation/", include("apps.allocation.urls")),
]

# ----------------------------------------------------------------------
# Media files (dev only)
# ----------------------------------------------------------------------
if settings.DEBUG:
    from django.urls import re_path
    from django.views.static import serve  # pyright: ignore[reportMissingModuleSource]

    urlpatterns += [
        re_path(
            "^media/(?P<path>course_covers/.*)$",
            serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]