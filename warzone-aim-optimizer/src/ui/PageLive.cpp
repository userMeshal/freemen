#include "App.h"

namespace wz {

static void stickCard(App& app, Ui& ui, const RectF& c, const char* title, bool right) {
    ui.card(c, title);
    const Profile& p = app.profile;
    Vec2 raw = right ? app.pad.rs : app.pad.ls;
    StickTuning tune = right ? p.rightTuning() : p.leftTuning();
    Vec2 proc = processStick(raw, tune);

    std::vector<Vec2> trail;
    size_t n = app.recent.size(), stride = 4;
    for (size_t i = 0; i < n; i += stride) {
        const Sample& s = app.recent[i];
        if (app.now - s.t < 1.2) trail.push_back(right ? s.pad.rs : s.pad.ls);
    }
    float size = std::min(c.Width - 36, c.Height - 132);
    RectF sr(c.X + (c.Width - size) / 2, c.Y + 38, size, size);
    ScopeOpts o;
    o.dzMin = tune.dzMin; o.dzMax = tune.dzMax; o.showProcessed = true; o.processed = proc; o.trail = &trail;
    drawScope(ui, sr, app.pad.connected ? raw : Vec2(), o);

    float ty = sr.Y + size + 8, half = (c.Width - 36) / 2;
    ui.text(fmt(tr("Raw  X %+.3f  Y %+.3f"), raw.x, raw.y), RectF(c.X + 18, ty, half + 30, 18), 12.0f, theme::accent);
    ui.text(fmt(tr("|r| %.3f"), raw.len()), RectF(c.X + 18 + half, ty, half, 18), 12.0f, theme::accent, Align::Right);
    ui.text(fmt(tr("Out  X %+.3f  Y %+.3f"), proc.x, proc.y), RectF(c.X + 18, ty + 20, half + 30, 18), 12.0f, theme::blue);
    ui.text(fmt(tr("|r| %.3f"), proc.len()), RectF(c.X + 18 + half, ty + 20, half, 18), 12.0f, theme::blue, Align::Right);
    bool inDz = raw.len() <= tune.dzMin;
    ui.text(inDz ? "Inside deadzone: no output" : (raw.len() >= tune.dzMax ? "At max: full output" : "Active range"),
            RectF(c.X + 18, ty + 42, c.Width - 36, 18), 11.5f, inDz ? theme::faint : theme::dim);
    ui.text(fmt(tr("Deadzone %.2f - %.2f"), tune.dzMin, tune.dzMax), RectF(c.X + 18, ty + 42, c.Width - 36, 18), 11.5f, theme::faint, Align::Right);
}

static void bar(Ui& ui, const RectF& r, double v, double dz, const char* label) {
    ui.fillRound(r, 5, theme::bg);
    ui.strokeRound(r, 5, theme::border);
    float h = (float)(clampd(v, 0, 1) * (r.Height - 4));
    if (h > 1) ui.fillRound(RectF(r.X + 2, r.Y + r.Height - 2 - h, r.Width - 4, h), 4, v > dz ? theme::accent : theme::faint);
    if (dz > 0.001) {
        float y = r.Y + r.Height - 2 - (float)dz * (r.Height - 4);
        ui.line(r.X - 3, y, r.X + r.Width + 3, y, theme::bad, 1.2f);
    }
    ui.text(label, RectF(r.X - 20, r.Y + r.Height + 4, r.Width + 40, 16), 11.5f, theme::dim, Align::Center, true);
    ui.text(fmt(tr("%.0f%%"), v * 100), RectF(r.X - 20, r.Y - 20, r.Width + 40, 16), 11.5f, theme::text, Align::Center);
}

static void buttonsCard(App& app, Ui& ui, const RectF& c) {
    ui.card(c, "TRIGGERS & BUTTONS");
    float bh = c.Height - 250;
    bh = std::max(70.0f, std::min(bh, 150.0f));
    float bx = c.X + c.Width / 2;
    // LT stays on the physical left, RT on the physical right, in either layout.
    float ltX = ui.rtl ? bx + 36 : bx - 70, rtX = ui.rtl ? bx - 70 : bx + 36;
    bar(ui, RectF(ltX, c.Y + 62, 34, bh), app.pad.lt, app.profile.ltDz, "LT");
    bar(ui, RectF(rtX, c.Y + 62, 34, bh), app.pad.rt, app.profile.rtDz, "RT");

    struct B { const char* n; uint16_t m; };
    const B btns[] = {{"A", BtnA}, {"B", BtnB}, {"X", BtnX}, {"Y", BtnY}, {"LB", BtnLB}, {"RB", BtnRB}, {"L3", BtnLThumb}, {"R3", BtnRThumb},
                      {"Up", BtnDPadUp}, {"Dn", BtnDPadDown}, {"Lt", BtnDPadLeft}, {"Rt", BtnDPadRight}, {"Menu", BtnStart}, {"View", BtnBack}};
    float gy = c.Y + 62 + bh + 34, cw = (c.Width - 36 - 3 * 8) / 4;
    for (int i = 0; i < 14; ++i) {
        RectF r(c.X + 18 + (i % 4) * (cw + 8), gy + (i / 4) * 34, cw, 27);
        bool on = (app.pad.buttons & btns[i].m) != 0;
        ui.fillRound(r, 6, on ? theme::accent : theme::bg);
        ui.strokeRound(r, 6, on ? theme::accent : theme::border);
        ui.text(btns[i].n, r, 11.5f, on ? Color(255, 22, 16, 8) : theme::dim, Align::Center, true);
    }
}

static void curveCard(App& app, Ui& ui, const RectF& c) {
    ui.card(c, "RIGHT STICK RESPONSE CURVE");
    RectF g(c.X + 44, c.Y + 44, c.Width - 68, c.Height - 100);
    ui.beginLtr(g); // graphs keep their usual left-to-right axes
    ui.fillRound(g, 4, theme::bg);
    for (int i = 0; i <= 4; ++i) {
        float x = g.X + g.Width * i / 4, y = g.Y + g.Height * i / 4;
        ui.line(x, g.Y, x, g.Y + g.Height, withAlpha(theme::border, 130));
        ui.line(g.X, y, g.X + g.Width, y, withAlpha(theme::border, 130));
    }
    const Profile& p = app.profile;
    auto plot = [&](CurveType ct, Color col, float w) {
        std::vector<PointF> pts;
        for (int i = 0; i <= 120; ++i) {
            double x = i / 120.0;
            double y = applyCurve(ct, applyDeadzone(x, p.rsMin, p.rsMax));
            pts.push_back(PointF(g.X + (float)x * g.Width, g.Y + g.Height - (float)y * g.Height));
        }
        ui.polyline(pts, col, w);
    };
    for (CurveType ct : {CurveType::Standard, CurveType::Linear, CurveType::Dynamic})
        if (ct != p.curve) plot(ct, withAlpha(theme::faint, 150), 1.0f);
    plot(p.curve, theme::accent, 2.4f);
    double x = clampd(app.pad.rs.len(), 0, 1);
    double y = applyCurve(p.curve, applyDeadzone(x, p.rsMin, p.rsMax));
    float px = g.X + (float)x * g.Width, py = g.Y + g.Height - (float)y * g.Height;
    ui.line(px, g.Y, px, g.Y + g.Height, withAlpha(theme::blue, 120));
    ui.circle(px, py, 5.5f, theme::blue);
    ui.text("0", RectF(g.X - 30, g.Y + g.Height - 9, 24, 16), 11.0f, theme::faint, Align::Right);
    ui.text("100%", RectF(g.X - 40, g.Y - 6, 36, 16), 11.0f, theme::faint, Align::Right);
    ui.endLtr();
    ui.text("stick deflection", RectF(g.X, g.Y + g.Height + 3, g.Width, 16), 11.0f, theme::faint, Align::Center);
    ui.text(fmt(tr("%s  |  input %.0f%% -> turn rate %.0f%%  (~%.0f deg/s at sens %d)"), tr(curveName(p.curve)), x * 100, y * 100,
                y * p.sensH * kDegPerSecPerSens, p.sensH),
            RectF(c.X + 18, c.Y + c.Height - 26, c.Width - 36, 18), 11.5f, theme::dim);
}

static void historyCard(App& app, Ui& ui, const RectF& c) {
    ui.card(c, "RIGHT STICK - LAST 5 SECONDS");
    RectF g(c.X + 18, c.Y + 44, c.Width - 36, c.Height - 84);
    ui.beginLtr(g); // time runs left to right
    ui.fillRound(g, 4, theme::bg);
    float mid = g.Y + g.Height / 2;
    ui.line(g.X, mid, g.X + g.Width, mid, theme::border);
    float dz = (float)app.profile.rsMin * g.Height / 2;
    ui.fill(RectF(g.X, mid - dz, g.Width, dz * 2), withAlpha(theme::bad, 28));
    std::vector<PointF> xs, ys;
    const double span = 5.0;
    size_t n = app.recent.size(), stride = std::max<size_t>(1, n / 900);
    for (size_t i = 0; i < n; i += stride) {
        const Sample& s = app.recent[i];
        double age = app.now - s.t;
        if (age > span) continue;
        float x = g.X + g.Width - (float)(age / span) * g.Width;
        xs.push_back(PointF(x, mid - (float)s.pad.rs.x * g.Height / 2 * 0.96f));
        ys.push_back(PointF(x, mid - (float)s.pad.rs.y * g.Height / 2 * 0.96f));
    }
    ui.polyline(xs, theme::accent, 1.6f);
    ui.polyline(ys, theme::blue, 1.6f);
    ui.endLtr();
    ui.text("X axis", RectF(c.X + 18, c.Y + c.Height - 26, 66, 18), 11.5f, theme::accent, Align::Left, true);
    ui.text("Y axis", RectF(c.X + 88, c.Y + c.Height - 26, 66, 18), 11.5f, theme::blue, Align::Left, true);
    ui.text("Shaded band = deadzone. A flat line that sits outside the band while you are hands-off is stick drift.",
            RectF(c.X + 162, c.Y + c.Height - 26, c.Width - 180, 18), 11.5f, theme::faint, Align::Right);
}

void pageLive(App& app, Ui& ui, const RectF& a) {
    pageHeader(ui, a, "Live Input", "Orange = raw controller signal. Blue = what the game receives after your profile's deadzone and response curve.");
    float y = a.Y + 66, gap = 16;
    float h1 = (a.Height - 66 - gap) * 0.58f, h2 = a.Height - 66 - gap - h1;
    float bw = 250, sw = (a.Width - bw - gap * 2) / 2;
    // The left stick card stays on the physical left in a mirrored layout.
    RectF first(a.X, y, sw, h1), second(a.X + sw + gap, y, sw, h1);
    stickCard(app, ui, ui.rtl ? second : first, "LEFT STICK (MOVEMENT)", false);
    stickCard(app, ui, ui.rtl ? first : second, "RIGHT STICK (AIM)", true);
    buttonsCard(app, ui, RectF(a.X + (sw + gap) * 2, y, bw, h1));
    float cw = (a.Width - gap) * 0.42f;
    curveCard(app, ui, RectF(a.X, y + h1 + gap, cw, h2));
    historyCard(app, ui, RectF(a.X + cw + gap, y + h1 + gap, a.Width - cw - gap, h2));
    if (!app.pad.connected) {
        RectF r(a.X + a.Width / 2 - 210, a.Y + 6, 420, 34);
        ui.fillRound(r, 17, Color(240, 70, 34, 36));
        ui.text("No controller detected - connect an Xbox-compatible pad via USB", r, 12.5f, Color(255, 255, 190, 190), Align::Center, true);
    }
}

} // namespace wz
