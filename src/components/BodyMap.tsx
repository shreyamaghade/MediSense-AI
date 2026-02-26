import React from 'react';
import { motion } from 'motion/react';
import { BODY_REGIONS, type BodyRegion } from '../constants';
import { cn } from '../lib/utils';

interface BodyMapProps {
  onRegionSelect: (region: BodyRegion) => void;
  selectedRegionId: string | null;
}

export const BodyMap: React.FC<BodyMapProps> = ({ onRegionSelect, selectedRegionId }) => {
  return (
    <div className="relative w-full aspect-[2/3] bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden group">
      {/* Simple Human Outline SVG */}
      <svg
        viewBox="0 0 100 150"
        className="w-full h-full p-4 text-slate-200 fill-current"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M50,5 c-5,0 -10,5 -10,10 s5,10 10,10 s10,-5 10,-10 s-5,-10 -10,-10 Z M40,27 l-15,10 c-2,1 -3,4 -2,6 l10,30 l5,-2 l-8,-25 l5,-2 l5,35 l0,55 l5,0 l0,-50 l10,0 l0,50 l5,0 l0,-55 l5,-35 l5,2 l-8,25 l10,-30 c1,-2 0,-5 -2,-6 l-15,-10 Z" />
      </svg>

      {/* Interactive Hotspots */}
      {BODY_REGIONS.map((region) => (
        <motion.button
          key={region.id}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onRegionSelect(region)}
          className={cn(
            "absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 transition-all flex items-center justify-center shadow-lg",
            selectedRegionId === region.id
              ? "bg-emerald-500 border-white scale-125 z-10"
              : "bg-white border-emerald-500 hover:bg-emerald-50"
          )}
          style={{ left: `${region.coordinates.x}%`, top: `${region.coordinates.y}%` }}
          title={region.label}
        >
          <div className={cn(
            "w-2 h-2 rounded-full",
            selectedRegionId === region.id ? "bg-white" : "bg-emerald-500"
          )} />
        </motion.button>
      ))}

      <div className="absolute bottom-3 left-3 right-3 bg-white/60 backdrop-blur-sm p-2 rounded-lg text-[10px] text-slate-500 text-center font-medium">
        Click a region to see related symptoms
      </div>
    </div>
  );
};
