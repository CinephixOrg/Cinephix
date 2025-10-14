import React, { useContext } from "react";
import styled from "styled-components";
import { AuthContext } from "../context/AuthContext";

export default function HomePage() {
  const { user, logout } = useContext(AuthContext);

  return (
    <Wrapper>
      <h1>🎬 Welcome, {user?.username || "Guest"}!</h1>
      <p>This is your Cinephix dashboard.</p>
      {user && <LogoutBtn onClick={logout}>Logout</LogoutBtn>}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  text-align: center;
  padding-top: 5rem;
`;

const LogoutBtn = styled.button`
  background-color: #ff6b6b;
  color: white;
  border: none;
  padding: 0.8rem 1.2rem;
  margin-top: 1rem;
  border-radius: 10px;
  cursor: pointer;
`;
