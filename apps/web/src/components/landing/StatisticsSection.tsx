"use client";

import React from 'react';
// Icons are available if we decide to use them in statsData
// import { TrendingUp, Clock, ShieldAlert } from 'lucide-react'; 

interface StatCardProps {
  value: string;
  title: string;
  description: string;
  icon?: React.ElementType; 
}

const StatCard: React.FC<StatCardProps> = ({ value, title, description, icon: Icon }) => {
  return (
    <div className="flex flex-col text-center p-6 bg-slate-800/70 backdrop-blur-lg rounded-2xl shadow-xl hover:shadow-2xl shadow-black/30 transition-all duration-300 transform hover:-translate-y-1 border border-slate-700/50 hover:border-slate-600/70">
      {Icon && (
        <div className="mb-3">
          <Icon className="h-8 w-8 text-sky-400 mx-auto" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-5xl md:text-6xl font-semibold text-sky-400 mb-3 tracking-tight">{value}</p>
      <h3 className="text-lg font-medium text-slate-100 mb-2">{title}</h3>
      <p className="text-sm text-slate-300 leading-relaxed">{description}</p>
    </div>
  );
};

const statsData: StatCardProps[] = [
  {
    value: "98%",
    title: "Reduction in Lost Documentation",
    description: "Automated snapshots have saved teams from disaster when key documentation was accidentally deleted.",
    // icon: ShieldAlert // Example if we add icons back
  },
  {
    value: "3 hrs", // Shortened for visual balance
    title: "Saved per Week",
    description: "Automated snapshots eliminate manual backups, freeing up precious time for core tasks.",
    // icon: Clock
  },
  {
    value: "100%",
    title: "Recovery Success Rate",
    description: "Consistently recover lost content across international team workspaces with full fidelity.",
    // icon: TrendingUp
  }
];

const StatisticsSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-slate-900 border-y border-slate-800/70">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3.5 py-1.5 text-xs font-semibold text-sky-300 bg-sky-800/50 rounded-full mb-4 shadow-sm">
            Success Stories
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 text-slate-50 tracking-tight">
            Trusted by Teams Worldwide
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed">
            Real results from teams using PageLifeline to secure their Notion workspaces.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {statsData.map((stat, index) => (
            <StatCard 
              key={index} 
              value={stat.value} 
              title={stat.title} 
              description={stat.description} 
              icon={stat.icon} // Pass icon if re-enabled in data
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatisticsSection; 