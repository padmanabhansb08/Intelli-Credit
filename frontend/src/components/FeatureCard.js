"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React, { memo } from "react";

const FeatureCard = memo(({ 
  title, 
  description, 
  icon: Icon, 
  href, 
  gradientColors = "from-blue-500/0 via-blue-400/40 to-blue-400/0",
  iconBgColor = "bg-blue-500/10",
  iconColor = "text-blue-400",
  iconBorder = "border-blue-500/20",
  iconHoverShadow = "rgba(59,130,246,0.3)",
  cardHoverShadow = "rgba(59,130,246,0.25)",
  cardHoverBorder = "hover:border-blue-500/40",
  delay = 0 
}) => {
  const router = useRouter();

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut", delay } }
  };

  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`glass-card rounded-2xl p-8 border border-slate-700/50 ${cardHoverBorder} hover:bg-slate-800/60 transition-all duration-300 ease-out cursor-pointer group flex flex-col justify-between relative overflow-hidden`}
      style={{ boxShadow: 'var(--card-box-shadow)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.setProperty('--card-box-shadow', `0 15px 40px -10px ${cardHoverShadow}`);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.setProperty('--card-box-shadow', 'initial');
      }}
      onClick={() => router.push(href)}
    >
      {/* Subtle top edge highlight */}
      <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r ${gradientColors} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      
      <div>
        <div 
          className={`${iconBgColor} w-14 h-14 rounded-xl flex items-center justify-center mb-6 border ${iconBorder} group-hover:scale-110 transition-all duration-300`}
          style={{ 
            boxShadow: 'var(--icon-box-shadow, 0 0 15px rgba(0,0,0,0.1))',
            backgroundColor: 'var(--icon-bg-color)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.setProperty('--icon-box-shadow', `0 0 25px ${iconHoverShadow}`);
          }}
          onMouseLeave={(e) => {
             e.currentTarget.style.setProperty('--icon-box-shadow', '0 0 15px rgba(0,0,0,0.1)');
          }}
        >
          <Icon className={`w-7 h-7 ${iconColor}`} aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400 leading-relaxed text-sm">{description}</p>
      </div>
    </motion.div>
  );
});

FeatureCard.displayName = "FeatureCard";
export default FeatureCard;
