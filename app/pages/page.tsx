import DashboardShell from "../../components/DashboardShell";
const content = <div className="page-list">{["سياسة الشحن","سياسة الاستبدال والاسترجاع","سياسة الخصوصية","من نحن","تواصل معنا"].map(p=><div className="page-item" key={p}><b>{p}</b><button className="btn small">تعديل</button></div>)}</div>;
export default function Page(){return <DashboardShell title="الصفحات والسياسات" subtitle="جهز صفحات المتجر.">{content}</DashboardShell>}
