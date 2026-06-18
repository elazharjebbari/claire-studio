import { clsx, type ClassValue } from "clsx";

/** Petit helper de concaténation conditionnelle de classes. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
