import type { LucideIcon } from 'lucide-react';
import { Camera, Church, Hand, Heart, HeartHandshake, Megaphone, Mic, Music, Shield, Sparkles, Users, Utensils } from 'lucide-react';
import { Department } from './types';

/** Icons Administration can pick for a church's own departments (stored as the key). */
export const DEPT_ICONS: Record<string, LucideIcon> = {
  music: Music,
  users: Users,
  megaphone: Megaphone,
  camera: Camera,
  heart: Heart,
  mic: Mic,
  shield: Shield,
  hand: Hand,
  care: HeartHandshake,
  food: Utensils,
  sparkles: Sparkles,
  church: Church,
};

/** Tile colours [background, foreground], stored as the background hex. */
export const DEPT_COLORS: [string, string][] = [
  ['#DDEBF7', '#1D4E7A'],
  ['#ECE3F6', '#55307F'],
  ['#FCEFD9', '#7A4300'],
  ['#E3F1D4', '#2F5D10'],
  ['#F9DEDC', '#8F1D14'],
  ['#E4E6F7', '#33397F'],
];

export const customDeptLook = (d: Pick<Department, 'icon' | 'color'> | null | undefined): { icon: LucideIcon; bg: string; fg: string } => {
  const pair = DEPT_COLORS.find(([bg]) => bg === d?.color) ?? DEPT_COLORS[0];
  return { icon: DEPT_ICONS[d?.icon ?? ''] ?? Users, bg: pair[0], fg: pair[1] };
};
