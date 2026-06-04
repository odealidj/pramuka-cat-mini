import React from 'react';

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  /**
   * Optional custom classes for the icon container.
   * Default: "bg-[#FAF7F2] border-[#E8DCC8]"
   */
  color?: string;
  /**
   * Optional change indicator text (e.g., "LIVE")
   */
  change?: string;
  /**
   * Type of change indicator for coloring
   */
  changeType?: "up" | "down" | "neutral";
  /**
   * Optional text after the change indicator (e.g., "dari bulan lalu")
   */
  changeSuffix?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  color = "bg-[#FAF7F2] border-[#E8DCC8]",
  change,
  changeType = "neutral",
  changeSuffix,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E8DCC8] shadow-sm flex items-start justify-between gap-3 card-lift">
      <div>
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <p className="text-gray-900 text-2xl font-bold mt-1">{value}</p>
        {(change || changeSuffix) && (
          <div className="flex items-center gap-1 mt-2">
            {change && (
              <span
                className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
                  changeType === "up"
                    ? "bg-[#FAF7F2] text-[#7A4520] border-[#E8DCC8]"
                    : changeType === "down"
                      ? "bg-red-50 text-red-500 border-red-100"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                }`}
              >
                {change}
              </span>
            )}
            {changeSuffix && (
              <span className="text-gray-400 text-xs ml-1">{changeSuffix}</span>
            )}
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl border shadow-sm flex-shrink-0 ${color}`}>
        {icon}
      </div>
    </div>
  );
}
