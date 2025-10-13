import fetch from "node-fetch";

const API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIwNmM5YTE3NDQ1ZDg0NWFiMGM0ZTdhNDdkNjQ2NThjZCIsIm5iZiI6MTc1OTM5MjA4My43OTcsInN1YiI6IjY4ZGUzMTUzMGRmNDQ2ZjY0YjQwNWI5OSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.k3LgbkFJduHDCvd7Tc7h7jFIiYk-lCHgKPO-TkzGFaw"; // TMDb sitesinden aldığın key
const BASE_URL = "https://api.themoviedb.org/3";

async function getMovie(id) {
  const url = `${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=en-US`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(data);
}

getMovie(550); // Fight Club
