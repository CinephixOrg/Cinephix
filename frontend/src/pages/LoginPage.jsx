// src/pages/LoginPage.jsx
import React, { useState } from "react";
import styled from "styled-components";
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
        <Wrapper>
            <LoginCard>
                <Logo>Cinephix 🎬</Logo>
                <Title>Welcome Back</Title>
                <Subtitle>Find your movie match again!</Subtitle>

                <Form onSubmit={handleSubmit}>
                    <Input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <Button type="submit">Login</Button>
                </Form>

                <FooterText>
                    Don’t have an account? <Link to="/register">Sign up</Link>
                </FooterText>
            </LoginCard>
        </Wrapper>
    );
}

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: radial-gradient(circle at top, #eef2f3, #8e9eab);
`;

const LoginCard = styled.div`
  background-color: #fff;
  padding: 3rem 2.5rem;
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  text-align: center;
`;

const Logo = styled.h1`
  font-size: 2rem;
  margin-bottom: 1rem;
  background: linear-gradient(90deg, #ff6b6b, #feca57);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const Title = styled.h2`
  margin-bottom: 0.3rem;
  color: #222;
`;

const Subtitle = styled.p`
  color: #777;
  font-size: 0.9rem;
  margin-bottom: 2rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Input = styled.input`
  padding: 0.8rem 1rem;
  border-radius: 10px;
  border: 1px solid #ccc;
  outline: none;
  font-size: 1rem;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: #0077ff;
  }
`;

const Button = styled.button`
  background: linear-gradient(90deg, #ff6b6b, #feca57);
  border: none;
  color: white;
  padding: 0.9rem;
  border-radius: 10px;
  cursor: pointer;
  font-weight: bold;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.9;
  }
`;

const FooterText = styled.p`
  margin-top: 1.5rem;
  font-size: 0.9rem;
  color: #555;

  a {
    color: #ff6b6b;
    font-weight: 600;
  }
`;
