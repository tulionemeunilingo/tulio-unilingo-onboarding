import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Alert,
  Avatar,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import "./firebase";
import Uploader from "./Uploader";
import ProtectedRoute from "./ProtectedRoute";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const auth = getAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, [auth]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/uploader");
    } catch (err: any) {
      setError("Error signing in: " + err.message);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate("/uploader");
    } catch (err: any) {
      setError("Error signing up: " + err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      setError("Error signing out: " + err.message);
    }
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Container
            maxWidth="xs"
            sx={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Paper elevation={4} sx={{ p: 4, borderRadius: 3, width: "100%" }}>
              <Box display="flex" flexDirection="column" alignItems="center">
                <Avatar sx={{ m: 1, bgcolor: "secondary.main" }}>
                  <LockOutlinedIcon />
                </Avatar>
                <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
                  Authentication
                </Typography>
                {user ? (
                  <Box textAlign="center">
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      Signed in as: <b>{user.email}</b>
                    </Typography>
                    <Button
                      variant="contained"
                      color="error"
                      onClick={handleSignOut}
                      fullWidth
                    >
                      Sign Out
                    </Button>
                  </Box>
                ) : (
                  <Box
                    component="form"
                    onSubmit={handleSignIn}
                    sx={{ width: "100%" }}
                  >
                    <TextField
                      margin="normal"
                      required
                      fullWidth
                      label="Email"
                      type="email"
                      value={email}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setEmail(e.target.value)
                      }
                      autoFocus
                    />
                    <TextField
                      margin="normal"
                      required
                      fullWidth
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setPassword(e.target.value)
                      }
                    />
                    {error && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                      </Alert>
                    )}
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      sx={{ mt: 3, mb: 1 }}
                    >
                      Sign In
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="secondary"
                      onClick={handleSignUp}
                    >
                      Sign Up
                    </Button>
                  </Box>
                )}
              </Box>
            </Paper>
          </Container>
        }
      />
      <Route
        path="/uploader"
        element={
          <ProtectedRoute user={user}>
            <Uploader />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
