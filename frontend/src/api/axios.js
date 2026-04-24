import axios from 'axios';

// Backend'imizin temel adresini burada tanımlıyoruz.
const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
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
// Backend returns { success, message, data, pagination? }, we extract just the data
// But preserve pagination info if it exists
API.interceptors.response.use(
  (res) => {
    // If response has pagination, keep the structure but unwrap data
    if (res.data && res.data.pagination) {
      const { data, pagination, ...rest } = res.data;
      res.data = data; // response.data is now the array
      res.pagination = pagination; // preserve pagination info
      return res;
    }
    // For non-paginated responses, unwrap the nested data structure
    // (e.g., login/register responses)
    if (res.data && res.data.data !== undefined && res.data.success !== undefined) {
      res.data = res.data.data;
    }
    return res;
  },
  (error) => Promise.reject(error)
);

export default API;
