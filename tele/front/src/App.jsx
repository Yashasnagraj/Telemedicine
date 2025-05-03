import { useState } from "react";
import "./App.css";
import { Routes, Route } from "react-router-dom";
import { SocketProvider } from "./components/Socket";
import { PeerProvider } from "./components/peer";
import ConsultationRequest from "./components/ConsultationRequest";
import DoctorDashboard from "./components/DoctorDashboard";
import DoctorConsultationRoom from "./components/DoctorConsultationRoom";
import PatientConsultationRoom from "./components/PatientConsultationRoom";
import Dashboard from "./components/Dashboard";
import WaitingRoom from "./components/WaitingRoom";
import TestMediaPipe from "./components/TestMediaPipe";

function App() {
  return (
    <div className="container">
      <SocketProvider>
        <PeerProvider>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/request-consultation" element={<ConsultationRequest />} />
            <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
            <Route path="/doctor/consultation/:roomId" element={<DoctorConsultationRoom />} />
            <Route path="/patient/consultation/:roomId" element={<PatientConsultationRoom />} />
            <Route path="/waiting-room/:roomId" element={<WaitingRoom />} />
            <Route path="/test-mediapipe" element={<TestMediaPipe />} />
          </Routes>
        </PeerProvider>
      </SocketProvider>
    </div>
  );
}

export default App;
