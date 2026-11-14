#include "Ui.h"

#include <cmath>
#include <cstdarg>
#include <cstdio>

namespace wz {

using namespace Gdiplus;

std::wstring widen(const std::string& s) {
    if (s.empty()) return L"";
    int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
    std::wstring w((size_t)n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), &w[0], n);
    return w;
}

std::string narrow(const std::wstring& w) {
    if (w.empty()) return "";
    int n = WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), nullptr, 0, nullptr, nullptr);
    std::string s((size_t)n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), &s[0], n, nullptr, nullptr);
    return s;
}

std::string fmt(const char* f, ...) {
    char b[1024];
    va_list ap;
    va_start(ap, f);
    std::vsnprintf(b, sizeof(b), f, ap);
    va_end(ap);
    return b;
}

Color withAlpha(Color c, int a) { return Color((BYTE)a, c.GetR(), c.GetG(), c.GetB()); }

static void roundPath(GraphicsPath& p, const RectF& r, float rad) {
    float d = rad * 2.0f;
    d = std::min(d, std::min(r.Width, r.Height));
    if (d <= 0.05f) { p.AddRectangle(r); return; }
    p.AddArc(r.X, r.Y, d, d, 180.0f, 90.0f);
    p.AddArc(r.X + r.Width - d, r.Y, d, d, 270.0f, 90.0f);
    p.AddArc(r.X + r.Width - d, r.Y + r.Height - d, d, d, 0.0f, 90.0f);
    p.AddArc(r.X, r.Y + r.Height - d, d, d, 90.0f, 90.0f);
    p.CloseFigure();
}

void Ui::beginFrame(Graphics* gfx, double t) {
    g = gfx;
    time = t;
}

void Ui::endFrame() {
    pressed = released = false;
    typed.clear();
    keyBack = keyEnter = keyEsc = false;
    if (!down) activeId.clear();
}

Font* Ui::font(float size, bool bold) {
    int key = (int)std::lround(size * 4.0f) * 2 + (bold ? 1 : 0);
    auto it = fonts_.find(key);
    if (it != fonts_.end()) return it->second.get();
    if (!family_) {
        family_ = std::make_unique<FontFamily>(L"Segoe UI");
        if (family_->GetLastStatus() != Ok) family_ = std::make_unique<FontFamily>(L"Tahoma");
        if (family_->GetLastStatus() != Ok) family_.reset(FontFamily::GenericSansSerif()->Clone());
    }
    auto f = std::make_unique<Font>(family_.get(), size, bold ? FontStyleBold : FontStyleRegular, UnitPixel);
    Font* raw = f.get();
    fonts_[key] = std::move(f);
    return raw;
}

void Ui::fill(const RectF& r, Color c) { SolidBrush b(c); g->FillRectangle(&b, r); }

void Ui::fillRound(const RectF& r, float rad, Color c) {
    GraphicsPath p; roundPath(p, r, rad);
    SolidBrush b(c); g->FillPath(&b, &p);
}

void Ui::strokeRound(const RectF& r, float rad, Color c, float w) {
    GraphicsPath p; roundPath(p, r, rad);
    Pen pen(c, w); g->DrawPath(&pen, &p);
}

void Ui::line(float x1, float y1, float x2, float y2, Color c, float w) {
    Pen pen(c, w); g->DrawLine(&pen, x1, y1, x2, y2);
}

void Ui::circle(float cx, float cy, float r, Color c) {
    SolidBrush b(c); g->FillEllipse(&b, cx - r, cy - r, r * 2, r * 2);
}

void Ui::ring(float cx, float cy, float r, Color c, float w) {
    Pen pen(c, w); g->DrawEllipse(&pen, cx - r, cy - r, r * 2, r * 2);
}

void Ui::polyline(const std::vector<PointF>& pts, Color c, float w, bool closed) {
    if (pts.size() < 2) return;
    Pen pen(c, w);
    pen.SetLineJoin(LineJoinRound);
    if (closed) g->DrawPolygon(&pen, pts.data(), (INT)pts.size());
    else g->DrawLines(&pen, pts.data(), (INT)pts.size());
}

void Ui::text(const std::string& s, const RectF& r, float size, Color c, Align a, bool bold) {
    if (s.empty()) return;
    std::wstring w = widen(s);
    StringFormat sf;
    sf.SetAlignment(a == Align::Left ? StringAlignmentNear : (a == Align::Center ? StringAlignmentCenter : StringAlignmentFar));
    sf.SetLineAlignment(StringAlignmentCenter);
    sf.SetFormatFlags(StringFormatFlagsNoWrap);
    sf.SetTrimming(StringTrimmingEllipsisCharacter);
    SolidBrush b(c);
    g->DrawString(w.c_str(), (INT)w.size(), font(size, bold), r, &sf, &b);
}

float Ui::textWrap(const std::string& s, const RectF& r, float size, Color c, bool bold) {
    if (s.empty()) return 0.0f;
    std::wstring w = widen(s);
    StringFormat sf;
    SolidBrush b(c);
    RectF box(r.X, r.Y, r.Width, 4000.0f), out;
    g->MeasureString(w.c_str(), (INT)w.size(), font(size, bold), box, &sf, &out);
    g->DrawString(w.c_str(), (INT)w.size(), font(size, bold), box, &sf, &b);
    return out.Height;
}

float Ui::textWidth(const std::string& s, float size, bool bold) {
    std::wstring w = widen(s);
    RectF out;
    g->MeasureString(w.c_str(), (INT)w.size(), font(size, bold), PointF(0, 0), &out);
    return out.Width;
}

float Ui::wrapHeight(const std::string& s, float width, float size, bool bold) {
    std::wstring w = widen(s);
    StringFormat sf;
    RectF out;
    g->MeasureString(w.c_str(), (INT)w.size(), font(size, bold), RectF(0, 0, width, 4000.0f), &sf, &out);
    return out.Height;
}

void Ui::card(const RectF& r, const std::string& title) {
    fillRound(r, 10.0f, theme::card);
    strokeRound(r, 10.0f, theme::border);
    if (!title.empty())
        text(title, RectF(r.X + 18, r.Y + 12, r.Width - 36, 22), 12.0f, theme::dim, Align::Left, true);
}

void Ui::progress(const RectF& r, double frac, Color c) {
    fillRound(r, r.Height / 2, theme::cardHi);
    float w = (float)(std::max(0.0, std::min(1.0, frac)) * r.Width);
    if (w >= r.Height) fillRound(RectF(r.X, r.Y, w, r.Height), r.Height / 2, c);
    else if (w > 0.5f) circle(r.X + r.Height / 2, r.Y + r.Height / 2, r.Height / 2, c);
}

void Ui::pill(const std::string& s, float x, float y, Color bgc, Color fg) {
    float w = textWidth(s, 11.0f, true) + 14.0f;
    RectF r(x, y, w, 20.0f);
    fillRound(r, 10.0f, bgc);
    text(s, r, 11.0f, fg, Align::Center, true);
}

bool Ui::button(const std::string& label, const RectF& r, Btn style, bool enabled) {
    bool hov = enabled && hover(r);
    std::string id = "btn:" + label + fmt(":%d:%d", (int)r.X, (int)r.Y);
    if (hov && pressed) activeId = id;
    bool held = activeId == id;
    bool clicked = held && released && hov;

    Color bgc, fg = theme::text, br = theme::border;
    switch (style) {
        case Btn::Primary: bgc = held ? Color(255, 214, 110, 20) : (hov ? theme::accentHi : theme::accent); fg = Color(255, 22, 16, 8); br = bgc; break;
        case Btn::Danger:  bgc = hov ? Color(255, 110, 40, 44) : Color(255, 72, 32, 36); fg = Color(255, 255, 170, 170); br = Color(255, 120, 50, 54); break;
        default:           bgc = held ? theme::border : (hov ? theme::cardHi : theme::card); break;
    }
    if (!enabled) { bgc = theme::card; fg = theme::faint; br = theme::border; }
    fillRound(r, 7.0f, bgc);
    strokeRound(r, 7.0f, br);
    text(label, r, 13.0f, fg, Align::Center, true);
    return clicked;
}

bool Ui::slider(const std::string& id, const RectF& r, double& v, double mn, double mx, double step) {
    float cy = r.Y + r.Height / 2;
    RectF track(r.X + 8, cy - 2.5f, r.Width - 16, 5.0f);
    RectF hit(r.X, r.Y, r.Width, r.Height);
    if (hover(hit) && pressed) activeId = id;
    bool changed = false;
    if (activeId == id && down) {
        double f = (mouse.X - track.X) / track.Width;
        f = std::max(0.0, std::min(1.0, f));
        double nv = mn + f * (mx - mn);
        if (step > 0) nv = mn + std::round((nv - mn) / step) * step;
        nv = std::max(mn, std::min(mx, nv));
        if (std::fabs(nv - v) > 1e-9) { v = nv; changed = true; }
    }
    double f = (mx > mn) ? (v - mn) / (mx - mn) : 0.0;
    f = std::max(0.0, std::min(1.0, f));
    fillRound(track, 2.5f, theme::cardHi);
    fillRound(RectF(track.X, track.Y, (float)(track.Width * f), track.Height), 2.5f, theme::accent);
    float kx = track.X + (float)(track.Width * f);
    bool hot = activeId == id || hover(hit);
    circle(kx, cy, hot ? 8.0f : 7.0f, theme::text);
    circle(kx, cy, 3.5f, theme::accent);
    return changed;
}

bool Ui::segmented(const std::string& id, const RectF& r, const std::vector<std::string>& opts, int& idx) {
    fillRound(r, 7.0f, theme::bg);
    strokeRound(r, 7.0f, theme::border);
    bool changed = false;
    float w = r.Width / (float)opts.size();
    for (size_t i = 0; i < opts.size(); ++i) {
        RectF c(r.X + w * i + 2, r.Y + 2, w - 4, r.Height - 4);
        bool sel = (int)i == idx;
        bool hov = hover(c);
        std::string sid = id + fmt(":%d", (int)i);
        if (hov && pressed) activeId = sid;
        if (activeId == sid && released && hov && !sel) { idx = (int)i; changed = true; sel = true; }
        if (sel) fillRound(c, 5.0f, theme::accent);
        else if (hov) fillRound(c, 5.0f, theme::cardHi);
        text(opts[i], c, opts.size() >= 4 ? 11.5f : 12.5f, sel ? Color(255, 22, 16, 8) : theme::dim, Align::Center, sel);
    }
    return changed;
}

bool Ui::textField(const std::string& id, const RectF& r, std::string& value, size_t maxLen) {
    bool hov = hover(r);
    if (pressed) {
        if (hov) focusId = id;
        else if (focusId == id) focusId.clear();
    }
    bool focused = focusId == id;
    bool changed = false;
    if (focused) {
        std::wstring w = widen(value);
        for (wchar_t ch : typed) {
            if (ch >= 32 && ch != 127 && w.size() < maxLen) { w += ch; changed = true; }
        }
        if (keyBack && !w.empty()) { w.pop_back(); changed = true; }
        if (keyEnter || keyEsc) focusId.clear();
        if (changed) value = narrow(w);
    }
    fillRound(r, 6.0f, theme::bg);
    strokeRound(r, 6.0f, focused ? theme::accent : theme::border);
    RectF tr(r.X + 10, r.Y, r.Width - 20, r.Height);
    text(value, tr, 13.5f, theme::text);
    if (focused && std::fmod(time, 1.0) < 0.55) {
        float tw = value.empty() ? 0.0f : textWidth(value, 13.5f) - 4.0f;
        float cx = std::min(tr.X + tw + 2.0f, tr.X + tr.Width);
        line(cx, r.Y + 8, cx, r.Y + r.Height - 8, theme::text, 1.2f);
    }
    return changed;
}

bool Ui::row(const RectF& r, bool selected) {
    bool hov = hover(r);
    std::string id = fmt("row:%d:%d", (int)r.X, (int)r.Y);
    if (hov && pressed) activeId = id;
    bool clicked = activeId == id && released && hov;
    if (selected) fillRound(r, 6.0f, withAlpha(theme::accent, 46));
    else if (hov) fillRound(r, 6.0f, theme::cardHi);
    return clicked;
}

} // namespace wz
