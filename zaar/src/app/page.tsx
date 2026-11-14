import { inArray } from "drizzle-orm";
import { Landing } from "@/components/platform/Landing";
import { Preloader } from "@/components/store/bold/Preloader";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { getMerchant } from "@/lib/auth";
import { getPlatform } from "@/lib/platform";
import { preloaderScript } from "@/lib/preloader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [cfg, merchant, demos] = await Promise.all([
    getPlatform(),
    getMerchant(),
    db.select({ slug: stores.slug, name: stores.name, theme: stores.theme, status: stores.status }).from(stores).where(inArray(stores.slug, ["demo-street", "demo-oud"])),
  ]);
  const live = demos.filter((d) => d.status === "live");
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: preloaderScript("zaar") }} />
      <Preloader slug="zaar" name="زار" nameLatin="ZAAR" />
      <Landing
        feePercent={cfg.feeBp / 100}
        feeFixed={cfg.feeFixed / 100}
        guaranteeDays={cfg.guaranteeDays}
        replyHours={cfg.claimReplyHours}
        loggedIn={Boolean(merchant)}
        demos={{ bold: live.find((d) => d.theme === "bold")?.slug ?? null, soft: live.find((d) => d.theme === "soft")?.slug ?? null }}
      />
    </>
  );
}
