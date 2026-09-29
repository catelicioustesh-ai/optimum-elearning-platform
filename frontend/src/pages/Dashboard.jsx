import { useEffect, useState } from "react";

function Dashboard({ onLogout }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [quizzes, setQuizzes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState("dashboard");

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedProfile = localStorage.getItem("profile");

    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }

    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const token = localStorage.getItem("token");

    try {
      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Token ${token}`;
      }

      const [
        coursesResponse,
        assignmentsResponse,
        materialsResponse,
        quizzesResponse,
      ] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/courses/", {
          headers,
        }),
        fetch("http://127.0.0.1:8000/api/assignments/", {
          headers,
        }),
        fetch("http://127.0.0.1:8000/api/materials/", {
          headers,
        }),
        fetch("http://127.0.0.1:8000/api/quizzes/", {
          headers,
        }),
      ]);

      if (coursesResponse.ok) {
        setCourses(await coursesResponse.json());
      }

      if (assignmentsResponse.ok) {
        setAssignments(await assignmentsResponse.json());
      }

      if (materialsResponse.ok) {
        setMaterials(await materialsResponse.json());
      }

      if (quizzesResponse.ok) {
        setQuizzes(await quizzesResponse.json());
      }
    } catch (error) {
      console.error("Unable to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const firstName =
    user?.first_name ||
    user?.username ||
    "Student";

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.username ||
    "Student";

  const menuItems = [
    {
      id: "dashboard",
      icon: "🏠",
      label: "Dashboard",
    },
    {
      id: "courses",
      icon: "📚",
      label: "My Courses",
    },
    {
      id: "materials",
      icon: "📖",
      label: "Learning Materials",
    },
    {
      id: "assignments",
      icon: "📝",
      label: "Assignments",
    },
    {
      id: "quizzes",
      icon: "🎯",
      label: "Quizzes",
    },
    {
      id: "profile",
      icon: "👤",
      label: "My Profile",
    },
    {
      id: "settings",
      icon: "⚙️",
      label: "Settings",
    },
  ];

  const renderDashboard = () => (
    <>
      <section className="welcome-section">
        <div>
          <p className="welcome-small">
            STUDENT DASHBOARD
          </p>

          <h1>
            Welcome back, {firstName}! 👋
          </h1>

          <p>
            Continue your learning journey and stay
            on top of your studies.
          </p>
        </div>

        <div className="welcome-illustration">
          <div className="illustration-circle">
            🎓
          </div>

          <div className="floating-book">
            📚
          </div>
        </div>
      </section>

      <section className="statistics-grid">

        <div className="stat-card">
          <div className="stat-icon">
            📚
          </div>

          <div>
            <span>My Courses</span>

            <strong>
              {loading ? "..." : courses.length}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            📖
          </div>

          <div>
            <span>Learning Materials</span>

            <strong>
              {loading ? "..." : materials.length}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            📝
          </div>

          <div>
            <span>Assignments</span>

            <strong>
              {loading ? "..." : assignments.length}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            🎯
          </div>

          <div>
            <span>Quizzes</span>

            <strong>
              {loading ? "..." : quizzes.length}
            </strong>
          </div>
        </div>

      </section>

      <section className="content-grid">

        <div className="dashboard-panel">

          <div className="panel-heading">
            <div>
              <h2>My Courses</h2>

              <p>
                Courses available on the platform
              </p>
            </div>

            <button
              onClick={() => setActivePage("courses")}
            >
              View All
            </button>
          </div>

          {loading ? (
            <div className="empty-state">
              Loading courses...
            </div>
          ) : courses.length === 0 ? (
            <div className="empty-state">
              <span>📚</span>
              <p>
                No courses available yet.
              </p>
            </div>
          ) : (
            <div className="course-list">

              {courses.slice(0, 4).map((course) => (
                <div
                  className="course-item"
                  key={course.id}
                >

                  <div className="course-icon">
                    📘
                  </div>

                  <div className="course-details">

                    <span>
                      {course.code}
                    </span>

                    <h3>
                      {course.name}
                    </h3>

                    <div className="progress-bar">
                      <div className="progress-value"></div>
                    </div>

                    <small>
                      Learning progress
                    </small>

                  </div>

                  <button
                    className="continue-button"
                    onClick={() =>
                      setActivePage("courses")
                    }
                  >
                    View →
                  </button>

                </div>
              ))}

            </div>
          )}

        </div>


        <div className="dashboard-panel">

          <div className="panel-heading">

            <div>
              <h2>Assignments</h2>

              <p>
                Keep track of your coursework
              </p>
            </div>

            <button
              onClick={() =>
                setActivePage("assignments")
              }
            >
              View All
            </button>

          </div>

          {loading ? (
            <div className="empty-state">
              Loading assignments...
            </div>
          ) : assignments.length === 0 ? (
            <div className="empty-state">
              <span>📝</span>

              <p>
                No assignments available.
              </p>
            </div>
          ) : (
            <div className="assignment-list">

              {assignments
                .slice(0, 4)
                .map((assignment) => (
                  <div
                    className="assignment-item"
                    key={assignment.id}
                  >

                    <div className="assignment-icon-small">
                      📝
                    </div>

                    <div>
                      <h3>
                        {assignment.title}
                      </h3>

                      <span>
                        Course ID:{" "}
                        {assignment.course}
                      </span>
                    </div>

                  </div>
                ))}

            </div>
          )}

        </div>

      </section>


      <section className="dashboard-panel full-panel">

        <div className="panel-heading">

          <div>
            <h2>
              Learning Materials
            </h2>

            <p>
              Access your study resources
            </p>
          </div>

          <button
            onClick={() =>
              setActivePage("materials")
            }
          >
            View All
          </button>

        </div>

        {materials.length === 0 ? (
          <div className="empty-state">
            <span>📖</span>

            <p>
              No learning materials available yet.
            </p>
          </div>
        ) : (
          <div className="material-grid">

            {materials.slice(0, 4).map((material) => (
              <div
                className="material-card"
                key={material.id}
              >

                <div className="material-icon">
                  📖
                </div>

                <span>
                  {material.material_type}
                </span>

                <h3>
                  {material.title}
                </h3>

                <p>
                  {material.description ||
                    "Learning material"}
                </p>

                <button
                  onClick={() =>
                    setActivePage("materials")
                  }
                >
                  Open Material →
                </button>

              </div>
            ))}

          </div>
        )}

      </section>


      <section className="profile-summary">

        <div className="profile-avatar-large">
          {firstName.charAt(0).toUpperCase()}
        </div>

        <div className="profile-summary-details">

          <span>
            STUDENT PROFILE
          </span>

          <h2>
            {fullName}
          </h2>

          <p>
            {user?.email || "Student account"}
          </p>

          {profile?.registration_number && (
            <p>
              Registration Number:{" "}
              {profile.registration_number}
            </p>
          )}

        </div>

        <button
          onClick={() =>
            setActivePage("profile")
          }
        >
          View Profile →
        </button>

      </section>
    </>
  );


  const renderCourses = () => (
    <div className="page-container">

      <div className="page-header">
        <div>
          <p className="page-label">
            LEARNING
          </p>

          <h1>
            My Courses
          </h1>

          <p>
            View and continue with your registered
            courses.
          </p>
        </div>

        <div className="page-header-icon">
          📚
        </div>
      </div>


      {courses.length === 0 ? (
        <div className="large-empty-state">
          <div>📚</div>

          <h2>
            No courses available
          </h2>

          <p>
            Your courses will appear here when
            they are added to the system.
          </p>
        </div>
      ) : (
        <div className="large-course-grid">

          {courses.map((course) => (
            <div
              className="large-course-card"
              key={course.id}
            >

              <div className="large-course-icon">
                📘
              </div>

              <span className="course-code">
                {course.code}
              </span>

              <h2>
                {course.name}
              </h2>

              <p>
                {course.description ||
                  "No course description has been added yet."}
              </p>

              <div className="course-info">
                <span>
                  👨‍🏫 Lecturer
                </span>

                <strong>
                  {course.lecturer || "Not assigned"}
                </strong>
              </div>

              <div className="course-progress-section">

                <div>
                  <span>
                    Course Progress
                  </span>

                  <strong>
                    55%
                  </strong>
                </div>

                <div className="progress-bar">
                  <div className="progress-value"></div>
                </div>

              </div>

              <button
                className="primary-action"
                onClick={() =>
                  alert(
                    `${course.name} course content will be connected next.`
                  )
                }
              >
                Continue Learning →
              </button>

            </div>
          ))}

        </div>
      )}

    </div>
  );


  const renderMaterials = () => (
    <div className="page-container">

      <div className="page-header">

        <div>
          <p className="page-label">
            STUDY RESOURCES
          </p>

          <h1>
            Learning Materials
          </h1>

          <p>
            Access documents, videos, presentations
            and other study resources.
          </p>
        </div>

        <div className="page-header-icon">
          📖
        </div>

      </div>


      {materials.length === 0 ? (
        <div className="large-empty-state">

          <div>📖</div>

          <h2>
            No learning materials
          </h2>

          <p>
            Your lecturer has not uploaded learning
            materials yet.
          </p>

        </div>
      ) : (
        <div className="resource-grid">

          {materials.map((material) => (
            <div
              className="resource-card"
              key={material.id}
            >

              <div className="resource-icon">
                {material.material_type === "video"
                  ? "🎥"
                  : material.material_type === "presentation"
                  ? "📊"
                  : material.material_type === "link"
                  ? "🔗"
                  : "📄"}
              </div>

              <span className="resource-type">
                {material.material_type}
              </span>

              <h2>
                {material.title}
              </h2>

              <p>
                {material.description ||
                  "Study material"}
              </p>

              <button
                className="secondary-action"
                onClick={() =>
                  alert(
                    `Opening ${material.title}`
                  )
                }
              >
                Open Resource →
              </button>

            </div>
          ))}

        </div>
      )}

    </div>
  );


  const renderAssignments = () => (
    <div className="page-container">

      <div className="page-header">

        <div>
          <p className="page-label">
            COURSEWORK
          </p>

          <h1>
            Assignments
          </h1>

          <p>
            View your assignments and keep track
            of your coursework.
          </p>
        </div>

        <div className="page-header-icon">
          📝
        </div>

      </div>


      {assignments.length === 0 ? (
        <div className="large-empty-state">

          <div>📝</div>

          <h2>
            No assignments available
          </h2>

          <p>
            Assignments given by your lecturers
            will appear here.
          </p>

        </div>
      ) : (
        <div className="assignment-page-list">

          {assignments.map((assignment) => (
            <div
              className="assignment-large-card"
              key={assignment.id}
            >

              <div className="assignment-large-icon">
                📝
              </div>

              <div className="assignment-large-content">

                <span>
                  Course ID: {assignment.course}
                </span>

                <h2>
                  {assignment.title}
                </h2>

                <p>
                  {assignment.description}
                </p>

                <div className="assignment-due">
                  📅 Due:{" "}
                  {assignment.due_date
                    ? new Date(
                        assignment.due_date
                      ).toLocaleString()
                    : "Not specified"}
                </div>

              </div>

              <button
                className="primary-action"
                onClick={() =>
                  alert(
                    "Assignment submission will be connected next."
                  )
                }
              >
                View Assignment →
              </button>

            </div>
          ))}

        </div>
      )}

    </div>
  );


  const renderQuizzes = () => (
    <div className="page-container">

      <div className="page-header">

        <div>
          <p className="page-label">
            ASSESSMENT
          </p>

          <h1>
            Quizzes
          </h1>

          <p>
            Test your knowledge through online
            quizzes.
          </p>
        </div>

        <div className="page-header-icon">
          🎯
        </div>

      </div>


      {quizzes.length === 0 ? (
        <div className="large-empty-state">

          <div>🎯</div>

          <h2>
            No quizzes available
          </h2>

          <p>
            Your available quizzes will appear here.
          </p>

        </div>
      ) : (
        <div className="quiz-grid">

          {quizzes.map((quiz) => (
            <div
              className="quiz-card"
              key={quiz.id}
            >

              <div className="quiz-icon">
                🎯
              </div>

              <span>
                QUIZ
              </span>

              <h2>
                {quiz.title}
              </h2>

              <p>
                {quiz.description ||
                  "Online assessment"}
              </p>

              <div className="quiz-details">

                <div>
                  <span>
                    Duration
                  </span>

                  <strong>
                    {quiz.duration_minutes} min
                  </strong>
                </div>

                <div>
                  <span>
                    Total Marks
                  </span>

                  <strong>
                    {quiz.total_marks}
                  </strong>
                </div>

              </div>

              <button
                className="primary-action"
                onClick={() =>
                  alert(
                    `${quiz.title} will be connected to the quiz system next.`
                  )
                }
              >
                Start Quiz →
              </button>

            </div>
          ))}

        </div>
      )}

    </div>
  );


  const renderProfile = () => (
    <div className="page-container">

      <div className="page-header">

        <div>
          <p className="page-label">
            ACCOUNT
          </p>

          <h1>
            My Profile
          </h1>

          <p>
            View your student account information.
          </p>
        </div>

        <div className="page-header-icon">
          👤
        </div>

      </div>


      <div className="profile-page-card">

        <div className="profile-page-top">

          <div className="profile-page-avatar">
            {firstName.charAt(0).toUpperCase()}
          </div>

          <div>
            <span>
              STUDENT
            </span>

            <h2>
              {fullName}
            </h2>

            <p>
              {user?.email ||
                "No email address"}
            </p>
          </div>

        </div>


        <div className="profile-information">

          <div className="profile-information-item">
            <span>
              Username
            </span>

            <strong>
              {user?.username ||
                "Not available"}
            </strong>
          </div>

          <div className="profile-information-item">
            <span>
              Email Address
            </span>

            <strong>
              {user?.email ||
                "Not available"}
            </strong>
          </div>

          <div className="profile-information-item">
            <span>
              First Name
            </span>

            <strong>
              {user?.first_name ||
                "Not provided"}
            </strong>
          </div>

          <div className="profile-information-item">
            <span>
              Last Name
            </span>

            <strong>
              {user?.last_name ||
                "Not provided"}
            </strong>
          </div>

          <div className="profile-information-item">
            <span>
              Registration Number
            </span>

            <strong>
              {profile?.registration_number ||
                "Not provided"}
            </strong>
          </div>

          <div className="profile-information-item">
            <span>
              Phone Number
            </span>

            <strong>
              {profile?.phone_number ||
                "Not provided"}
            </strong>
          </div>

          <div className="profile-information-item">
            <span>
              Account Role
            </span>

            <strong>
              {profile?.role ||
                "Student"}
            </strong>
          </div>

        </div>

      </div>

    </div>
  );


  const renderSettings = () => (
    <div className="page-container">

      <div className="page-header">

        <div>
          <p className="page-label">
            ACCOUNT MANAGEMENT
          </p>

          <h1>
            Settings
          </h1>

          <p>
            Manage your student portal preferences.
          </p>
        </div>

        <div className="page-header-icon">
          ⚙️
        </div>

      </div>


      <div className="settings-card">

        <div className="settings-section">

          <div className="settings-icon">
            🔐
          </div>

          <div>
            <h2>
              Account Security
            </h2>

            <p>
              Your account uses secure token-based
              authentication.
            </p>
          </div>

          <button
            onClick={() =>
              alert(
                "Password change functionality will be connected next."
              )
            }
          >
            Change Password
          </button>

        </div>


        <div className="settings-section">

          <div className="settings-icon">
            🔔
          </div>

          <div>
            <h2>
              Notifications
            </h2>

            <p>
              Stay informed about assignments,
              quizzes and course updates.
            </p>
          </div>

          <button
            onClick={() =>
              alert(
                "Notification preferences will be connected next."
              )
            }
          >
            Manage
          </button>

        </div>


        <div className="settings-section">

          <div className="settings-icon">
            🎓
          </div>

          <div>
            <h2>
              Student Portal
            </h2>

            <p>
              E-Learning student portal for courses,
              materials and assessments.
            </p>
          </div>

          <strong>
            Active
          </strong>

        </div>

      </div>

    </div>
  );


  const renderPage = () => {
    switch (activePage) {
      case "courses":
        return renderCourses();

      case "materials":
        return renderMaterials();

      case "assignments":
        return renderAssignments();

      case "quizzes":
        return renderQuizzes();

      case "profile":
        return renderProfile();

      case "settings":
        return renderSettings();

      default:
        return renderDashboard();
    }
  };


  return (
    <div className="student-dashboard">

      {/* TOP BAR */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            🎓
          </div>

          <div>
            <h2>
              E-Learning
            </h2>

            <span>
              Student Portal
            </span>
          </div>

        </div>


        <div className="topbar-right">

          <button
            className="notification-button"
            onClick={() =>
              alert(
                "You currently have no new notifications."
              )
            }
          >
            🔔
          </button>


          <div className="student-mini-profile">

            <div className="avatar">
              {firstName
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                {firstName}
              </strong>

              <span>
                Student
              </span>
            </div>

          </div>

        </div>

      </header>


      <div className="dashboard-layout">

        {/* SIDEBAR */}

        <aside className="sidebar">

          <nav>

            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`sidebar-link ${
                  activePage === item.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setActivePage(item.id)
                }
              >
                <span>
                  {item.icon}
                </span>

                {item.label}
              </button>
            ))}

          </nav>


          <button
            className="sidebar-logout"
            onClick={onLogout}
          >
            <span>
              🚪
            </span>

            Logout
          </button>

        </aside>


        {/* MAIN CONTENT */}

        <main className="dashboard-content">
          {renderPage()}
        </main>

      </div>

    </div>
  );
}

export default Dashboard;