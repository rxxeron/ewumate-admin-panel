import React from 'react';
import { Users, Activity, BookOpen, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DashboardStats } from '../../types';

export function StatsGrid({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">    
      <motion.div whileHover={{ y: -4 }} className="bg-card rounded-xl p-6 shadow-sm border border-border flex items-center gap-5 transition-all">
        <div className="p-4 rounded-lg bg-primary/10 text-primary shadow-inner">
          <Users className="w-8 h-8" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground  ">Total Users</p>
          <p className="text-2xl font-semibold text-foreground">{stats.users.toLocaleString()}</p>
        </div>
      </motion.div>

      <motion.div whileHover={{ y: -4 }} className="bg-card rounded-xl p-6 shadow-sm border border-border flex items-center gap-5 transition-all">
        <div className="p-4 rounded-lg bg-primary/10 text-primary shadow-inner">
          <Activity className="w-8 h-8" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground  ">Active (24h)</p>
          <p className="text-2xl font-semibold text-foreground">{stats.activeUsers24h.toLocaleString()}</p>
        </div>
      </motion.div>

      <motion.div whileHover={{ y: -4 }} className="bg-card rounded-xl p-6 shadow-sm border border-border flex items-center gap-5 transition-all">
        <div className="p-4 rounded-lg bg-primary/10 text-primary shadow-inner">
          <BookOpen className="w-8 h-8" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground  ">Programs</p>
          <p className="text-2xl font-semibold text-foreground">{stats.programs}</p>
        </div>
      </motion.div>

      <motion.div whileHover={{ y: -4 }} className="bg-card rounded-xl p-6 shadow-sm border border-border flex items-center gap-5 transition-all">
        <div className="p-4 rounded-lg bg-primary/10 text-primary shadow-inner">
          <GraduationCap className="w-8 h-8" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground  ">Live Courses</p>
          <p className="text-2xl font-semibold text-foreground">{stats.courses.toLocaleString()}</p>
        </div>
      </motion.div>
    </div>
  );
}

