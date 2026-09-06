import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import HomePage from './landing/home/HomePage';
import Signup from './landing/signup/Signup';
import Login from './landing/auth/Login';
import VerifyOtp from './landing/auth/VerifyOtp';
import ForgotPassword from './landing/auth/ForgotPassword';
import AboutPage from './landing/about/AboutPage';
import ProductsPage from './landing/products/ProductsPage';
import PricingPage from './landing/pricing/PricingPage';
import SupportPage from './landing/support/SupportPage';
import Navbar from './landing/Navbar';
import Footer from './landing/Footer';
import NotFound from './landing/NotFound';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <Navbar />
    <Routes>
      <Route path='/' element={<HomePage />} />
      <Route path='/signup' element={<Signup />} />
      <Route path='/login' element={<Login />} />
      <Route path='/verify-otp' element={<VerifyOtp />} />
      <Route path='/forgot-password' element={<ForgotPassword />} />
      <Route path='/about' element={<AboutPage />} />
      <Route path='/products' element={<ProductsPage />} />
      <Route path='/pricing' element={<PricingPage />} />
      <Route path='/support' element={<SupportPage />} />
      <Route path='*' element={<NotFound />} />
    </Routes>
    <Footer />
  </BrowserRouter>
);
