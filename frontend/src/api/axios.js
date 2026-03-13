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

// Response interceptor to unwrap the data structure
// Backend returns { success, message, data }, we extract just the data
API.interceptors.response.use(
  (res) => {
    // If response has data property with success/message structure, unwrap it
    if (res.data && res.data.data !== undefined && res.data.success !== undefined) {
      res.data = res.data.data;
    }
    return res;
  },
  (error) => Promise.reject(error)
);

export default API;
