import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { userService } from '../api/userService';

export default function SettingsPage() {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Şifre Değiştirme State'leri
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loadingPass, setLoadingPass] = useState(false);

  // Tema State'i (DaisyUI temaları)
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "forest");

  // Temayı uygula
  useEffect(() => {
    document.querySelector('html').setAttribute('data-theme', theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleThemeChange = (e) => {
    setTheme(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.error("Yeni şifreler eşleşmiyor!");
    }
    if (passwords.newPassword.length < 6) {
      return toast.error("Şifre en az 6 karakter olmalı.");
    }

    setLoadingPass(true);
    try {
      await userService.updatePassword(passwords.currentPassword, passwords.newPassword);
      toast.success("Şifreniz başarıyla güncellendi!");
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || "Şifre değiştirilemedi.");
    } finally {
      setLoadingPass(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Hesabınızı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) {
      try {
        await userService.deleteAccount();
        toast.success("Hesabınız silindi. Hoşçakalın!");
        logout();
        navigate('/');
      } catch (err) {
        toast.error("Hesap silinirken bir hata oluştu.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-4 md:p-10 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        

        {/* 2. GÜVENLİK AYARLARI */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title mb-4">Security</h2>
            <form onSubmit={submitPasswordChange} className="flex flex-col gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Current Password</span></label>
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
                  <label className="label"><span className="label-text">New Password</span></label>
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
                  <label className="label"><span className="label-text">Confirm New Password</span></label>
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
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 3. TEHLİKELİ BÖLGE */}
        <div className="card bg-base-100 shadow-xl border-2 border-error/20">
          <div className="card-body">
            <h2 className="card-title text-error mb-2">Danger Zone</h2>
            <p className="text-base-content/70 mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <div className="card-actions justify-start">
              <button onClick={handleDeleteAccount} className="btn btn-outline btn-error">
                Delete Account
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}