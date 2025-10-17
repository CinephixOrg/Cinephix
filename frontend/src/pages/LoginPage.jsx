// src/pages/LoginPage.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const { login } = useContext(AuthContext);
    const navigate = useNavigate();


    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate("/home"); // giriş sonrası yönlendirme
        } catch (err) {
            alert("Login failed! Check your credentials.");
            console.error(err);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[radial-gradient(circle_at_top,_#eef2f3,_#8e9eab)]">
            <div className="bg-white p-10 sm:p-12 rounded-2xl w-full max-w-md shadow-lg text-center">
                <h1 className="text-2xl mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-yellow-400 font-bold">Cinephix 🎬</h1>
                <h2 className="text-xl mb-1 text-gray-900">Welcome Back</h2>
                <p className="text-gray-500 text-sm mb-8">Find your movie match again!</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        className="px-4 py-3 rounded-lg border border-gray-300 text-base outline-none focus:border-blue-500"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        className="px-4 py-3 rounded-lg border border-gray-300 text-base outline-none focus:border-blue-500"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button className="btn btn-primary">Login</button>
                </form>

                <p className="mt-6 text-sm text-gray-600">Don’t have an account? <Link to="/register" className="text-pink-500 font-semibold">Sign up</Link></p>
            </div>
        </div>
    );
}

