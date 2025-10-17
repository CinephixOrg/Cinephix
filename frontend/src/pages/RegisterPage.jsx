import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
    });

    const { register } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await register(formData.username, formData.email, formData.password);
            navigate("/home"); // kayıt sonrası yönlendirme
        } catch (err) {
            alert("Registration failed!");
            console.error(err);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[radial-gradient(circle_at_top,_#eef2f3,_#8e9eab)]">
            <div className="bg-white p-10 sm:p-12 rounded-2xl w-full max-w-md shadow-lg text-center">
                <h1 className="text-2xl mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-yellow-400 font-bold">Cinephix 🎬</h1>
                <h2 className="text-xl mb-1 text-gray-900">Create Account</h2>
                <p className="text-gray-500 text-sm mb-8">Join the cinephile community!</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        className="px-4 py-3 rounded-lg border border-gray-300 text-base outline-none focus:border-blue-500"
                        type="text"
                        name="username"
                        placeholder="Username"
                        value={formData.username}
                        onChange={handleChange}
                        required
                    />
                    <input
                        className="px-4 py-3 rounded-lg border border-gray-300 text-base outline-none focus:border-blue-500"
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                    <input
                        className="px-4 py-3 rounded-lg border border-gray-300 text-base outline-none focus:border-blue-500"
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                    <button
                        type="submit"
                        className="bg-gradient-to-r from-pink-500 to-yellow-400 text-white py-3 rounded-lg font-bold hover:opacity-90"
                    >
                        Sign Up
                    </button>
                </form>

                <p className="mt-6 text-sm text-gray-600">
                    Already have an account? <Link to="/login" className="text-pink-500 font-semibold">Login</Link>
                </p>
            </div>
        </div>
    );
}

