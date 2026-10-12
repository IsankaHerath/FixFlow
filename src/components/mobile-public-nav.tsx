"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
export function MobilePublicNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="public-mobile-nav">
      <button
        className="mobile-toggle"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={19} /> : <Menu size={19} />}
      </button>
      {open && (
        <div className="public-mobile-links">
          <Link onClick={() => setOpen(false)} href="/#features">
            Features
          </Link>
          <Link onClick={() => setOpen(false)} href="/#how-it-works">
            How it works
          </Link>
          <Link href="/service-centers">Service centers</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login">Log in</Link>
        </div>
      )}
    </div>
  );
}
