import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import "./App.css";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(
    Boolean(localStorage.getItem("token"))
  );

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/login/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: username,
            password: password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Invalid username or password."
        );

        setLoading(false);
        return;
      }

      localStorage.setItem(
        "token",
        data.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      localStorage.setItem(
        "profile",
        JSON.stringify(data.profile)
      );

      setLoggedIn(true);
      setLoading(false);

    } catch (error) {

      console.error(error);

      setError(
        "Unable to connect to the server. Please make sure Django is running."
      );

      setLoading(false);
    }
  };


  const handleLogout = async () => {

    const token = localStorage.getItem("token");

    try {

      if (token) {
        await fetch(
          "http://127.0.0.1:8000/api/logout/",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type":
                "application/json",
            },
          }
        );
      }

    } catch (error) {
      console.error(error);
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("profile");

    setLoggedIn(false);
    setUsername("");
    setPassword("");
  };


  if (loggedIn) {
    return (
      <Dashboard
        onLogout={handleLogout}
      />
    );
  }


  return (
    <div className="login-page">

      <div className="login-container">

        {/* LEFT SIDE */}

        <div className="login-welcome">

          <div className="welcome-overlay">

            <div className="education-icon">
              🎓
            </div>

            <h1>
              Learn.
              <br />
              Grow.
              <br />
              Succeed.
            </h1>

            <p>
              Your digital learning space for
              courses, assignments, learning
              materials and quizzes.
            </p>

            <div className="login-features">

              <div>
                📚
                <span>
                  Access your courses
                </span>
              </div>

              <div>
                📝
                <span>
                  Submit assignments
                </span>
              </div>

              <div>
                🎯
                <span>
                  Take online quizzes
                </span>
              </div>

            </div>

          </div>

        </div>


        {/* RIGHT SIDE */}

        <div className="login-form-section">

          <div className="login-form-container">

            <div className="small-logo">
              🎓
            </div>

            <p className="portal-label">
              STUDENT PORTAL
            </p>

            <h2>
              Welcome Back!
            </h2>

            <p className="login-description">
              Sign in to continue your
              learning journey.
            </p>


            {error && (
              <div className="error-message">
                {error}
              </div>
            )}


            <form
              onSubmit={handleLogin}
              className="login-form"
            >

              <div className="input-group">

                <label htmlFor="username">
                  Username
                </label>

                <div className="input-wrapper">

                  <span>
                    👤
                  </span>

                  <input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>

              </div>


              <div className="input-group">

                <label htmlFor="password">
                  Password
                </label>

                <div className="input-wrapper">

                  <span>
                    🔒
                  </span>

                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    required
                  />

                </div>

              </div>


              <div className="login-options">

                <label>
                  <input
                    type="checkbox"
                  />

                  <span>
                    Remember me
                  </span>
                </label>

                <button
                  type="button"
                  className="forgot-password"
                  onClick={() =>
                    alert(
                      "Please contact your administrator to reset your password."
                    )
                  }
                >
                  Forgot password?
                </button>

              </div>


              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >

                {loading
                  ? "Signing in..."
                  : "Sign In →"}

              </button>

            </form>


            <div className="login-help">

              <span>
                🔐
              </span>

              <p>
                Your account is protected by
                secure authentication.
              </p>

            </div>


            <p className="copyright">
              Student E-Learning Portal
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}

export default App;