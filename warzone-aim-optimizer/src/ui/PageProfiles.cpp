#include "App.h"
#include "../core/KeyValue.h"

#include <filesystem>

namespace wz {

namespace {

bool numRow(Ui& ui, const std::string& id, float x, float& y, float w, const std::string& label, double& v,
            double mn, double mx, double step, const char* f) {
    ui.text(label, RectF(x, y, 190, 26), 12.5f, theme::dim);
    bool ch = ui.slider(id, RectF(x + 190, y, w - 190 - 58, 26), v, mn, mx, step);
    ui.text(fmt(f, v), RectF(x + w - 54, y, 54, 26), 13.0f, theme::text, Align::Right, true);
    y += 30;
    return ch;
}

bool intRow(Ui& ui, const std::string& id, float x, float& y, float w, const std::string& label, int& v, int mn, int mx) {
    double d = v;
    bool ch = numRow(ui, id, x, y, w, label, d, mn, mx, 1, "%.0f");
    v = (int)std::lround(d);
    return ch;
}

bool segRow(Ui& ui, const std::string& id, float x, float& y, float w, const std::string& label,
            const std::vector<std::string>& opts, int& idx) {
    ui.text(label, RectF(x, y, 190, 28), 12.5f, theme::dim);
    bool ch = ui.segmented(id, RectF(x + 190, y, w - 190, 28), opts, idx);
    y += 34;
    return ch;
}

void section(Ui& ui, float x, float& y, float w, const char* name) {
    y += 4;
    ui.text(name, RectF(x, y, w, 18), 11.0f, theme::accent, Align::Left, true);
    ui.line(x + ui.textWidth(name, 11.0f, true) + 6, y + 9, x + w, y + 9, theme::border);
    y += 22;
}

const RunRecord* benchForAdvice(const App& app) {
    // Advice must come from a run made with the profile's current sensitivity,
    // otherwise "lower by 1" would be applied twice.
    const auto& runs = app.history.runs();
    for (size_t i = runs.size(); i-- > 0;) {
        const RunRecord& r = runs[i];
        if (r.simulated != app.demo) continue;
        if (r.sensH == app.profile.sensH && r.sensV == app.profile.sensV && std::fabs(r.adsMult - app.profile.adsMult) < 0.005) return &r;
    }
    return nullptr;
}

void listColumn(App& app, Ui& ui, const RectF& c) {
    ui.card(c, "SAVED PROFILES");
    if (app.prof.listDirty) { app.prof.names = app.store.list(); app.prof.listDirty = false; }
    float y = c.Y + 40;
    float maxSaved = c.Y + c.Height - 226;
    if (app.prof.names.empty())
        ui.textWrap("Nothing saved yet. Tune the values and press Save.", RectF(c.X + 16, y, c.Width - 32, 40), 12.0f, theme::faint);
    for (const auto& n : app.prof.names) {
        if (y + 30 > maxSaved) break;
        RectF r(c.X + 8, y, c.Width - 16, 30);
        if (ui.row(r, n == app.profile.name)) {
            Profile p;
            if (app.store.load(n, p)) { app.setProfile(p); app.saveSettings(); app.notify("Loaded \"" + n + "\""); }
        }
        ui.text(n, RectF(c.X + 18, y, c.Width - 36, 30), 12.5f, n == app.profile.name ? theme::text : theme::dim);
        y += 32;
    }
    y = c.Y + c.Height - 208;
    ui.text("STARTING POINTS", RectF(c.X + 18, y, c.Width - 36, 20), 12.0f, theme::dim, Align::Left, true);
    y += 26;
    for (const auto& p : builtinPresets()) {
        RectF r(c.X + 8, y, c.Width - 16, 30);
        if (ui.row(r, false)) { app.setProfile(p); app.notify("Preset \"" + p.name + "\" loaded into the editor"); }
        ui.text(p.name, RectF(c.X + 18, y, c.Width - 36, 30), 12.5f, theme::dim);
        y += 32;
    }
    if (ui.button("Open data folder", RectF(c.X + 14, c.Y + c.Height - 40, c.Width - 28, 28), Btn::Secondary)) openInShell(app.dataDir);
}

void editorColumn(App& app, Ui& ui, const RectF& c) {
    ui.card(c, "WARZONE CONTROLLER SETTINGS");
    Profile& p = app.profile;
    float x = c.X + 18, w = c.Width - 36, y = c.Y + 40;
    bool ch = false;

    ui.text("Profile name", RectF(x, y, 190, 30), 12.5f, theme::dim);
    ui.textField("profname", RectF(x + 190, y, w - 190, 30), app.prof.nameEdit, 40);
    y += 38;

    section(ui, x, y, w, "AIMING");
    ch |= intRow(ui, "sh", x, y, w, "Horizontal sensitivity", p.sensH, 1, 20);
    ch |= intRow(ui, "sv", x, y, w, "Vertical sensitivity", p.sensV, 1, 20);
    ch |= numRow(ui, "am", x, y, w, "ADS multiplier (low zoom)", p.adsMult, 0.50, 1.50, 0.01, "%.2f");
    ch |= numRow(ui, "amh", x, y, w, "ADS multiplier (2x+ zoom)", p.adsMultHigh, 0.50, 1.50, 0.01, "%.2f");
    ch |= segRow(ui, "at", x, y, w, "ADS transition timing", {"Instant", "Gradual", "After Zoom"}, p.adsTransition);
    int curve = (int)p.curve;
    if (segRow(ui, "cv", x, y, w, "Aim response curve", {"Standard", "Linear", "Dynamic"}, curve)) { p.curve = (CurveType)curve; ch = true; }

    section(ui, x, y, w, "DEADZONES");
    ch |= numRow(ui, "rmin", x, y, w, "Right stick Min", p.rsMin, 0.0, 0.30, 0.01, "%.2f");
    ch |= numRow(ui, "rmax", x, y, w, "Right stick Max", p.rsMax, 0.80, 0.99, 0.01, "%.2f");
    ch |= numRow(ui, "lmin", x, y, w, "Left stick Min", p.lsMin, 0.0, 0.30, 0.01, "%.2f");
    ch |= numRow(ui, "lmax", x, y, w, "Left stick Max", p.lsMax, 0.80, 0.99, 0.01, "%.2f");
    ch |= numRow(ui, "ltd", x, y, w, "L2 trigger deadzone", p.ltDz, 0.0, 0.30, 0.01, "%.2f");
    ch |= numRow(ui, "rtd", x, y, w, "R2 trigger deadzone", p.rtDz, 0.0, 0.30, 0.01, "%.2f");

    section(ui, x, y, w, "AIM ASSIST");
    ch |= segRow(ui, "aat", x, y, w, "Aim assist type", {"Default", "Precision", "Focusing", "Black Ops"}, p.aimAssistType);
    if (ch) app.prof.haveRec = false;

    // Actions
    float by = c.Y + c.Height - 46, bw = (w - 3 * 10) / 4;
    std::string name = ProfileStore::sanitizeName(app.prof.nameEdit);
    if (ui.button("Save", RectF(x, by, bw, 32), Btn::Primary)) {
        p.name = name;
        app.prof.nameEdit = name;
        p.sanitize();
        if (app.store.save(p)) { app.prof.listDirty = true; app.saveSettings(); app.notify("Saved \"" + p.name + "\""); }
        else app.notify("Could not write the profile file");
    }
    if (ui.button("Export sheet", RectF(x + (bw + 10), by, bw, 32), Btn::Secondary)) {
        std::error_code ec;
        std::filesystem::create_directories(std::filesystem::u8path(app.dataDir + "/exports"), ec);
        Profile e = p; e.name = name;
        std::string path = app.dataDir + "/exports/" + name + " - Warzone settings.txt";
        if (writeFile(path, exportCheatSheet(e))) { app.notify("Settings sheet exported"); openInShell(path); }
        else app.notify("Could not write the settings sheet");
    }
    if (ui.button("Test in trainer", RectF(x + (bw + 10) * 2, by, bw, 32), Btn::Secondary)) app.go(Page::Benchmark);
    if (ui.button("Delete", RectF(x + (bw + 10) * 3, by, bw, 32), Btn::Danger, app.store.exists(p.name))) {
        std::string gone = p.name;
        app.store.remove(gone);
        app.prof.listDirty = true;
        app.notify("Deleted \"" + gone + "\"");
    }
}

void optimizerColumn(App& app, Ui& ui, const RectF& c) {
    ui.card(c, "OPTIMIZER");
    float x = c.X + 18, w = c.Width - 36, y = c.Y + 40;
    Profile& p = app.profile;
    const RunRecord* run = benchForAdvice(app);

    ui.text("Precision", RectF(x, y, 80, 18), 11.5f, theme::dim);
    ui.text("Responsiveness", RectF(x + w - 110, y, 110, 18), 11.5f, theme::dim, Align::Right);
    ui.text(p.bias < -0.33 ? "Steady" : (p.bias > 0.33 ? "Fast" : "Balanced"), RectF(x, y, w, 18), 11.5f, theme::text, Align::Center, true);
    y += 18;
    if (ui.slider("bias", RectF(x, y, w, 26), p.bias, -1.0, 1.0, 0.05)) app.prof.haveRec = false;
    y += 34;

    ui.circle(x + 6, y + 9, 4.5f, app.cal.valid ? theme::good : theme::warn);
    ui.text(app.cal.valid ? "Calibration data: " + app.cal.when : "No calibration yet - deadzones cannot be tuned",
            RectF(x + 18, y, w - 18, 18), 12.0f, theme::dim);
    y += 20;
    ui.circle(x + 6, y + 9, 4.5f, run ? theme::good : theme::warn);
    ui.text(run ? "Benchmark data: " + run->when + " (" + run->label + ")" : "No benchmark at these sensitivity values yet",
            RectF(x + 18, y, w - 18, 18), 12.0f, theme::dim);
    y += 28;

    if (ui.button("Generate recommendation", RectF(x, y, w, 34), Btn::Primary)) {
        app.prof.rec = recommend(p, app.cal.valid ? &app.cal : nullptr, run ? &run->r : nullptr);
        app.prof.haveRec = true;
    }
    y += 44;
    if (!app.prof.haveRec) {
        ui.textWrap("Recommendations use only what was measured on your controller and in your benchmark runs, plus the preference slider above. "
                    "Each suggested value comes with the reason for it.\n\nBest results: calibrate, record a baseline benchmark, then generate.",
                    RectF(x, y, w, c.Height), 12.0f, theme::faint);
        return;
    }
    const Recommendation& r = app.prof.rec;
    const Profile& q = r.profile;
    ui.fillRound(RectF(x, y, w, 62), 8, theme::bg);
    ui.text(fmt("Sens %d / %d    ADS x%.2f / x%.2f    %s", q.sensH, q.sensV, q.adsMult, q.adsMultHigh, curveName(q.curve)),
            RectF(x + 12, y + 8, w - 24, 20), 12.5f, theme::text, Align::Left, true);
    ui.text(fmt("RS %.2f-%.2f   LS %.2f-%.2f   L2/R2 %.2f/%.2f", q.rsMin, q.rsMax, q.lsMin, q.lsMax, q.ltDz, q.rtDz),
            RectF(x + 12, y + 32, w - 24, 20), 12.0f, theme::dim);
    y += 72;

    float bottom = c.Y + c.Height - 54;
    auto block = [&](const std::vector<std::string>& items, Color dot, Color col) {
        for (const auto& s : items) {
            float h = ui.wrapHeight(s, w - 16, 11.5f);
            if (y + h > bottom) return;
            ui.circle(x + 4, y + 8, 3, dot);
            ui.textWrap(s, RectF(x + 14, y, w - 16, h + 4), 11.5f, col);
            y += h + 6;
        }
    };
    block(r.warnings, theme::bad, Color(255, 255, 180, 170));
    block(r.reasons, theme::accent, theme::dim);
    block(r.tips, theme::blue, theme::dim);

    if (ui.button("Apply to editor", RectF(x, c.Y + c.Height - 46, w, 32), Btn::Primary)) {
        Profile np = q;
        std::string base = ProfileStore::sanitizeName(app.prof.nameEdit);
        if (base.find("Optimized") == std::string::npos) base += " - Optimized";
        np.name = base;
        np.notes = "Generated by the optimizer on " + timestampNow(false);
        Recommendation keep = app.prof.rec;
        app.setProfile(np);
        app.prof.rec = keep;
        app.prof.haveRec = true;
        app.notify("Applied. Press Save, then Export sheet to enter the values in Warzone");
    }
}

} // namespace

void pageProfiles(App& app, Ui& ui, const RectF& a) {
    pageHeader(ui, a, "Profiles & Tuning", "Every value here maps to an option in Warzone's Settings > Controller menu. Changes take effect in the trainer immediately.");
    float y = a.Y + 66, h = a.Height - 66, gap = 16;
    float lw = 208, rw = std::max(300.0f, (a.Width - lw - gap * 2) * 0.42f), mw = a.Width - lw - rw - gap * 2;
    listColumn(app, ui, RectF(a.X, y, lw, h));
    editorColumn(app, ui, RectF(a.X + lw + gap, y, mw, h));
    optimizerColumn(app, ui, RectF(a.X + lw + mw + gap * 2, y, rw, h));
}

} // namespace wz
