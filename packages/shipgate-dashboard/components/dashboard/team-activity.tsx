'use client';

import { motion } from 'framer-motion';

interface TeamMember {
  name: string;
  role: string;
  avatar: string;
  scans: number;
  lastScan: string;
  status: 'online' | 'offline' | 'busy';
}

const mockTeam: TeamMember[] = [
  {
    name: 'Gee',
    role: 'Lead',
    avatar: 'G',
    scans: 142,
    lastScan: '2m ago',
    status: 'online'
  },
  {
    name: 'Alex',
    role: 'Backend',
    avatar: 'A',
    scans: 89,
    lastScan: '15m ago',
    status: 'online'
  },
  {
    name: 'Sam',
    role: 'Full-stack',
    avatar: 'S',
    scans: 67,
    lastScan: '1h ago',
    status: 'busy'
  },
  {
    name: 'Taylor',
    role: 'Frontend',
    avatar: 'T',
    scans: 45,
    lastScan: '3h ago',
    status: 'offline'
  }
];

export default function TeamActivity() {
  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
      <h2 className="text-lg font-semibold text-sg-text0 mb-4">Team Activity</h2>

      <div className="space-y-3">
        {mockTeam.map((member, index) => (
          <motion.div
            key={member.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-sg-bg2/30 border border-sg-border/50"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-sg-bg3 flex items-center justify-center text-[11px] font-semibold text-sg-text1">
                {member.avatar}
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sg-bg1 ${
                  member.status === 'online' ? 'bg-sg-ship' :
                  member.status === 'busy' ? 'bg-sg-warn' :
                  'bg-sg-text3'
                }`}
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-sg-text0 font-medium">
                  {member.name}
                </span>
                <span className="text-[10px] text-sg-text3">
                  {member.role}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-sg-text3">
                <span>{member.scans} scans</span>
                <span>•</span>
                <span>{member.lastScan}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
