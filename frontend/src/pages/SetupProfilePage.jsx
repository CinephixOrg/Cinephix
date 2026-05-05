import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function SetupProfilePage() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(user?.profile_pic_url || null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error("Username cannot be empty");
      return;
    }
    setLoading(true);

    try {
      // 1. Update Profile (Username & Bio)
      const profileRes = await API.patch(`/users/profile/${user._id}/bio`, {
        username,
        bio,
      });

      // Update the context with new basic info
      setUser(profileRes.data.data);

      // 2. Upload Profile Picture if selected
      if (file) {
        const formData = new FormData();
        formData.append("profilePic", file); // Must match the 'upload.single("profilePic")' in backend
        const picRes = await API.post(`/users/profile/${user._id}/upload-profile-pic`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (picRes.data?.data) {
           setUser(picRes.data.data);
        }
      }

      toast.success("Profile setup complete! 🎉", {
        style: { background: "#1a1a1a", color: "#fff" },
      });
      navigate("/home");
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || "Failed to save profile details.";
      toast.error(msg, { style: { background: "#1a1a1a", color: "#fff" } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-theme="forest" className="flex items-center justify-center min-h-screen bg-base-200 py-10">
      <div className="card w-full max-w-md shadow-xl bg-base-100">
        <div className="card-body items-center text-center">
          <h2 className="card-title text-3xl text-primary mb-2">Welcome! 🎬</h2>
          <p className="text-base-content/70 mb-6">
            Let's setup your Cinephix profile before you dive in.
          </p>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 items-center">
            {/* Avatar Upload */}
            <div className="avatar mb-4 relative group cursor-pointer">
              <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden bg-neutral flex items-center justify-center">
                {preview ? (
                  <img src={preview} alt="Profile Preview" className="object-cover w-full h-full" />
                ) : (
                  <span className="text-3xl text-neutral-content">📸</span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-secondary text-secondary-content p-1 rounded-full cursor-pointer hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileChange} 
                />
              </label>
            </div>

            {/* Username Input */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Choose a Username</span>
              </label>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input input-bordered w-full"
                required
              />
            </div>

            {/* Bio Input */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Short Bio (Optional)</span>
              </label>
              <textarea
                placeholder="I love sci-fi and thriller movies..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="textarea textarea-bordered w-full h-24"
              ></textarea>
            </div>

            <button
              type="submit"
              className={`btn btn-primary w-full mt-4 ${loading ? "loading" : ""}`}
              disabled={loading}
            >
              {loading ? "Saving..." : "Start Exploring"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-2 text-base-content/50"
              onClick={() => navigate("/home")}
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
