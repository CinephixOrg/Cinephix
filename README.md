# 🎬 Cinephix

**Find your perfect movie match! Cinephix is a social discovery platform designed to connect cinephiles and TV show enthusiasts based on their shared tastes.**

Have you ever finished an amazing season finale and had no one to discuss it with? Or wanted to find friends who appreciate the same niche films as you? Cinephix solves that problem by matching you with people who share your cinematic passions, allowing you to build your network, track your viewing habits, and discover new favorites.

---

## ✨ Key Features

* **👤 Social Network:** Follow users, manage your followers/following lists, and build your community.
* **🔒 Privacy Control:** Set your account to "Private" to approve follow requests and keep your CineGraph statistics exclusive to your connections.
* **🔔 Intelligent Notifications:** Stay updated with real-time alerts for new follow requests and accepted connections.
* **📊 Visual Profiling:** Visualize your movie and TV genre distribution with the dynamic CineGraph.
* **🎬 Content Discovery:** Explore a vast library of movies and TV shows powered by the TMDB API.
* **⭐ Taste Profile:** Rate content, build your watchlist, and manage your favorite movies and series.

---

## 🛠️ Built With

Cinephix is a full-stack application built with the MERN stack and other modern technologies.

* **Frontend:**
    * [React.js](https://reactjs.org/)
    * [React Router](https://reactrouter.com/) for page navigation
    * [Axios](https://axios-http.com/) for API requests
    * [Tailwind CSS](https://tailwindcss.com/)
* **Backend:**
    * [Node.js](https://nodejs.org/)
    * [Express.js](https://expressjs.com/) for the REST API
    * [Mongoose](https://mongoosejs.com/) as the Object Data Modeler (ODM)

* **Database:**
    * [MongoDB](https://www.mongodb.com/) (hosted on MongoDB Atlas)

* **APIs & Authentication:**
    * [The Movie Database (TMDB) API](https://www.themoviedb.org/documentation/api) for all movie/show data.
    * [JSON Web Tokens (JWT)](https://jwt.io/) for user authentication and authorization.
    * [bcrypt.js](https://www.npmjs.com/package/bcrypt) for password hashing.

---

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

* Node.js and npm installed
    ```sh
    npm install npm@latest -g
    ```
* A free API key from [The Movie Database (TMDB)](https://www.themoviedb.org/settings/api).
* Your MongoDB connection string.

### Installation

1.  **Clone the repo**
    ```sh
    git clone https://github.com/furkantr18/Cinephix.git
    ```
2.  **Install backend dependencies**
    ```sh
    cd Cinephix/server
    npm install
    ```
3.  **Install frontend dependencies**
    ```sh
    cd ../client
    npm install
    ```
4.  **Create a `.env` file** in the `server` directory and add your environment variables:
    ```env
    MONGO_URI='Your MongoDB Connection String'
    TMDB_API_KEY='Your TMDB API Key'
    JWT_SECRET='Your Secret Key for JWT'
    ```
5.  **Start the development servers**
    * To run the backend server (from the `server` folder):
        ```sh
        npm run dev
        ```
    * To run the frontend React app (from the `client` folder):
        ```sh
        npm start
        ```

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE.txt` for more information.

---

## 📧 Contact - cinephixcontact@gmail.com

Furkan Gökgöz - [LinkedIn](https://www.linkedin.com/in/furkan-g%C3%B6kg%C3%B6z-027479336/)

Nursena Doksanbir - [LinkedIn](https://www.linkedin.com/in/nursena-doksanbir)

Project Link: [https://github.com/furkantr18/Cinephix](https://github.com/furkantr18/Cinephix)
