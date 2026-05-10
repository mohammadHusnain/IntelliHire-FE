import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#E5E7EB] py-12 text-[#374151]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 pb-8 border-b border-[#E5E7EB]">
          <Link to="/" className="font-bold text-[#0D0D0D] text-xl" style={{ fontFamily: "var(--font-heading)" }}>
            IntelliHire
          </Link>
          <div className="flex items-center flex-wrap justify-center gap-6">
            <Link to="#" className="hover:text-[#F04E23] transition-colors text-[15px]">For Candidates</Link>
            <Link to="#" className="hover:text-[#F04E23] transition-colors text-[15px]">For Companies</Link>
            <Link to="#" className="hover:text-[#F04E23] transition-colors text-[15px]">Pricing</Link>
            <Link to="#" className="hover:text-[#F04E23] transition-colors text-[15px]">Blog</Link>
            <Link to="#" className="hover:text-[#F04E23] transition-colors text-[15px]">Contact</Link>
            <Link to="#" className="hover:text-[#F04E23] transition-colors text-[15px]">Privacy</Link>
          </div>
          <div className="flex items-center gap-4 text-[#9CA3AF]">
            <a href="#" className="hover:text-[#F04E23] transition-colors"><Twitter className="w-5 h-5" /></a>
            <a href="#" className="hover:text-[#F04E23] transition-colors"><Mail className="w-5 h-5" /></a>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center mt-8 text-[13px] text-[#9CA3AF]">
          <p>© {new Date().getFullYear()} IntelliHire. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
