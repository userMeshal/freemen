#include "App.h"
#include "../core/KeyValue.h"

namespace wz {

namespace {
const double kRestSec = 4.0, kReleaseSec = 10.0, kRotateMin = 5.0, kRotateMax = 40.0, kTrigSec = 6.0;
const char* kStepNames[] = {"Start", "Rest", "Release", "Rotate", "Triggers", "Report"};

void beginStep(App& app, int step) {
    CalState& c = app.calSt;
    c.step = step;
    c.stepStart = app.now;
    c.message.clear();
    DemoMode m = DemoMode::Free;
    if (step == 1) { m = DemoMode::Rest; c.restL.clear(); c.restR.clear(); }
    if (step == 2) { m = DemoMode::Release; c.relL.clear(); c.relR.clear(); c.settlesL = c.settlesR = 0; }
    if (step == 3) { m = DemoMode::Rotate; c.rotL.clear(); c.rotR.clear(); c.liveL = RangeResult(); c.liveR = RangeResult(); }
    if (step == 4) { m = DemoMode::Triggers; c.trigL.clear(); c.trigR.clear(); }
    app.input.setDemoMode(m);
}

void finish(App& app) {
    CalState& c = app.calSt;
    CalibrationData d;
    d.left = buildStickReport(analyzeRest(c.restL), analyzeRelease(c.relL), analyzeRange(c.rotL));
    d.right = buildStickReport(analyzeRest(c.restR), analyzeRelease(c.relR), analyzeRange(c.rotR));
    d.lt = analyzeTrigger(c.trigL);
    d.rt = analyzeTrigger(c.trigR);
    d.reportHz = c.reportHz;
    d.when = timestampNow(false);
    d.valid = d.left.rest.valid && d.right.rest.valid;
    app.cal = d;
    if (d.valid) writeFile(app.dataDir + "/calibration.txt", d.serialize());
    beginStep(app, 5);
}

void collect(App& app) {
    CalState& c = app.calSt;
    double el = app.now - c.stepStart;
    if (c.step < 1 || c.step > 4) return;
    if (!app.pad.connected) { c.stepStart = app.now; c.message = "Controller disconnected - the step restarts when it is back."; return; }
    for (const Sample& s : app.frame) {
        if (!s.pad.connected || s.t < c.stepStart) continue;
        switch (c.step) {
            case 1:
                if (s.t - c.stepStart < 0.6) break; // let the sticks settle
                if (s.pad.ls.len() > 0.45 || s.pad.rs.len() > 0.45) {
                    c.restL.clear(); c.restR.clear(); c.stepStart = app.now;
                    c.message = "Stick movement detected - let go of both sticks.";
                    return;
                }
                c.restL.push_back(s.pad.ls); c.restR.push_back(s.pad.rs);
                break;
            case 2: c.relL.push_back({s.t, s.pad.ls}); c.relR.push_back({s.t, s.pad.rs}); break;
            case 3: c.rotL.push_back(s.pad.ls); c.rotR.push_back(s.pad.rs); break;
            case 4: c.trigL.push_back(s.pad.lt); c.trigR.push_back(s.pad.rt); break;
        }
    }
    if (app.now - c.lastLive > 0.25) {
        c.lastLive = app.now;
        if (c.step == 2) { c.settlesL = analyzeRelease(c.relL).settles; c.settlesR = analyzeRelease(c.relR).settles; }
        if (c.step == 3) {
            c.liveL = analyzeRange(c.rotL); c.liveR = analyzeRange(c.rotR);
            double hz = app.input.reportHz();
            if (hz > 0) c.reportHz = hz;
        }
    }
    if (c.step == 1 && el >= kRestSec + 0.6) beginStep(app, 2);
    else if (c.step == 2 && el >= kReleaseSec) beginStep(app, 3);
    else if (c.step == 3 && ((el >= kRotateMin && c.liveL.coverage >= 0.98 && c.liveR.coverage >= 0.98) || el >= kRotateMax)) beginStep(app, 4);
    else if (c.step == 4 && el >= kTrigSec) finish(app);
}

void kvRow(Ui& ui, float x, float& y, float w, const std::string& k, const std::string& v, Color vc = theme::text) {
    ui.text(k, RectF(x, y, w * 0.58f, 20), 12.0f, theme::dim);
    ui.text(v, RectF(x + w * 0.5f, y, w * 0.5f, 20), 12.0f, vc, Align::Right, true);
    y += 21;
}

Color driftColor(DriftLevel l) {
    switch (l) {
        case DriftLevel::Excellent: return theme::good;
        case DriftLevel::Normal: return theme::good;
        case DriftLevel::Noticeable: return theme::warn;
        default: return theme::bad;
    }
}

void reportCard(Ui& ui, const RectF& c, const char* title, const StickReport& s, double curMin, double curMax) {
    ui.card(c, title);
    float size = std::min(150.0f, c.Width * 0.36f);
    RectF sr(c.X + 14, c.Y + 40, size, size);
    ScopeOpts o;
    o.dzMin = s.recMin; o.dzMax = s.recMax; o.bins = s.range.bins; o.marks = &s.release.points;
    drawScope(ui, sr, s.rest.offset, o);
    ui.pill(driftLevelName(s.drift), c.X + 14, sr.Y + size + 8, withAlpha(driftColor(s.drift), 45), driftColor(s.drift));

    float x = sr.X + size + 16, w = c.X + c.Width - 18 - x, y = c.Y + 38;
    kvRow(ui, x, y, w, "Resting offset", fmt(tr("X %+.3f  Y %+.3f"), s.rest.offset.x, s.rest.offset.y));
    kvRow(ui, x, y, w, "Sensor noise (RMS)", fmt(tr("%.4f"), s.rest.noise));
    kvRow(ui, x, y, w, "Worst centre error", fmt(tr("%.3f"), s.worstCentre), driftColor(s.drift));
    kvRow(ui, x, y, w, "Release events / worst", s.release.valid ? fmt(tr("%d / %.3f"), s.release.settles, s.release.maxSettleRadius) : "too few flicks");
    kvRow(ui, x, y, w, "Weakest edge reach", s.range.valid ? fmt(tr("%.1f%%"), s.range.minEdge * 100) : "incomplete circle",
          s.range.valid && s.range.minEdge < 0.9 ? theme::warn : theme::text);
    kvRow(ui, x, y, w, "Circularity error", s.range.valid ? fmt(tr("%.1f%%"), s.range.circularityErr) : "-");
    y += 4;
    ui.line(x, y, x + w, y, theme::border);
    y += 6;
    kvRow(ui, x, y, w, "Recommended Min deadzone", fmt(tr("%.2f  (now %.2f)"), s.recMin, curMin), theme::accent);
    kvRow(ui, x, y, w, "Recommended Max deadzone", fmt(tr("%.2f  (now %.2f)"), s.recMax, curMax), theme::accent);
}
} // namespace

void pageCalibration(App& app, Ui& ui, const RectF& a) {
    pageHeader(ui, a, "Calibration", "Four short tests measure what your sticks and triggers really output, so deadzones are set from data instead of guesswork.");
    CalState& c = app.calSt;
    collect(app);
    float y = a.Y + 66;

    // Step indicator
    float sw = a.Width / 6;
    for (int i = 0; i < 6; ++i) {
        bool done = c.step > i || (c.step == 5 && i == 5), cur = c.step == i;
        float cx = a.X + sw * i + 16;
        ui.circle(cx, y + 12, 11, done ? theme::good : (cur ? theme::accent : theme::cardHi));
        ui.text(fmt(tr("%d"), i + 1), RectF(cx - 11, y + 1, 22, 22), 11.0f, (done || cur) ? Color(255, 16, 18, 22) : theme::dim, Align::Center, true);
        ui.text(kStepNames[i], RectF(cx + 18, y + 1, sw - 40, 22), 12.5f, cur ? theme::text : theme::dim, Align::Left, cur);
        if (i < 5) ui.line(cx + 18 + ui.textWidth(kStepNames[i], 12.5f, cur) + 6, y + 12, a.X + sw * (i + 1), y + 12, theme::border);
    }
    y += 40;
    float gap = 16, H = a.Y + a.Height - y;

    if (c.step == 5) {
        const CalibrationData& d = app.cal;
        float cw = (a.Width - gap) / 2, ch = 250;
        RectF first(a.X, y, cw, ch), second(a.X + cw + gap, y, cw, ch); // left stick stays physically left
        reportCard(ui, ui.rtl ? second : first, "LEFT STICK", d.left, app.profile.lsMin, app.profile.lsMax);
        reportCard(ui, ui.rtl ? first : second, "RIGHT STICK (AIM)", d.right, app.profile.rsMin, app.profile.rsMax);
        RectF t(a.X, y + ch + gap, a.Width, std::min(200.0f, std::max(150.0f, H - ch - gap)));
        ui.card(t, "TRIGGERS, REPORT RATE & NEXT STEP");
        float ty = t.Y + 40, tw = 330;
        kvRow(ui, t.X + 18, ty, tw, "Left trigger rest / full press", d.lt.valid ? fmt(tr("%.0f%% / %.0f%%"), d.lt.restMax * 100, d.lt.pressMax * 100) : "not pressed");
        kvRow(ui, t.X + 18, ty, tw, "Right trigger rest / full press", d.rt.valid ? fmt(tr("%.0f%% / %.0f%%"), d.rt.restMax * 100, d.rt.pressMax * 100) : "not pressed");
        kvRow(ui, t.X + 18, ty, tw, "Recommended L2 / R2 deadzone", fmt(tr("%.2f / %.2f"), d.lt.recDeadzone, d.rt.recDeadzone), theme::accent);
        kvRow(ui, t.X + 18, ty, tw, "Controller report rate", d.reportHz > 0 ? fmt(tr("~%.0f Hz"), d.reportHz) : "not measured");
        float nx = t.X + tw + 60, nw = t.Width - tw - 78;
        std::string note = d.valid
            ? "Green dots show how far the stick reached in each direction; yellow dots show where it came to rest after each release. "
              "The red zone is the smallest deadzone that hides every centring error measured. Smaller deadzones give you more usable stick "
              "travel for micro-adjustments, which is where aim-assist slowdown is easiest to hold."
            : "The rest test did not collect enough data. Run the calibration again.";
        float used = ui.textWrap(note, RectF(nx, t.Y + 40, nw, 80), 12.0f, theme::dim);
        float by = std::min(t.Y + 48 + used, t.Y + t.Height - 44);
        if (ui.button("Apply deadzones to profile", RectF(nx, by, 220, 32), Btn::Primary, d.valid)) {
            Profile p = app.profile;
            p.lsMin = d.left.recMin; p.rsMin = d.right.recMin;
            if (d.left.range.valid) p.lsMax = d.left.recMax;
            if (d.right.range.valid) p.rsMax = d.right.recMax;
            if (d.lt.valid) p.ltDz = d.lt.recDeadzone;
            if (d.rt.valid) p.rtDz = d.rt.recDeadzone;
            std::string name = app.prof.nameEdit;
            app.setProfile(p);
            app.prof.nameEdit = name;
            app.notify(fmt(tr("Deadzones applied to \"%s\" - save it on the Profiles page"), app.profile.name.c_str()));
        }
        if (ui.button("Run again", RectF(nx + 232, by, 110, 32), Btn::Secondary)) beginStep(app, 1);
        if (ui.button("Full tuning", RectF(nx + 354, by, 110, 32), Btn::Secondary)) app.go(Page::Profiles);
        return;
    }

    // Instruction panel + live scopes
    float lw = std::min(430.0f, a.Width * 0.42f);
    RectF L(a.X, y, lw, H);
    ui.card(L, "INSTRUCTIONS");
    float ix = L.X + 20, iw = L.Width - 40, iy = L.Y + 44;
    double el = app.now - c.stepStart;
    std::string title, body;
    double total = 0;
    switch (c.step) {
        case 0:
            title = "Before you start";
            body = "Place the controller on a desk or hold it normally, with the USB cable connected.\n\n"
                   "1. Rest - hands off both sticks for 4 seconds.\n"
                   "2. Release - flick both sticks in different directions and let them snap back, about once a second for 10 seconds.\n"
                   "3. Rotate - roll both sticks slowly around their outer edge until every direction turns green.\n"
                   "4. Triggers - squeeze both triggers fully and release, a few times.";
            break;
        case 1: title = "Hands off both sticks"; body = "Do not touch the sticks. Measuring resting position and sensor noise."; total = kRestSec + 0.6; break;
        case 2: title = "Flick and release"; body = "Push each stick to the edge in a different direction, let go so it snaps back, wait a moment, repeat. Aim for 8 or more releases per stick."; total = kReleaseSec; break;
        case 3: title = "Roll around the edge"; body = "Press each stick firmly against the rim and roll it slowly in full circles. This step ends when both rings are complete."; total = kRotateMax; break;
        case 4: title = "Squeeze both triggers"; body = "Pull LT and RT all the way in, then fully release. Repeat three or four times."; total = kTrigSec; break;
    }
    ui.text(title, RectF(ix, iy, iw, 28), 18.0f, theme::text, Align::Left, true);
    iy += 38;
    iy += ui.textWrap(body, RectF(ix, iy, iw, 300), 13.0f, theme::dim) + 16;
    if (c.step >= 1) {
        ui.progress(RectF(ix, iy, iw, 8), c.step == 3 ? std::min(c.liveL.coverage, c.liveR.coverage) : el / total, theme::accent);
        iy += 22;
        std::string st;
        if (c.step == 1) st = fmt(tr("%.1f s remaining"), std::max(0.0, total - el));
        if (c.step == 2) st = fmt(tr("%.0f s remaining  |  releases detected: left %d, right %d"), std::max(0.0, total - el), c.settlesL, c.settlesR);
        if (c.step == 3) st = fmt(tr("Edge coverage: left %.0f%%, right %.0f%%"), c.liveL.coverage * 100, c.liveR.coverage * 100);
        if (c.step == 4) st = fmt(tr("%.1f s remaining  |  LT %.0f%%  RT %.0f%%"), std::max(0.0, total - el), app.pad.lt * 100, app.pad.rt * 100);
        ui.text(st, RectF(ix, iy, iw, 18), 12.0f, theme::text);
        iy += 26;
        if (!c.message.empty()) { ui.textWrap(c.message, RectF(ix, iy, iw, 40), 12.0f, theme::warn); }
    }
    float by = L.Y + L.Height - 52;
    if (c.step == 0) {
        if (ui.button("Start calibration", RectF(ix, by, 170, 34), Btn::Primary, app.pad.connected)) beginStep(app, 1);
        if (!app.pad.connected) ui.text("Connect a controller to begin", RectF(ix + 182, by, iw - 182, 34), 12.0f, theme::warn);
        else if (app.cal.valid && ui.button("View last report", RectF(ix + 182, by, 150, 34), Btn::Secondary)) c.step = 5;
    } else {
        if (ui.button("Cancel", RectF(ix, by, 100, 34), Btn::Secondary)) { c = CalState(); app.input.setDemoMode(DemoMode::Free); }
        if (c.step == 3 && el > 3.0 && ui.button("Finish this step", RectF(ix + 112, by, 150, 34), Btn::Secondary)) beginStep(app, 4);
    }

    RectF R(a.X + lw + gap, y, a.Width - lw - gap, H);
    ui.card(R, "LIVE SIGNAL");
    float size = std::min((R.Width - 60) / 2, R.Height - 110);
    float sy = R.Y + 46 + (R.Height - 110 - size) / 2;
    float x1 = R.X + (R.Width / 2 - size) / 2 + 6, x2 = R.X + R.Width / 2 + (R.Width / 2 - size) / 2 - 6;
    if (ui.rtl) std::swap(x1, x2); // left stick stays physically left
    ScopeOpts ol, orr;
    if (c.step == 3) { ol.bins = c.liveL.bins; orr.bins = c.liveR.bins; }
    drawScope(ui, RectF(x1, sy, size, size), app.pad.ls, ol);
    drawScope(ui, RectF(x2, sy, size, size), app.pad.rs, orr);
    ui.text("LEFT STICK", RectF(x1, sy + size + 8, size, 18), 12.0f, theme::dim, Align::Center, true);
    ui.text("RIGHT STICK", RectF(x2, sy + size + 8, size, 18), 12.0f, theme::dim, Align::Center, true);
    ui.text(fmt(tr("X %+.3f  Y %+.3f"), app.pad.ls.x, app.pad.ls.y), RectF(x1, sy + size + 28, size, 18), 12.0f, theme::faint, Align::Center);
    ui.text(fmt(tr("X %+.3f  Y %+.3f"), app.pad.rs.x, app.pad.rs.y), RectF(x2, sy + size + 28, size, 18), 12.0f, theme::faint, Align::Center);
}

} // namespace wz
