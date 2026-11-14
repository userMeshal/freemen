import {
  Baby, Bike, BookOpen, Brush, Cake, Camera, Candy, Car, Coffee, Cookie, Croissant, Crown, CupSoda, Droplets, Dumbbell, Feather,
  Flame, Flower2, Footprints, Gamepad2, Gem, Gift, Glasses, Headphones, HeartPulse, House, IceCreamCone, Lamp, Laptop, Leaf, Moon,
  Music, Package, Palette, PawPrint, Pill, Plane, Scissors, Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, Star, Sun, Tent,
  Utensils, Watch, Wheat, Wrench, type LucideIcon, type LucideProps,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Baby, Bike, BookOpen, Brush, Cake, Camera, Candy, Car, Coffee, Cookie, Croissant, Crown, CupSoda, Droplets, Dumbbell, Feather,
  Flame, Flower2, Footprints, Gamepad2, Gem, Gift, Glasses, Headphones, HeartPulse, House, IceCreamCone, Lamp, Laptop, Leaf, Moon,
  Music, Package, Palette, PawPrint, Pill, Plane, Scissors, Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, Star, Sun, Tent,
  Utensils, Watch, Wheat, Wrench,
};

/** أيقونة بالاسم — الأسماء المسموحة في lib/themes.ts */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = MAP[name] ?? Sparkles;
  return <C aria-hidden {...props} />;
}
