import axios from 'axios';

// Backend'imizin temel adresini burada tanımlıyoruz.
const API = axios.create({
  baseURL: 'http://localhost:5000/api' 
});

// Bu kısım, bir kullanıcı giriş yaptığında token'ı otomatik olarak
// tüm isteklere eklememizi sağlayacak.
API.interceptors.request.use((req) => {
  const user = localStorage.getItem('user');
  if (user) {
    const token = JSON.parse(user).token;
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
  }
  return req;
});

export default API;
