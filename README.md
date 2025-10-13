# 🎬 Cinephix

**Find your perfect movie match! Cinephix is a social discovery platform designed to connect cinephiles and TV show enthusiasts based on their shared tastes.**

Have you ever finished an amazing season finale and had no one to discuss it with? Or wanted to find friends who appreciate the same niche films as you? Cinephix solves that problem by matching you with people who love what you love.

---

## ✨ Key Features

* **🎬 Browse & Discover:** Explore a vast library of movies and TV shows powered by the TMDB API.
* **⭐ Rate & Watchlist:** Rate the content you've seen and add others to your watchlist to build your unique taste profile.
* **🎭 Build Your Profile:** Customize your profile with your favorite genres, a short bio, and see a summary of your viewing habits.
* **🤝 Get Matched:** Our core algorithm analyzes your ratings and watchlist to calculate a compatibility score with other users, suggesting potential friends.
* **💬 Chat with Cinephiles:** Once you match with someone, you can start a conversation and plan your next movie night!

---

## 🛠️ Built With

Cinephix is a full-stack application built with the MERN stack and other modern technologies.

* **Frontend:**
    * [React.js](https://reactjs.org/)
    * [React Router](https://reactrouter.com/) for page navigation
    * [Axios](https://axios-http.com/) for API requests
    * [CSS / Styled-Components / Tailwind CSS] * **Backend:**
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
    git clone [https://github.com/your-username/Cinephix.git](https://github.com/your-username/Cinephix.git)
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

## 🗺️ Roadmap

* [ ] Real-time chat with Socket.IO
* [ ] Advanced filtering for matches (by genre, decade, etc.)
* [ ] Group matching functionality
* [ ] Push notifications for new matches and messages

See the [open issues](https://github.com/your-username/Cinephix/issues) for a full list of proposed features (and known issues).

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

## 📧 Contact

Your Name - [@your_twitter_handle](https://twitter.com/your_twitter_handle) - your.email@example.com

Project Link: [https://github.com/your-username/Cinephix](https://github.com/your-username/Cinephix)
