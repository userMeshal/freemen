#include "App.h"

namespace wz {

namespace {
const char* kLabels[] = {"Baseline", "Optimized", "Practice"};

void startRun(App& app) {
    BenchUi& b = app.bench;
    BenchConfig cfg = b.modeIdx == 1 ? BenchConfig::quick() : BenchConfig();
    cfg.aimAssist = b.assist;
    b.session = std::make_unique<BenchmarkSession>(app.profile, cfg);
    b.running = true;
    b.lastT = app.now;
    b.prevButtons = app.pad.buttons;
    app.input.setDemoMode(DemoMode::Free);
}

void finishRun(App& app) {
    BenchUi& b = app.bench;
    RunRecord rec;
    rec.id = timestampNow(true) + fmt("-%03d", (int)(std::fmod(app.now, 1.0) * 1000));
    rec.when = timestampNow(false);
    rec.profile = app.profile.name;
    rec.label = kLabels[b.labelIdx];
    rec.simulated = app.input.simulated();
    rec.quick = b.modeIdx == 1;
    rec.sensH = app.profile.sensH; rec.sensV = app.profile.sensV;
    rec.adsMult = app.profile.adsMult; rec.rsMin = app.profile.rsMin; rec.curve = (int)app.profile.curve;
    rec.aimAssist = b.assist;
    rec.r = b.session->result();
    app.history.add(rec);
    app.history.save();
    if (b.labelIdx == 0) app.baselineId = rec.id;
    app.selectedRun = rec.id;
    app.saveSettings();
    b.last = rec;
    b.haveResult = true;
    b.running = false;
    b.session.reset();
    if (b.labelIdx == 0) b.labelIdx = 1; // the next run is normally the comparison
}

// Demo mode only (--demo): a scripted "player" for our own trainer so the
// benchmark, scoring and results screens can be exercised without hardware.
// Runs produced this way are flagged as simulated everywhere they appear.
void demoPilot(const BenchmarkSession& s, BenchInput& in, double& seenT, bool& had) {
    const BenchTarget& t = s.target();
    in.ls = {}; in.rs = {}; in.lt = 0; in.rt = 0;
    if (!t.active) { had = false; return; }
    if (!had) { had = true; seenT = s.time(); }
    if (s.stage() == Stage::Ads) in.lt = 1.0;
    if (s.stage() == Stage::Tracking) in.ls = {std::sin(s.time() * 1.7) > 0 ? 0.9 : -0.9, 0.0};
    if (s.time() - seenT < 0.24) return;
    Vec2 d(t.yaw - s.yaw(), t.pitch - s.pitch());
    double wob = 0.10 * std::sin(s.time() * 9.0) + 0.06 * std::sin(s.time() * 23.0);
    Vec2 stick(d.x * 0.16 + wob, d.y * 0.16 + wob * 0.6);
    double m = stick.len();
    if (m > 1.0) stick = stick * (1.0 / m);
    in.rs = stick;
    if (s.stage() != Stage::Tracking && d.len() < t.radius * 1.15) in.rt = std::fmod(s.time(), 0.30) < 0.10 ? 1.0 : 0.0;
}

void drawArena(App& app, Ui& ui, const RectF& a) {
    BenchmarkSession& s = *app.bench.session;
    float cx = a.X + a.Width / 2, cy = a.Y + a.Height / 2;
    double zoom = lerpd(1.0, kAdsZoom, s.zoomBlend());
    double ppd = a.Width / (app.profile.trainerFov / zoom);

    ui.fill(a, Color(255, 11, 13, 17));
    // Reference grid scrolls with the view so turning speed is visible.
    const double gridDeg = 10.0;
    double startYaw = std::floor((s.yaw() - a.Width / 2 / ppd) / gridDeg) * gridDeg;
    for (double gy = startYaw; (gy - s.yaw()) * ppd < a.Width / 2 + 2; gy += gridDeg) {
        float x = cx + (float)((gy - s.yaw()) * ppd);
        bool major = std::fabs(std::fmod(std::fabs(gy), 90.0)) < 0.01;
        ui.line(x, a.Y, x, a.Y + a.Height, major ? Color(255, 46, 52, 66) : Color(255, 26, 30, 38), major ? 1.6f : 1.0f);
    }
    double startPitch = std::floor((s.pitch() - a.Height / 2 / ppd) / gridDeg) * gridDeg;
    for (double gp = startPitch; (gp - s.pitch()) * ppd < a.Height / 2 + 2; gp += gridDeg) {
        float y = cy - (float)((gp - s.pitch()) * ppd);
        bool horizon = std::fabs(gp) < 0.01;
        ui.line(a.X, y, a.X + a.Width, y, horizon ? Color(255, 60, 68, 86) : Color(255, 26, 30, 38), horizon ? 1.8f : 1.0f);
    }

    const BenchTarget& t = s.target();
    if (t.active) {
        float tx = cx + (float)((t.yaw - s.yaw()) * ppd), ty = cy - (float)((t.pitch - s.pitch()) * ppd);
        float tr = (float)(t.radius * ppd);
        bool visible = tx > a.X - tr && tx < a.X + a.Width + tr && ty > a.Y - tr && ty < a.Y + a.Height + tr;
        if (visible) {
            bool on = s.onTarget();
            ui.circle(tx, ty, tr, on ? theme::good : theme::accent);
            ui.circle(tx, ty, tr * 0.55f, on ? Color(255, 130, 232, 178) : Color(255, 255, 184, 110));
            ui.circle(tx, ty, tr * 0.18f, Color(255, 30, 22, 12));
            ui.ring(tx, ty, tr + 3, withAlpha(on ? theme::good : theme::accent, 110), 2.0f);
        } else {
            // Edge arrow for targets outside the view.
            float ex = std::max(a.X + 30, std::min(a.X + a.Width - 30, tx));
            float ey = std::max(a.Y + 90, std::min(a.Y + a.Height - 30, ty));
            ui.circle(ex, ey, 12, withAlpha(theme::accent, 220));
            ui.text(tx < a.X ? "<" : (tx > a.X + a.Width ? ">" : (ty < a.Y ? "^" : "v")), RectF(ex - 12, ey - 12, 24, 24), 14.0f, Color(255, 22, 16, 8), Align::Center, true);
        }
    }

    // Crosshair
    Color xc = Color(255, 240, 244, 250);
    float gapc = 5 + (float)s.zoomBlend() * -2, len = 9;
    for (int pass = 0; pass < 2; ++pass) { // dark outline first so it reads on bright targets
        Color c = pass == 0 ? Color(255, 8, 9, 12) : xc;
        float w = pass == 0 ? 4.5f : 2.0f, e = pass == 0 ? 1.2f : 0.0f;
        ui.line(cx - gapc - len - e, cy, cx - gapc + e, cy, c, w); ui.line(cx + gapc - e, cy, cx + gapc + len + e, cy, c, w);
        ui.line(cx, cy - gapc - len - e, cx, cy - gapc + e, c, w); ui.line(cx, cy + gapc - e, cx, cy + gapc + len + e, c, w);
        ui.circle(cx, cy, pass == 0 ? 3.0f : 1.6f, c);
    }
    if (s.zoomBlend() > 0.02) ui.ring(cx, cy, 120 + 60 * (float)(1 - s.zoomBlend()), Color((BYTE)(90 * s.zoomBlend()), 240, 244, 250), 1.5f);
    double since = s.time() - s.lastShotT();
    if (since < 0.16) {
        Color hc = s.lastShotHit() ? Color(255, 255, 255, 255) : theme::bad;
        float d0 = 7, d1 = s.lastShotHit() ? 16.0f : 12.0f;
        ui.line(cx - d1, cy - d1, cx - d0, cy - d0, hc, 2.4f); ui.line(cx + d0, cy - d0, cx + d1, cy - d1, hc, 2.4f);
        ui.line(cx - d1, cy + d1, cx - d0, cy + d0, hc, 2.4f); ui.line(cx + d0, cy + d0, cx + d1, cy + d1, hc, 2.4f);
    }

    // HUD
    ui.fill(RectF(a.X, a.Y, a.Width, 64), Color(215, 14, 16, 20));
    ui.text(stageName(s.stage()), RectF(a.X + 24, a.Y + 10, 420, 26), 17.0f, theme::text, Align::Left, true);
    std::string hint;
    switch (s.stage()) {
        case Stage::Flick:    hint = "Right stick to aim, RT to fire. Hit each target as fast as you can - misses count."; break;
        case Stage::Tracking: hint = "Keep the crosshair on the moving target. No firing. Strafe with the left stick like you would in a fight."; break;
        case Stage::Ads:      hint = "HOLD LT to aim down sights, then RT to fire. Shots without ADS do not count."; break;
        default: break;
    }
    ui.text(hint, RectF(a.X + 24, a.Y + 36, a.Width - 420, 20), 12.5f, theme::dim);
    ui.progress(RectF(a.X + a.Width - 384, a.Y + 18, 200, 8), s.overallProgress(), theme::accent);
    ui.text(fmt("%.0f%%", s.overallProgress() * 100), RectF(a.X + a.Width - 176, a.Y + 11, 44, 22), 12.5f, theme::dim);
    if (s.stage() == Stage::Tracking)
        ui.text(fmt("On target %.0f%%", s.liveTrackFraction() * 100), RectF(a.X + a.Width - 384, a.Y + 34, 200, 20), 12.5f, theme::text);
    else
        ui.text(fmt("Hits %d / %d shots", s.hits(), s.shots()), RectF(a.X + a.Width - 384, a.Y + 34, 200, 20), 12.5f, theme::text);
    ui.text("B or Esc: abort", RectF(a.X + a.Width - 140, a.Y + 10, 120, 22), 12.0f, theme::faint, Align::Right);
    std::string pname = app.profile.name;
    if (s.assist() > 0.0) pname = fmt("Trainer aim assist %.1fx  |  ", s.assist()) + pname;
    ui.text(pname, RectF(a.X + a.Width - 420, a.Y + 34, 400, 20), 12.0f, s.assist() > 0 ? theme::blue : theme::faint, Align::Right);

    auto banner = [&](const std::string& headline, const std::string& detail) {
        RectF r(cx - 300, cy - 130, 600, 100);
        ui.fillRound(r, 14, Color(225, 20, 23, 29));
        ui.strokeRound(r, 14, theme::border);
        ui.text(headline, RectF(r.X, r.Y + 12, r.Width, 46), 30.0f, theme::accent, Align::Center, true);
        ui.text(detail, RectF(r.X + 16, r.Y + 60, r.Width - 32, 26), 13.5f, theme::dim, Align::Center);
    };
    if (s.stage() == Stage::Countdown) banner(fmt("%d", (int)std::ceil(3.0 - s.stageTime())), "Stage 1: flick to each target and fire with RT");
    if (s.stage() == Stage::Break1) banner("Tracking next", "Hold the crosshair on the moving target - keep strafing with the left stick");
    if (s.stage() == Stage::Break2) banner("ADS precision next", "Hold LT to aim down sights, then fire at the small targets with RT");
    if (!app.pad.connected) {
        RectF r(cx - 260, cy + 40, 520, 50);
        ui.fillRound(r, 12, Color(240, 70, 34, 36));
        ui.text("Controller disconnected - benchmark paused", r, 15.0f, Color(255, 255, 200, 200), Align::Center, true);
    }
}

void statTile(Ui& ui, const RectF& r, const std::string& label, const std::string& value, const std::string& sub, Color vc = theme::text) {
    ui.fillRound(r, 8, theme::bg);
    ui.text(label, RectF(r.X + 14, r.Y + 8, r.Width - 28, 18), 11.0f, theme::dim, Align::Left, true);
    ui.text(value, RectF(r.X + 14, r.Y + 26, r.Width - 28, 32), 22.0f, vc, Align::Left, true);
    ui.text(sub, RectF(r.X + 14, r.Y + 58, r.Width - 28, 18), 11.0f, theme::faint);
}
} // namespace

void pageBenchmark(App& app, Ui& ui, const RectF& a) {
    BenchUi& b = app.bench;
    if (b.running && b.session) {
        bool abortKey = ui.keyEsc;
        for (const Sample& s : app.frame) {
            if (s.t <= b.lastT) continue;
            double dt = s.t - b.lastT;
            b.lastT = s.t;
            if (!s.pad.connected) continue; // paused while unplugged
            if ((s.pad.buttons & BtnB) && !(b.prevButtons & BtnB)) abortKey = true;
            b.prevButtons = s.pad.buttons;
            BenchInput in;
            in.dt = dt; in.ls = s.pad.ls; in.rs = s.pad.rs; in.lt = s.pad.lt; in.rt = s.pad.rt;
            if (app.input.simulated()) demoPilot(*b.session, in, b.pilotSeen, b.pilotHad);
            b.session->step(in);
            if (b.session->finished()) break;
        }
        if (b.session->finished()) { finishRun(app); app.notify("Benchmark saved to Results"); return; }
        if (abortKey) { b.running = false; b.session.reset(); app.notify("Benchmark aborted - nothing was saved"); return; }
        drawArena(app, ui, a);
        return;
    }

    pageHeader(ui, a, "Benchmark", "A fixed, repeatable aim test. The target sequence is identical every run, so differences come from you and your settings.");
    float y = a.Y + 66, gap = 16;
    float lw = std::min(470.0f, a.Width * 0.46f);
    RectF L(a.X, y, lw, a.Height - 66);
    ui.card(L, "RUN SETUP");
    float x = L.X + 18, w = L.Width - 36, yy = L.Y + 42;
    ui.text("Record this run as", RectF(x, yy, w, 18), 12.0f, theme::dim);
    yy += 22;
    ui.segmented("lbl", RectF(x, yy, w, 32), {"Baseline", "Optimized", "Practice"}, b.labelIdx);
    yy += 40;
    const char* lblHelp[] = {
        "Baseline: your reference run with the settings you use today. All improvement figures are measured against it.",
        "Optimized: a run with a tuned profile. Compared against the baseline on the Results page.",
        "Practice: saved to history for trend tracking, without changing the baseline."};
    yy += ui.textWrap(lblHelp[b.labelIdx], RectF(x, yy, w, 60), 12.0f, theme::faint) + 14;
    ui.text("Length", RectF(x, yy, w, 18), 12.0f, theme::dim);
    yy += 22;
    ui.segmented("mode", RectF(x, yy, w, 32), {"Full (about 90 s)", "Quick (about 45 s)"}, b.modeIdx);
    yy += 44;
    ui.text("Trainer field of view", RectF(x, yy, 150, 26), 12.0f, theme::dim);
    ui.slider("fov", RectF(x + 150, yy, w - 150 - 50, 26), app.profile.trainerFov, 80, 120, 1);
    ui.text(fmt("%.0f", app.profile.trainerFov), RectF(x + w - 46, yy, 46, 26), 13.0f, theme::text, Align::Right, true);
    yy += 36;
    ui.text("Trainer aim assist", RectF(x, yy, 150, 26), 12.0f, theme::dim);
    ui.slider("assist", RectF(x + 150, yy, w - 150 - 50, 26), b.assist, 0.0, 3.0, 0.5);
    ui.text(b.assist <= 0.0 ? "Off" : fmt("%.1fx", b.assist), RectF(x + w - 46, yy, 46, 26), 13.0f, b.assist > 0 ? theme::blue : theme::text, Align::Right, true);
    yy += 24;
    ui.textWrap(b.assist <= 0.0
        ? "Off: measures your raw stick control, the way Warzone's own aim assist is built on. Leave it off for baseline vs optimized comparisons."
        : fmt("%.1fx: a trainer-only approximation so you can feel and measure aim assist. It changes nothing in Warzone. Compare only against runs at the same strength.", b.assist),
        RectF(x, yy, w, 44), 11.5f, b.assist > 0 ? theme::blue : theme::faint);
    yy += 50;
    ui.fillRound(RectF(x, yy, w, 74), 8, theme::bg);
    const Profile& p = app.profile;
    ui.text("Profile in use: " + p.name, RectF(x + 12, yy + 8, w - 24, 20), 12.5f, theme::text, Align::Left, true);
    ui.text(fmt("Sens %d / %d   ADS x%.2f   %s   RS deadzone %.2f-%.2f", p.sensH, p.sensV, p.adsMult, curveName(p.curve), p.rsMin, p.rsMax),
            RectF(x + 12, yy + 30, w - 24, 18), 12.0f, theme::dim);
    ui.text("Applied to your stick exactly as shown on the Live Input page.", RectF(x + 12, yy + 50, w - 24, 18), 11.5f, theme::faint);
    yy += 88;
    ui.textWrap("Stage 1  Flick & fire - targets appear around you; aim and shoot with RT.\n"
                "Stage 2  Tracking - hold the crosshair on a strafing target.\n"
                "Stage 3  ADS precision - hold LT and hit small, distant targets.\n\n"
                "With aim assist off the trainer measures raw stick control, the way the game's assist is built on. "
                "The adjustable aim assist above is a trainer-only model for experimenting - it never touches Warzone. "
                "Use the same posture, grip and distance from the screen for every run you want to compare.",
                RectF(x, yy, w, 200), 12.0f, theme::dim);
    bool can = app.pad.connected;
    if (ui.button(can ? "Start benchmark" : "Connect a controller to start", RectF(x, L.Y + L.Height - 54, w, 38), Btn::Primary, can)) startRun(app);

    RectF R(a.X + lw + gap, y, a.Width - lw - gap, a.Height - 66);
    ui.card(R, b.haveResult ? "LAST RUN" : "WHAT IS MEASURED");
    float rx = R.X + 18, rw = R.Width - 36, ry = R.Y + 42;
    if (!b.haveResult) {
        ui.textWrap("Accuracy - hits divided by shots fired plus targets that timed out.\n\n"
                    "Tracking - share of time the crosshair is on a moving target, and the average angular error.\n\n"
                    "Reaction - time from a target appearing to your aim starting to close in, plus the full time to hit.\n\n"
                    "Consistency - how much your time-to-hit and second-by-second tracking vary.\n\n"
                    "Aim Performance Index - accuracy x tracking quality x hits per second x consistency factor. "
                    "It has no upper limit, so the 2x goal is a real, checkable target: twice the baseline index.",
                    RectF(rx, ry, rw, R.Height - 60), 12.5f, theme::dim);
        return;
    }
    const BenchResult& r = b.last.r;
    float tw = (rw - 12) / 2, th = 82;
    statTile(ui, RectF(rx, ry, tw, th), "AIM PERFORMANCE INDEX", fmt("%.1f", r.index), fmt("composite score %.1f / 100", r.composite), theme::accent);
    const RunRecord* base = app.baseline();
    if (base && base->id != b.last.id) {
        double ratio = indexRatio(base->r, r);
        statTile(ui, RectF(rx + tw + 12, ry, tw, th), "VS BASELINE", fmt("%.2fx", ratio), fmt("%+.1f%% (2x is the goal)", (ratio - 1) * 100), pctColor((ratio - 1) * 100));
    } else {
        statTile(ui, RectF(rx + tw + 12, ry, tw, th), "RECORDED AS", b.last.label, b.last.when);
    }
    ry += th + 12;
    statTile(ui, RectF(rx, ry, tw, th), "ACCURACY", fmt("%.0f%%", r.accuracy * 100), fmt("%d hits, %d shots, %d timed out", r.hits, r.shots, r.timeouts));
    statTile(ui, RectF(rx + tw + 12, ry, tw, th), "TRACKING", fmt("%.0f%%", r.trackOnTarget * 100), fmt("on target, mean error %.2f deg", r.trackMeanErrDeg));
    ry += th + 12;
    statTile(ui, RectF(rx, ry, tw, th), "REACTION", fmt("%.0f ms", r.medianReactionMs), fmt("median, time to hit %.0f ms", r.medianAcquireMs));
    statTile(ui, RectF(rx + tw + 12, ry, tw, th), "CONSISTENCY", fmt("%.0f / 100", r.scoreConsistency), fmt("time-to-hit variation %.0f%%", r.acquireCv * 100));
    ry += th + 12;
    statTile(ui, RectF(rx, ry, tw, th), "ADS PRECISION", fmt("%.0f%%", r.adsAccuracy * 100), fmt("targets hit, median %.0f ms", r.adsMedianAcquireMs));
    statTile(ui, RectF(rx + tw + 12, ry, tw, th), "CONTROL", fmt("%.0f%% overshoot", r.overshootRate * 100), fmt("stick pinned %.0f%%, strafing %.0f%%", r.saturation * 100, r.strafeUptime * 100));
    ry += th + 14;
    if (b.last.aimAssist > 0.0) { ui.pill(fmt("TRAINER AIM ASSIST %.1fx (ARENA ONLY)", b.last.aimAssist), rx, ry, withAlpha(theme::blue, 50), theme::blue); ry += 28; }
    if (b.last.simulated) ui.pill("SIMULATED INPUT - NOT A REAL RESULT", rx, ry, withAlpha(theme::warn, 50), theme::warn);
    float by = R.Y + R.Height - 54;
    if (ui.button("Open Results", RectF(rx, by, 150, 38), Btn::Secondary)) app.go(Page::Results);
    if (ui.button("Tune from this run", RectF(rx + 162, by, 170, 38), Btn::Secondary)) app.go(Page::Profiles);
}

} // namespace wz
