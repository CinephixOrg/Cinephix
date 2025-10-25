import React from "react";
import Lottie from "lottie-react"; // Doğru import
import logoAnimation from "../assets/animations/logo.json";

export default function SplashScreen() {
  return (
    <div
      style={{
        backgroundColor: "#0a0a23",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <Lottie
        animationData={logoAnimation}
        loop={true}
        style={{ height: "300px", width: "300px" }}
      />
    </div>
  );
}