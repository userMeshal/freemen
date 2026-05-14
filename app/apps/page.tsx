import DashboardShell from "@/components/DashboardShell";

const apps = [
  { name: "واتساب", desc: "زر واتساب داخل المتجر", status: "جاهز" },
  { name: "TikTok Pixel", desc: "تتبع حملات تيك توك", status: "قريبًا" },
  { name: "Google Analytics", desc: "تحليل الزيارات", status: "قريبًا" },
  { name: "شركات الشحن", desc: "ربط بوليصات الشحن", status: "قريبًا" },
];

export default function AppsPage() {
  return (
    <DashboardShell title="التطبيقات" subtitle="إضافات تساعد التاجر يبيع ويتتبع حملاته.">
      <div className="grid3">
        {apps.map((app) => (
          <div className="card" key={app.name}>
            <h3>{app.name}</h3>
            <p>{app.desc}</p>
            <span className="badge-black">{app.status}</span>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
