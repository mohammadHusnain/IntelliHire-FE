import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function TopNavBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-white transition-all duration-200 border-b ${scrolled ? 'border-[#E5E7EB] shadow-[0_1px_0_#E5E7EB]' : 'border-transparent'}`}>
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-bold text-[#0D0D0D] text-xl" style={{ fontFamily: "var(--font-heading)" }}>
          IntelliHire
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <a href="#candidates" className="nav-link" style={{ fontFamily: "var(--font-ui)" }}>For Candidates</a>
          <a href="#companies" className="nav-link" style={{ fontFamily: "var(--font-ui)" }}>For Companies</a>
          <a href="#pricing" className="nav-link" style={{ fontFamily: "var(--font-ui)" }}>Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-[#374151] hover:text-[#F04E23] transition-colors px-4 py-2">
            Log In
          </Link>
          <Link to="/register" className="btn-primary text-sm">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
