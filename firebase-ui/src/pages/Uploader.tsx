import { useRef, useState } from "react";
import { Typography, Box, Button, LinearProgress, Alert } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { getStorage, ref, uploadBytesResumable } from "firebase/storage";
import { getAuth } from "firebase/auth";

export default function Uploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSuccess(null);
    setError(null);
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(0);
    setSuccess(null);
    setError(null);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const storage = getStorage();
      const fileNameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      const storageRef = ref(
        storage,
        `videos/${user.uid}/${Date.now()}_${fileNameWithoutExt}/original`
      );
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setProgress(percent);
        },
        (err) => {
          setError(err.message);
          setUploading(false);
        },
        () => {
          setSuccess("Video uploaded successfully!");
          setSelectedFile(null);
          setUploading(false);
          setProgress(100);
        }
      );
    } catch (err: any) {
      setError(err.message || "Upload error");
      setUploading(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 400, mx: "auto" }}>
      <Typography variant="h4" gutterBottom>
        Upload a Video
      </Typography>
      <input
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <Button
        variant="contained"
        color="primary"
        startIcon={<CloudUploadIcon />}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        sx={{ mb: 2 }}
        fullWidth
      >
        {selectedFile ? "Change Video" : "Select Video"}
      </Button>
      {selectedFile && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          Selected: {selectedFile.name}
        </Typography>
      )}
      <Button
        variant="contained"
        color="success"
        onClick={handleUpload}
        disabled={!selectedFile || uploading}
        fullWidth
      >
        Upload
      </Button>
      {uploading && (
        <Box sx={{ width: "100%", mt: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption">{progress}%</Typography>
        </Box>
      )}
      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
