"use client";

import React from 'react';
import { TrendingUp, Clock, ShieldAlert } from 'lucide-react'; // Example icons

interface StatCardProps {
  value: string;
  title: string;
  description: string;
  icon?: React.ElementType; // Optional icon for each stat card
}

const StatCard: React.FC<StatCardProps> = ({ value, title, description, icon: Icon }) => {
  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 flex flex-col text-center md:text-left">
      {Icon && <Icon className="h-8 w-8 text-indigo-400 mb-4 mx-auto md:mx-0" />}
      <p className="text-4xl md:text-5xl font-bold text-indigo-400 mb-2">{value}</p>
      <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
};

const statsData: StatCardProps[] = [
  {
    value: "98%",
    title: "Reduction in Lost Documentation",
    description: "Our automated snapshots have saved our team from disaster multiple times when we accidentally deleted key documentation.",
    // icon: ShieldAlert
  },
  {
    value: "3 hours",
    title: "Saved per Week on Manual Backups",
    description: "The automated snapshots have eliminated our need for manual backups, giving us back precious time.",
    // icon: Clock
  },
  {
    value: "100%",
    title: "Recovery Success Rate",
    description: "We've had a 100% success rate recovering lost content across our international team's workspaces.",
    // icon: TrendingUp
  }
];

const StatisticsSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-slate-900">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-indigo-300 bg-indigo-900/70 rounded-full mb-3">
            Success Stories
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-slate-50 tracking-tight">
            Companies Saving Time with PageLifeline
          </h2>
          <p className="text-lg text-slate-400">
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
              icon={stat.icon} 
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatisticsSection; 