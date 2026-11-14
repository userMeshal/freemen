#include "App.h"
#include "../core/KeyValue.h"

#include <shellapi.h>

#include <ctime>
#include <filesystem>

namespace wz {

std::string timestampNow(bool forId) {
    std::time_t t = std::time(nullptr);
    std::tm tmv{};
#ifdef _MSC_VER
    localtime_s(&tmv, &t);
#else
    std::tm* p = std::localtime(&t);
    if (p) tmv = *p;
#endif
    char b[64];
    std::strftime(b, sizeof(b), forId ? "%Y%m%d-%H%M%S" : "%Y-%m-%d %H:%M", &tmv);
    return b;
}

void openInShell(const std::string& path) {
    ShellExecuteW(nullptr, L"open", widen(path).c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

void App::init(const std::string& dir, bool demoMode) {
    demo = demoMode;
    dataDir = dir;
    std::error_code ec;
    std::filesystem::create_directories(std::filesystem::u8path(dir + "/profiles"), ec);
    store.setDir(dir + "/profiles");
    history.setPath(dir + "/history.txt");
    history.load();

    std::string text;
    if (readFile(dir + "/calibration.txt", text)) cal = CalibrationData::parse(text);

    std::string active;
    if (readFile(dir + "/settings.txt", text)) {
        KeyValue kv = KeyValue::parse(text);
        active = kv.get("activeProfile");
        baselineId = kv.get("baselineId");
    }
    if (active.empty() || !store.load(active, profile)) {
        profile = builtinPresets()[0];
        profile.name = "My Current Settings";
    }
    prof.nameEdit = profile.name;
    if (!history.find(baselineId)) baselineId.clear();
    if (!baselineId.empty()) bench.labelIdx = 1; // a baseline exists, so new runs default to "Optimized"

    input.start(demo ? makeDemoSource() : makeXInputSource());
}

void App::saveSettings() {
    KeyValue kv;
    kv.set("activeProfile", profile.name);
    kv.set("baselineId", baselineId);
    writeFile(dataDir + "/settings.txt", kv.serialize());
}

void App::notify(const std::string& msg) {
    toast = msg;
    toastUntil = now + 3.5;
}

void App::setProfile(const Profile& p) {
    profile = p;
    profile.sanitize();
    prof.nameEdit = profile.name;
    prof.haveRec = false;
}

void App::go(Page p) {
    if (page == Page::Calibration && p != Page::Calibration && calSt.step > 0 && calSt.step < 5) {
        calSt = CalState();
        input.setDemoMode(DemoMode::Free);
    }
    page = p;
}

void App::update() {
    now = input.now();
    frame.clear();
    input.drain(frame);
    pad = input.latest();
    for (const auto& s : frame) recent.push_back(s);
    while (!recent.empty() && now - recent.front().t > 6.0) recent.pop_front();
}

const RunRecord* App::baseline() const { return history.find(baselineId); }

const RunRecord* App::latestRun(bool excludeBaseline) const {
    const auto& runs = history.runs();
    for (size_t i = runs.size(); i-- > 0;) {
        if (excludeBaseline && runs[i].id == baselineId) continue;
        return &runs[i];
    }
    return nullptr;
}

Color pctColor(double pct) {
    if (pct > 1.0) return theme::good;
    if (pct < -1.0) return theme::bad;
    return theme::dim;
}

void drawGoalBar(Ui& ui, const RectF& r, double ratio) {
    // Bar spans 0.5x .. 2.5x so both regressions and overshooting the goal show.
    const double lo = 0.5, hi = 2.5;
    auto xOf = [&](double v) { return r.X + (float)((clampd(v, lo, hi) - lo) / (hi - lo)) * r.Width; };
    ui.fillRound(r, r.Height / 2, theme::cardHi);
    float x1 = xOf(1.0), xr = xOf(ratio);
    if (ratio > 0) {
        Color c = ratio >= 2.0 ? theme::good : (ratio >= 1.0 ? theme::accent : theme::bad);
        float a = std::min(x1, xr), b = std::max(x1, xr);
        if (b - a > 1) ui.fill(RectF(a, r.Y, b - a, r.Height), c);
    }
    ui.line(x1, r.Y - 4, x1, r.Y + r.Height + 4, theme::dim, 1.5f);
    float x2 = xOf(2.0);
    ui.line(x2, r.Y - 4, x2, r.Y + r.Height + 4, theme::good, 2.0f);
    ui.text("baseline", RectF(x1 - 40, r.Y + r.Height + 5, 80, 14), 10.5f, theme::faint, Align::Center);
    ui.text("2x goal", RectF(x2 - 40, r.Y + r.Height + 5, 80, 14), 10.5f, theme::good, Align::Center);
}

void drawScope(Ui& ui, const RectF& r, Vec2 raw, const ScopeOpts& o) {
    float cx = r.X + r.Width / 2, cy = r.Y + r.Height / 2;
    float R = std::min(r.Width, r.Height) / 2 - 6;
    ui.circle(cx, cy, R, theme::bg);
    ui.ring(cx, cy, R, theme::border, 1.5f);
    ui.ring(cx, cy, R * 0.5f, withAlpha(theme::border, 120), 1.0f);
    ui.line(cx - R, cy, cx + R, cy, withAlpha(theme::border, 150));
    ui.line(cx, cy - R, cx, cy + R, withAlpha(theme::border, 150));
    if (o.dzMin > 0.001) {
        ui.circle(cx, cy, (float)(R * o.dzMin), withAlpha(theme::bad, 60));
        ui.ring(cx, cy, (float)(R * o.dzMin), withAlpha(theme::bad, 200), 1.0f);
    }
    if (o.dzMax < 0.999) ui.ring(cx, cy, (float)(R * o.dzMax), withAlpha(theme::blue, 170), 1.0f);

    auto pt = [&](Vec2 v) {
        double l = v.len();
        if (l > 1.08) v = v * (1.08 / l);
        return PointF(cx + (float)v.x * R, cy - (float)v.y * R);
    };
    if (o.bins) {
        std::vector<PointF> poly;
        for (int i = 0; i < kAngleBins; ++i) {
            if (o.bins[i] <= 0) continue;
            double a = (i + 0.5) / kAngleBins * 2 * kPi;
            PointF p = pt({std::cos(a) * o.bins[i], std::sin(a) * o.bins[i]});
            ui.circle(p.X, p.Y, 2.6f, theme::good);
        }
    }
    if (o.trail && o.trail->size() > 1) {
        std::vector<PointF> pts;
        pts.reserve(o.trail->size());
        for (const auto& v : *o.trail) pts.push_back(pt(v));
        ui.polyline(pts, withAlpha(theme::accent, 110), 1.3f);
    }
    if (o.marks) for (const auto& m : *o.marks) { PointF p = pt(m); ui.circle(p.X, p.Y, 3.0f, theme::warn); }
    PointF p = pt(raw);
    if (o.showProcessed) {
        PointF q = pt(o.processed);
        ui.line(cx, cy, q.X, q.Y, withAlpha(theme::blue, 200), 2.0f);
        ui.circle(q.X, q.Y, 5.0f, theme::blue);
    }
    ui.circle(p.X, p.Y, 6.5f, theme::accent);
    ui.ring(p.X, p.Y, 6.5f, Color(255, 255, 255, 255), 1.2f);
}

static void drawSidebar(App& app, Ui& ui, float w, float h) {
    ui.fill(RectF(0, 0, w, h), theme::side);
    ui.line(w, 0, w, h, theme::border);
    ui.fillRound(RectF(20, 22, 6, 34), 3, theme::accent);
    ui.text("WARZONE", RectF(36, 20, w - 40, 18), 11.5f, theme::accent, Align::Left, true);
    ui.text("Aim Assist Optimizer", RectF(36, 38, w - 40, 20), 15.0f, theme::text, Align::Left, true);

    const char* names[] = {"Dashboard", "Live Input", "Calibration", "Profiles & Tuning", "Benchmark", "Results"};
    float y = 88;
    for (int i = 0; i < (int)Page::Count; ++i) {
        RectF r(12, y, w - 24, 38);
        bool sel = (int)app.page == i;
        if (ui.row(r, sel)) app.go((Page)i);
        if (sel) ui.fillRound(RectF(12, y + 9, 3.5f, 20), 2, theme::accent);
        ui.text(names[i], RectF(30, y, w - 50, 38), 13.5f, sel ? theme::text : theme::dim, Align::Left, sel);
        y += 42;
    }

    float by = h - 96;
    ui.line(16, by, w - 16, by, theme::border);
    bool on = app.pad.connected;
    ui.circle(28, by + 26, 5, on ? theme::good : theme::bad);
    ui.text(on ? fmt("Controller connected (slot %d)", app.pad.slot + 1) : "No controller detected",
            RectF(40, by + 14, w - 50, 24), 12.0f, on ? theme::text : theme::dim);
    double hz = app.input.reportHz();
    ui.text(on ? (hz > 0 ? fmt("Report rate ~%.0f Hz", hz) : "Move a stick to measure rate") : "Connect an Xbox pad via USB",
            RectF(40, by + 36, w - 50, 18), 11.0f, theme::faint);
    if (app.demo) ui.pill("DEMO MODE - SIMULATED INPUT", 18, by + 62, withAlpha(theme::warn, 50), theme::warn);
    else ui.text("v1.0.0", RectF(40, by + 60, w - 50, 18), 11.0f, theme::faint);
}

void drawApp(App& app, Ui& ui, float w, float h) {
    ui.fill(RectF(0, 0, w, h), theme::bg);
    if (app.fullscreenArena()) {
        pageBenchmark(app, ui, RectF(0, 0, w, h));
    } else {
        const float sw = 232;
        drawSidebar(app, ui, sw, h);
        RectF area(sw + 28, 24, w - sw - 56, h - 48);
        switch (app.page) {
            case Page::Dashboard:   pageDashboard(app, ui, area); break;
            case Page::Live:        pageLive(app, ui, area); break;
            case Page::Calibration: pageCalibration(app, ui, area); break;
            case Page::Profiles:    pageProfiles(app, ui, area); break;
            case Page::Benchmark:   pageBenchmark(app, ui, area); break;
            case Page::Results:     pageResults(app, ui, area); break;
            default: break;
        }
    }
    if (!app.toast.empty() && app.now < app.toastUntil) {
        float tw = ui.textWidth(app.toast, 13.0f, true) + 40;
        RectF r(w / 2 - tw / 2, h - 64, tw, 38);
        ui.fillRound(r, 19, Color(245, 44, 50, 62));
        ui.strokeRound(r, 19, theme::accent);
        ui.text(app.toast, r, 13.0f, theme::text, Align::Center, true);
    }
}

void pageHeader(Ui& ui, const RectF& a, const std::string& title, const std::string& sub) {
    ui.text(title, RectF(a.X, a.Y, a.Width, 30), 22.0f, theme::text, Align::Left, true);
    ui.text(sub, RectF(a.X, a.Y + 30, a.Width, 20), 12.5f, theme::dim);
}

void pageDashboard(App& app, Ui& ui, const RectF& a) {
    pageHeader(ui, a, "Dashboard", "Measure your controller, tune Warzone's own settings to it, and prove the gain with a repeatable benchmark.");
    float y = a.Y + 66, gap = 16, cw = (a.Width - gap * 2) / 3, ch = 196;

    // Controller
    RectF c1(a.X, y, cw, ch);
    ui.card(c1, "CONTROLLER");
    bool on = app.pad.connected;
    ui.text(on ? "Connected" : "Not detected", RectF(c1.X + 18, c1.Y + 40, cw - 36, 30), 21.0f, on ? theme::good : theme::bad, Align::Left, true);
    ui.text(app.input.description(), RectF(c1.X + 18, c1.Y + 74, cw - 36, 18), 12.0f, theme::dim);
    double hz = app.input.reportHz();
    ui.text(fmt("Sampling at %.0f Hz  |  pad reports %s", app.input.pollHz(), hz > 0 ? fmt("~%.0f Hz", hz).c_str() : "n/a (move a stick)"),
            RectF(c1.X + 18, c1.Y + 94, cw - 36, 18), 12.0f, theme::dim);
    if (app.cal.valid)
        ui.text(fmt("Calibrated %s  |  right stick: %s", app.cal.when.c_str(), driftLevelName(app.cal.right.drift)),
                RectF(c1.X + 18, c1.Y + 114, cw - 36, 18), 12.0f, theme::dim);
    else
        ui.text("Not calibrated yet", RectF(c1.X + 18, c1.Y + 114, cw - 36, 18), 12.0f, theme::warn);
    if (ui.button("Live input", RectF(c1.X + 18, c1.Y + ch - 42, 110, 28), Btn::Secondary)) app.go(Page::Live);

    // Profile
    RectF c2(a.X + cw + gap, y, cw, ch);
    ui.card(c2, "ACTIVE PROFILE");
    const Profile& p = app.profile;
    ui.text(p.name, RectF(c2.X + 18, c2.Y + 40, cw - 36, 30), 21.0f, theme::text, Align::Left, true);
    ui.text(fmt("Sensitivity %d / %d   ADS x%.2f   %s curve", p.sensH, p.sensV, p.adsMult, curveName(p.curve)),
            RectF(c2.X + 18, c2.Y + 74, cw - 36, 18), 12.0f, theme::dim);
    ui.text(fmt("Right stick deadzone %.2f - %.2f", p.rsMin, p.rsMax), RectF(c2.X + 18, c2.Y + 94, cw - 36, 18), 12.0f, theme::dim);
    ui.text(fmt("Left stick deadzone %.2f - %.2f", p.lsMin, p.lsMax), RectF(c2.X + 18, c2.Y + 114, cw - 36, 18), 12.0f, theme::dim);
    if (ui.button("Edit / load", RectF(c2.X + 18, c2.Y + ch - 42, 110, 28), Btn::Secondary)) app.go(Page::Profiles);

    // Performance
    RectF c3(a.X + (cw + gap) * 2, y, cw, ch);
    ui.card(c3, "MEASURED IMPROVEMENT");
    const RunRecord* base = app.baseline();
    const RunRecord* cur = app.latestRun(true);
    if (base && cur) {
        double ratio = indexRatio(base->r, cur->r);
        double pct = (ratio - 1.0) * 100.0;
        ui.text(fmt("%.2fx", ratio), RectF(c3.X + 18, c3.Y + 38, 130, 36), 28.0f, pctColor(pct), Align::Left, true);
        ui.text(fmt("%+.1f%% vs baseline", pct), RectF(c3.X + 150, c3.Y + 44, cw - 168, 24), 13.0f, pctColor(pct), Align::Left, true);
        ui.text(fmt("Index %.1f -> %.1f   (%s)", base->r.index, cur->r.index, cur->when.c_str()), RectF(c3.X + 18, c3.Y + 78, cw - 36, 18), 12.0f, theme::dim);
        drawGoalBar(ui, RectF(c3.X + 18, c3.Y + 108, cw - 36, 10), ratio);
    } else if (base) {
        ui.text(fmt("Baseline index %.1f", base->r.index), RectF(c3.X + 18, c3.Y + 40, cw - 36, 30), 21.0f, theme::text, Align::Left, true);
        ui.textWrap("Baseline recorded. Apply an optimized profile, practise with it, then run the benchmark again to see the change.",
                    RectF(c3.X + 18, c3.Y + 76, cw - 36, 60), 12.0f, theme::dim);
    } else {
        ui.text("No baseline yet", RectF(c3.X + 18, c3.Y + 40, cw - 36, 30), 21.0f, theme::dim, Align::Left, true);
        ui.textWrap("Run the benchmark with your current settings first. Every later run is compared against it.",
                    RectF(c3.X + 18, c3.Y + 76, cw - 36, 60), 12.0f, theme::dim);
    }
    if (ui.button("Results", RectF(c3.X + 18, c3.Y + ch - 42, 110, 28), Btn::Secondary)) app.go(Page::Results);

    // Workflow
    y += ch + gap;
    RectF wf(a.X, y, a.Width, 262);
    ui.card(wf, "OPTIMIZATION WORKFLOW");
    struct Step { const char* title; const char* desc; bool done; const char* btn; Page page; };
    bool haveOpt = false;
    for (const auto& r : app.history.runs()) if (r.label == "Optimized") haveOpt = true;
    Step steps[] = {
        {"Calibrate the controller", "Measures stick drift, centring, range and trigger travel (about 30 seconds).", app.cal.valid, "Calibrate", Page::Calibration},
        {"Record your baseline", "Run the benchmark using the settings you play with today.", base != nullptr, "Benchmark", Page::Benchmark},
        {"Generate an optimized profile", "Deadzones from measured drift; sensitivity, ADS and curve from your benchmark data.", app.prof.haveRec || haveOpt, "Tune", Page::Profiles},
        {"Enter the values in Warzone", "Export the settings sheet and type the values into Settings > Controller in the game.", haveOpt, "Export", Page::Profiles},
        {"Re-test and compare", "Run the benchmark as \"Optimized\". The Results page shows the real percentage change.", base && haveOpt, "Results", Page::Results},
    };
    float sy = wf.Y + 44;
    for (int i = 0; i < 5; ++i) {
        const Step& s = steps[i];
        ui.circle(wf.X + 32, sy + 17, 12, s.done ? theme::good : theme::cardHi);
        ui.text(s.done ? "OK" : fmt("%d", i + 1), RectF(wf.X + 20, sy + 5, 24, 24), 11.0f, s.done ? Color(255, 10, 30, 18) : theme::dim, Align::Center, true);
        ui.text(s.title, RectF(wf.X + 56, sy, 300, 34), 13.5f, theme::text, Align::Left, true);
        ui.text(s.desc, RectF(wf.X + 300, sy, wf.Width - 440, 34), 12.5f, theme::dim);
        if (ui.button(s.btn, RectF(wf.X + wf.Width - 124, sy + 3, 104, 28), i == 0 || steps[i - 1].done ? Btn::Primary : Btn::Secondary)) app.go(s.page);
        sy += 42;
    }

    y += 262 + gap;
    RectF nt(a.X, y, a.Width, std::min(150.0f, std::max(84.0f, a.Y + a.Height - y)));
    ui.card(nt, "HOW THIS WORKS");
    ui.textWrap("This tool reads your controller through the standard Windows XInput API and never touches the game: no memory access, no injected input, "
                "no automated aiming, nothing that interacts with anti-cheat. It cannot change the strength of Warzone's aim assist. What it does is remove "
                "the things that waste it - oversized deadzones, drift, mismatched sensitivity - and measure your own stick control so progress is a number, "
                "not a feeling. The 2x goal is a target for your Aim Performance Index; the result shown is always what you actually measured.",
                RectF(nt.X + 18, nt.Y + 38, nt.Width - 36, nt.Height - 44), 12.5f, theme::dim);
}

} // namespace wz
