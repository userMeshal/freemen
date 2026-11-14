import type { CSSProperties } from "react";
import type { ProductArt } from "@/lib/types";
import { Icon } from "./Icon";

/**
 * صورة المنتج، أو لوحة لونية مولّدة من درجة اللون والأيقونة عند غياب الصورة
 * (نفس أسلوب اللوحات في «حطّها»).
 */
export function Art({
  image,
  art,
  alt,
  className = "",
  contain = false,
}: {
  image?: string | null;
  art: ProductArt;
  alt: string;
  className?: string;
  contain?: boolean;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={alt} loading="lazy" className={`h-full w-full ${contain ? "object-contain" : "object-cover"} ${className}`} />;
  }
  return (
    <div className={`p-art ${className}`} style={{ "--h": art.hue } as CSSProperties} role="img" aria-label={alt}>
      <Icon name={art.icon} />
    </div>
  );
}
