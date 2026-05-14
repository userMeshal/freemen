import DashboardShell from "../../components/DashboardShell";
const content = <><div className="kpi-grid"><div className="kpi"><span>معدل التحويل</span><b>3.8%</b></div><div className="kpi"><span>متوسط السلة</span><b>145 ر.س</b></div><div className="kpi"><span>الأكثر مبيعًا</span><b>Swan Box</b></div><div className="kpi"><span>زيارات اليوم</span><b>1,320</b></div></div></>;
export default function Page(){return <DashboardShell title="التقارير" subtitle="أرقام تساعدك تعرف أداء المتجر.">{content}</DashboardShell>}
