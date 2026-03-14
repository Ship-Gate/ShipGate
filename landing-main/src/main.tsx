import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./app/App.tsx";
import Layout from "./app/Layout.tsx";
import "./styles/index.css";

import Pricing from "./app/playwright-pages/Pricing";
import Privacy from "./app/playwright-pages/Privacy";
import Terms from "./app/playwright-pages/Terms";
import Security from "./app/playwright-pages/Security";
import About from "./app/playwright-pages/About";
import Contact from "./app/playwright-pages/Contact";
import Comparison from "./app/playwright-pages/Comparison";
import Docs from "./app/playwright-pages/Docs";
import Walkthrough from "./app/playwright-pages/Walkthrough";
import Dashboard from "./app/playwright-pages/Dashboard";
import Pipeline from "./app/playwright-pages/Pipeline";
import LiveAPI from "./app/playwright-pages/LiveAPI";
import SignUp from "./app/playwright-pages/SignUp";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Layout>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/security" element={<Security />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/comparison" element={<Comparison />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/walkthrough" element={<Walkthrough />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/live-api" element={<LiveAPI />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/features" element={<App />} />
      </Routes>
    </Layout>
  </BrowserRouter>
);
