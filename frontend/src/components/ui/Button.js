"use client";

import { motion } from "framer-motion";
import React from "react";

export function Button({ 
  children, 
  variant = "primary", 
  onClick, 
  className = "", 
  type = "button",
  icon: Icon,
  ...props 
}) {
  const baseStyles = "flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E14] focus-visible:ring-blue-500 whitespace-nowrap";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] border border-blue-500/50",
    secondary: "bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-500 text-white backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.2)] hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]",
    ghost: "bg-transparent hover:bg-slate-800/40 text-slate-300 hover:text-white border border-transparent hover:border-slate-700",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-3.5 text-lg"
  };

  const sizeClass = props.size ? sizes[props.size] : sizes.md;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
      {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
    </motion.button>
  );
}
