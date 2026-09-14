import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { RatingsContext } from '../context/RatingsContext';
import { userService } from '../api/userService';
import API from '../api/axios';
import ImageCropper from '../components/ImageCropper.jsx';
import { clearCacheItem, CACHE_KEYS } from '../api/cacheService';
import { useTranslation } from "react-i18next";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, updateUser, logout } = useContext(AuthContext);
  const { refreshRatings } = useContext(RatingsContext) || {};
  const navigate = useNavigate();
  const isOAuthUser = Boolean(user?.isOAuthUser || (user?.googleId && !user?.password));

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('settingsActiveTab') || 'profile');

  // Username state
  const [newUsername, setNewUsername] = useState('');
  const [loadingUsername, setLoadingUsername] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [selectedFileForCrop, setSelectedFileForCrop] = useState(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Import State
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importMetrics, setImportMetrics] = useState(null);
  const [importStep, setImportStep] = useState('idle'); // 'idle' | 'movies' | 'shows' | 'completed' | 'error'
  const [percentProgress, setPercentProgress] = useState(0);
  const [activeProgressText, setActiveProgressText] = useState('');
  const [importSource, setImportSource] = useState('letterboxd'); // 'tvtime' | 'letterboxd'

  // Şifre Değiştirme State'leri
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loadingPass, setLoadingPass] = useState(false);

  // Activity Log State
  const [logs, setLogs] = useState([]);
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [revertingLogs, setRevertingLogs] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resettingData, setResettingData] = useState(false);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchLogs();
    }
  }, [activeTab]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await API.get('/users/me/logs');
      console.log("Fetched Data:", res.data);
      setLogs(Array.isArray(res.data) ? res.data : []);
      setSelectedLogs(new Set());
    } catch (err) {
      toast.error('Failed to load activity logs.');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleToggleLog = (logId) => {
    const next = new Set(selectedLogs);
    if (next.has(logId)) {
      next.delete(logId);
    } else {
      next.add(logId);
    }
    setSelectedLogs(next);
  };

  const handleUndoSelected = async () => {
    if (selectedLogs.size === 0) return;
    setRevertingLogs(true);
    try {
      await API.post('/users/me/logs/revert', { logIds: Array.from(selectedLogs) });
      toast.success('Selected transactions reverted.');
      fetchLogs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revert transactions.');
    } finally {
      setRevertingLogs(false);
    }
  };

  const handleResetData = async () => {
    setResettingData(true);
    try {
      await API.post('/users/me/reset-data');
      toast.success('All data has been reset.');
      setShowResetModal(false);
      fetchLogs();
    } catch (err) {
      toast.error('Failed to reset data.');
    } finally {
      setResettingData(false);
    }
  };

  // Tema State'i (DaisyUI temaları)
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "forest");
  const availableThemes = ['forest', 'dark', 'dim', 'black', 'luxury', 'dracula', 'sunset', 'synthwave', 'coffee'];

  // Temayı uygula
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('settingsActiveTab', activeTab);
  }, [activeTab]);

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileForCrop(file);
    setIsCropOpen(true);
    e.target.value = ''; // Reset input to allow selecting same file again
  };

  const handleEditCurrentAvatar = () => {
    if (!user?.profile_pic_url) return;
    setSelectedFileForCrop(user.profile_pic_url);
    setIsCropOpen(true);
  };

  const handleCropCancel = () => {
    setSelectedFileForCrop(null);
    setIsCropOpen(false);
  };

  const handleCropConfirm = (blob) => {
    const croppedFile = new File([blob], 'profile.png', { type: blob.type });
    setAvatarFile(croppedFile);
    setAvatarPreview(URL.createObjectURL(croppedFile));
    setSelectedFileForCrop(null);
    setIsCropOpen(false);
  };

  const submitAvatarChange = async (e) => {
    e.preventDefault();
    if (!avatarFile) {
      toast.error('Please choose an image file first.');
      return;
    }

    setLoadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('profilePic', avatarFile);

      const res = await userService.uploadProfilePic(user._id, formData);
      const profilePicUrl = res?.profilePicUrl || '';

      if (!profilePicUrl) {
        throw new Error('Profile picture URL not returned.');
      }

      updateUser({ profile_pic_url: profilePicUrl });
      toast.success('Profile picture updated successfully!');
      setAvatarFile(null);
      setAvatarPreview('');
    } catch (err) {
      const msg = err.message || 'Failed to update profile picture.';
      toast.error(msg);
    } finally {
      setLoadingAvatar(false);
    }
  };

  const submitUsernameChange = async (e) => {
    e.preventDefault();
    const trimmed = newUsername.trim();
    if (!trimmed) return toast.error('Username cannot be empty.');
    if (trimmed.length < 3 || trimmed.length > 20)
      return toast.error('Username must be 3–20 characters.');
    if (trimmed === user?.username)
      return toast.error('That is already your current username.');

    setLoadingUsername(true);
    try {
      const res = await API.patch(`/users/profile/${user._id}/bio`, { username: trimmed });
      updateUser({ username: res.data.username });
      toast.success('Username updated successfully!');
      setNewUsername('');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update username.';
      toast.error(msg);
    } finally {
      setLoadingUsername(false);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.error("New passwords do not match!");
    }
    if (passwords.newPassword.length < 6) {
      return toast.error("Password must be at least 6 characters.");
    }

    setLoadingPass(true);
    try {
      await userService.updatePassword(passwords.currentPassword, passwords.newPassword);
      toast.success("Password updated successfully!");
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setLoadingPass(false);
    }
  };

  const handleDeleteAccount = async () => {
    setShowDeleteModal(false);
    try {
      await userService.deleteAccount();
      toast.success("Your account has been deleted. Goodbye!");
      logout();
      navigate('/');
    } catch (err) {
      toast.error("An error occurred while deleting your account.");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    validateAndSetFile(droppedFile);
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
      toast.error('Please upload a valid .zip archive.');
      return;
    }
    setImportFile(selectedFile);
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      toast.error('Please select a file to import.');
      return;
    }

    setUploading(true);
    setImportMetrics(null);
    setPercentProgress(0);
    setImportStep('movies');
    setActiveProgressText('Uploading archive...');

    const formData = new FormData();
    formData.append('zipFile', importFile);

    try {
      const userStr = localStorage.getItem('user');
      const token = userStr ? JSON.parse(userStr)?.token : null;
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const endpoint = importSource === 'letterboxd' ? '/users/import-letterboxd' : '/users/import-tvtime';
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: 'POST',
        body: formData,
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to upload ZIP archive: Status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const dataStr = line.substring(5).trim();
            if (!dataStr) continue; // Boş satırları atla

            try {
              const parsed = JSON.parse(dataStr);

              // 'parsed' verisinin varlığını ve beklediğimiz yapıda olduğunu kontrol et
              if (!parsed) continue;

              // Defensive check for 'files' property to prevent 'reading some of undefined' errors
              if (parsed.data && parsed.data.files && Array.isArray(parsed.data.files)) {
                 // Code safely accesses parsed.data.files.some(...) if necessary
                 const hasWatched = parsed.data.files.some(f => f.entryName === "watched.csv");
              }

              if (parsed.status === "completed") {
                // ... (başarılı tamamlanma kodların olduğu blok - aynı kalabilir)
                const { importedMovies, importedEpisodes } = parsed;
                setImportStep('completed');
                setPercentProgress(100);
                setActiveProgressText('Import completed!');
                setImportMetrics({ importedMovies, importedEpisodes });
                // ... (cache temizleme ve refresh kısımları)
                toast.success(`Import complete!`);
                setImportFile(null);
                fetchLogs();
              } else if (parsed.status === "error") {
                throw new Error(parsed.message || 'Import error');
              } else {
                // İlerleme çubuğu güncellemesi
                const { step, current, total, text } = parsed;

                // GÜVENLİ OKUMA: text verisi null veya undefined ise "Processing..." olarak varsay
                const safeText = text || "Processing...";
                const displaySubtext = safeText.includes('(') ? safeText.split('(')[1]?.replace(')', '') : safeText;

                setImportStep(step || 'processing');
                setActiveProgressText(`Processing ${step === 'movies' ? 'Movie' : 'Episode'} ${current || 0} / ${total || 0}: ${displaySubtext}`);

                // Yüzde hesaplama
                let percent = 0;
                if (total && total > 0) {
                  if (step === 'movies') percent = Math.round((current / total) * 50);
                  else if (step === 'shows') percent = 50 + Math.round((current / total) * 50);
                }
                setPercentProgress(percent);
              }
            } catch (err) {
              // JSON Parse hatası veya veri işleme hatası
              console.error("SSE Verisi işlenirken hata oluştu:", err, "Gelen satır:", dataStr);
            }
          }
        }

      }
    } catch (err) {
      console.error("Import failed:", err);
      const errMsg = err.message || 'An error occurred during import.';
      toast.error(errMsg);
      setImportStep('error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-100 p-4 md:p-10 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-base-content mb-8">{t("Settings")}</h1>

        <div role="tablist" className="tabs tabs-lifted mb-6">
          <button
            role="tab"
            type="button"
            className={`tab text-base-content ${activeTab === 'profile' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            {t("Profile")}
          </button>
          <button
            role="tab"
            type="button"
            className={`tab text-base-content ${activeTab === 'account' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            {t("Account")}
          </button>
          <button
            role="tab"
            type="button"
            className={`tab text-base-content ${activeTab === 'preferences' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            {t("Preferences")}
          </button>
          <button
            role="tab"
            type="button"
            className={`tab text-base-content ${activeTab === 'import' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            {t("Import / Export")}
          </button>
          <button
            role="tab"
            type="button"
            className={`tab text-base-content ${activeTab === 'activity' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            {t("Activity Log")}
          </button>
        </div>

        <div className="card bg-base-200 shadow-xl border border-base-300">
          <div className="card-body">
            {activeTab === 'profile' && (
              <div className="space-y-8">
                <div>
                  <h2 className="card-title mb-4">{t("Avatar")}</h2>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-4">
                    <div className="avatar">
                      <div className="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 bg-base-300 overflow-hidden">
                        {avatarPreview || user?.profile_pic_url ? (
                          <img
                            src={avatarPreview || user?.profile_pic_url}
                            alt="Profile"
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl font-bold text-base-content/70">
                            {(user?.username?.[0] || '?').toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <form onSubmit={submitAvatarChange} className="flex-1 flex flex-col gap-3">
                      <div className="flex items-center gap-3 w-full">
                        <label className="btn btn-outline btn-sm cursor-pointer">
                          {t("Choose File")}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarFileChange}
                            className="hidden"
                          />
                        </label>
                        {user?.profile_pic_url && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={handleEditCurrentAvatar}
                          >
                            {t("Edit")}
                          </button>
                        )}
                        <span className="text-sm text-base-content/60 truncate max-w-xs">
                          {avatarFile ? avatarFile.name : t("No file chosen")}
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className={`btn btn-primary ${loadingAvatar ? 'loading' : ''}`}
                          disabled={loadingAvatar || !avatarFile}
                        >
                          {t("Update Avatar")}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div>
                  <h2 className="card-title mb-1">{t("Username")}</h2>
                  <p className="text-base-content/60 text-sm mb-4">
                    {t("Current username:")} <span className="font-semibold text-primary">@{user?.username}</span>
                  </p>
                  <form onSubmit={submitUsernameChange} className="flex flex-col gap-4">
                    <div className="form-control">
                      <label className="label"><span className="label-text">{t("New Username")}</span></label>
                      <input
                        type="text"
                        placeholder={t("Enter new username")}
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="input input-bordered"
                        minLength={3}
                        maxLength={20}
                        required
                      />
                    </div>
                    <div className="card-actions justify-end">
                      <button
                        type="submit"
                        className={`btn btn-primary ${loadingUsername ? 'loading' : ''}`}
                        disabled={loadingUsername}
                      >
                        {t("Update Username")}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="flex flex-col gap-8">
                <div>
                  <h2 className="card-title mb-4">{t("Security")}</h2>
                  {isOAuthUser ? (
                    <div className="alert alert-info">
                      <span>{t("Logged in via Google")}</span>
                    </div>
                  ) : (
                    <form onSubmit={submitPasswordChange} className="flex flex-col gap-4">
                      <div className="form-control">
                        <label className="label"><span className="label-text">{t("Current Password")}</span></label>
                        <input
                          type="password"
                          name="currentPassword"
                          value={passwords.currentPassword}
                          onChange={handlePasswordChange}
                          className="input input-bordered"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-control">
                          <label className="label"><span className="label-text">{t("New Password")}</span></label>
                          <input
                            type="password"
                            name="newPassword"
                            value={passwords.newPassword}
                            onChange={handlePasswordChange}
                            className="input input-bordered"
                            required
                          />
                        </div>
                        <div className="form-control">
                          <label className="label"><span className="label-text">{t("Confirm New Password")}</span></label>
                          <input
                            type="password"
                            name="confirmPassword"
                            value={passwords.confirmPassword}
                            onChange={handlePasswordChange}
                            className="input input-bordered"
                            required
                          />
                        </div>
                      </div>
                      <div className="card-actions justify-end mt-4">
                        <button
                          type="submit"
                          className={`btn btn-primary ${loadingPass ? 'loading' : ''}`}
                          disabled={loadingPass}
                        >
                          {t("Update Password")}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                <div className="card bg-base-300 shadow-xl border border-error/30">
                  <div className="card-body">
                    <h2 className="card-title text-error mb-2">{t("Danger Zone")}</h2>
                    <p className="text-base-content/70 mb-4">
                      {t("Delete warning")}
                    </p>
                    <div className="card-actions justify-start">
                      <button onClick={() => setShowDeleteModal(true)} className="btn btn-outline btn-error">
                        {t("Delete Account")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div>
                <h2 className="card-title mb-2">{t("Appearance")}</h2>
                <p className="text-base-content/60 text-sm mb-6">
                  {t("Choose the theme")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableThemes.map((themeName) => {
                    const isActive = theme === themeName;

                    return (
                      <div key={themeName} data-theme={themeName}>
                        <button
                          type="button"
                          onClick={() => setTheme(themeName)}
                          className={`card w-full border transition-all duration-200 text-left ${isActive
                            ? 'border-primary bg-base-300 shadow-lg scale-[1.01]'
                            : 'border-base-300 bg-base-200 hover:border-primary/50 hover:bg-base-300'
                            }`}
                        >
                          <div className="card-body p-4 gap-2">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="font-semibold capitalize text-base-content">{themeName}</h3>
                              {isActive && <span className="badge badge-primary">{t("Active")}</span>}
                            </div>
                            <div className="flex gap-2 mt-1">
                              <span className="inline-block h-3 w-3 rounded-full bg-primary" />
                              <span className="inline-block h-3 w-3 rounded-full bg-secondary" />
                              <span className="inline-block h-3 w-3 rounded-full bg-accent" />
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'import' && (
              <div>
                <h2 className="card-title mb-2">{t("Import TV Time Data")}</h2>
                <p className="text-base-content/60 text-sm mb-6">
                  {t("Upload a ZIP archive")}
                </p>

                <div className="flex flex-col gap-6">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-all duration-200 ${isDragging
                      ? 'border-primary bg-primary/10'
                      : 'border-base-300 bg-base-200 hover:border-primary/50'
                      }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-12 h-12 text-base-content/60 mb-4 animate-bounce"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                      />
                    </svg>

                    <div className="text-center">
                      <div className="flex justify-center gap-4 mb-4">
                        <label className="label cursor-pointer gap-2">
                          <input type="radio" name="importSource" className="radio radio-primary" checked={importSource === 'letterboxd'} onChange={() => setImportSource('letterboxd')} />
                          <span className="label-text">Letterboxd</span>
                        </label>
                        <label className="label cursor-pointer gap-2">
                          <input type="radio" name="importSource" className="radio radio-primary" checked={importSource === 'tvtime'} onChange={() => setImportSource('tvtime')} />
                          <span className="label-text">TV Time</span>
                        </label>
                      </div>
                      <span className="font-semibold text-base-content">
                        {t("Drag and drop your")} {importSource === 'letterboxd' ? 'Letterboxd' : 'TV Time'} {t("export ZIP here, or")}{' '}
                      </span>
                      <label className="text-primary font-semibold hover:underline cursor-pointer">
                        {t("browse files")}
                        <input
                          type="file"
                          accept=".zip"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <span className="text-xs text-base-content/50 mt-1">
                      {t("Strictly accepting .zip files")}
                    </span>

                    {importFile && (
                      <div className="badge badge-primary gap-2 mt-4 py-3 px-4 text-sm font-semibold">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          className="inline-block w-4 h-4 stroke-current"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        {importFile.name}
                      </div>
                    )}
                  </div>

                  {uploading && (
                    <div className="flex flex-col gap-4 p-6 bg-base-300 rounded-xl border border-primary/20 shadow-md">
                      <div className="flex items-center justify-between text-sm font-semibold text-base-content/80">
                        <span className="capitalize flex items-center gap-2">
                          <span className="loading loading-spinner loading-xs text-primary"></span>
                          {t("Step:")} {importStep}
                        </span>
                        <span>{percentProgress}%</span>
                      </div>
                      <progress className="progress progress-primary w-full shadow-inner h-3" value={percentProgress} max="100"></progress>
                      <p className="text-xs font-medium text-base-content/60 truncate italic">
                        {activeProgressText || t("Processing your archive")}
                      </p>
                    </div>
                  )}

                  {!uploading && importFile && (
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setImportFile(null)}
                      >
                        {t("Cancel")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleImportSubmit}
                      >
                        {t("Upload Export ZIP")}
                      </button>
                    </div>
                  )}

                  {importMetrics && (
                    <div className="alert alert-success border border-success/30 flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="stroke-current shrink-0 h-6 w-6 text-success-content"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-success-content">{t("Import Metrics Summary")}</h3>
                        <div className="text-sm opacity-90 text-success-content">
                          <p>• {t("Movies Imported:")} <strong>{importMetrics.importedMovies}</strong></p>
                          <p>• {t("Episodes Imported:")} <strong>{importMetrics.importedEpisodes}</strong></p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div>
                <h2 className="card-title mb-2">{t("Activity Log")}</h2>
                <p className="text-base-content/60 text-sm mb-6">
                  {t("Review your recent actions")}
                </p>

                <div className="flex justify-between items-center mb-4">
                  <button 
                    className={`btn btn-primary btn-sm ${revertingLogs ? 'loading' : ''}`}
                    disabled={selectedLogs.size === 0 || revertingLogs}
                    onClick={handleUndoSelected}
                  >
                    {t("Undo Selected")} ({selectedLogs.size})
                  </button>
                  <button 
                    className="btn btn-outline btn-error btn-sm"
                    onClick={() => setShowResetModal(true)}
                  >
                    {t("Reset All Data")}
                  </button>
                </div>

                {loadingLogs ? (
                  <div className="flex justify-center p-10"><span className="loading loading-spinner text-primary"></span></div>
                ) : logs.length === 0 ? (
                  <div className="text-center p-10 bg-base-200 rounded-lg text-base-content/60">{t("No recent activity.")}</div>
                ) : (
                  <div className="overflow-x-auto bg-base-200 rounded-lg border border-base-300">
                    <table className="table table-sm w-full">
                      <thead>
                        <tr>
                          <th></th>
                          <th>{t("Date")}</th>
                          <th>{t("Action")}</th>
                          <th>{t("Details")}</th>
                          <th>{t("Status")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log._id} className={log.isReverted ? "opacity-50 line-through" : ""}>
                            <td>
                              {!log.isReverted && (
                                <input 
                                  type="checkbox" 
                                  className="checkbox checkbox-sm checkbox-primary" 
                                  checked={selectedLogs.has(log._id)}
                                  onChange={() => handleToggleLog(log._id)}
                                />
                              )}
                            </td>
                            <td>{new Date(log.createdAt).toLocaleString()}</td>
                            <td><div className="badge badge-ghost badge-sm">{log.actionType}</div></td>
                            <td>{log.details}</td>
                            <td>
                              {log.isReverted ? (
                                <span className="text-error font-semibold text-xs">{t("Reverted")}</span>
                              ) : (
                                <span className="text-success font-semibold text-xs">{t("Active")}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

      {isCropOpen && selectedFileForCrop && (
        <ImageCropper
          file={selectedFileForCrop}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}

      {showDeleteModal && (
        <dialog open className="modal modal-open bg-black/60 animate-fade-in">
          <div className="modal-box border border-error/20">
            <h3 className="font-bold text-lg text-error">{t("Delete Account")}</h3>
            <p className="py-4">
              {t("Are you sure you want to delete your account?")}
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)}>
                {t("Cancel")}
              </button>
              <button className="btn btn-error" onClick={handleDeleteAccount}>
                {t("Delete Forever")}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {showResetModal && (
        <dialog open className="modal modal-open bg-black/60 animate-fade-in">
          <div className="modal-box border border-error/20">
            <h3 className="font-bold text-lg text-error">{t("Reset All Data")}</h3>
            <p className="py-4">
              {t("Are you sure you want to reset all your data?")}
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowResetModal(false)} disabled={resettingData}>
                {t("Cancel")}
              </button>
              <button className={`btn btn-error ${resettingData ? 'loading' : ''}`} onClick={handleResetData} disabled={resettingData}>
                {t("Reset Everything")}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}