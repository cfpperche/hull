import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initial(name: string, fallback = "H"): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : fallback;
}
