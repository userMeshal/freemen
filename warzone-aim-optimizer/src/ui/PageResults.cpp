#include "App.h"

namespace wz {

namespace {
Color labelColor(const std::string& l) {
    if (l == "Baseline") return theme::blue;
    if (l == "Optimized") return theme::good;
    return theme::dim;
}

std::string num(double v, int dec) { return fmt(tr("%.*f"), dec, v); }
} // namespace

void pageResults(App& app, Ui& ui, const RectF& a) {
    pageHeader(ui, a, "Results", "Before / after comparison. Percentages are computed from your recorded runs - positive always means better.");
    float y = a.Y + 66, gap = 16;
    const auto& runs = app.history.runs();
    const RunRecord* base = app.baseline();
    const RunRecord* cur = app.history.find(app.selectedRun);
    if (!cur || (base && cur->id == base->id)) cur = app.latestRun(true);
    if (cur && base && cur->id == base->id) cur = nullptr;

    float topH = std::max(330.0f, (a.Height - 66 - gap) * 0.58f);
    float lw = a.Width * 0.60f;

    // Comparison table
    RectF T(a.X, y, lw, topH);
    ui.card(T, "BASELINE VS SELECTED RUN");
    float x = T.X + 18, w = T.Width - 36, ty = T.Y + 40;
    if (!base) {
        ui.textWrap("No baseline recorded yet.\n\nRun the benchmark with \"Baseline\" selected, or pick a run from the history below and press \"Set as baseline\".",
                    RectF(x, ty, w, 120), 13.0f, theme::dim);
        if (ui.button("Go to Benchmark", RectF(x, ty + 110, 170, 34))) app.go(Page::Benchmark);
    } else if (!cur) {
        ui.textWrap(fmt(tr("Baseline recorded %s with profile \"%s\": index %.1f, composite %.1f / 100.\n\nRun the benchmark again as \"Optimized\" or \"Practice\" to see the comparison."),
                        base->when.c_str(), base->profile.c_str(), base->r.index, base->r.composite),
                    RectF(x, ty, w, 120), 13.0f, theme::dim);
        if (ui.button("Go to Benchmark", RectF(x, ty + 110, 170, 34))) app.go(Page::Benchmark);
    } else {
        float c1 = w * 0.40f, c2 = w * 0.20f, c3 = w * 0.20f, c4 = w * 0.20f;
        ui.text("Metric", RectF(x, ty, c1, 18), 11.0f, theme::faint, Align::Left, true);
        ui.text("Baseline", RectF(x + c1, ty, c2, 18), 11.0f, theme::blue, Align::Right, true);
        ui.text(cur->label, RectF(x + c1 + c2, ty, c3, 18), 11.0f, labelColor(cur->label), Align::Right, true);
        ui.text("Change", RectF(x + c1 + c2 + c3, ty, c4, 18), 11.0f, theme::faint, Align::Right, true);
        ty += 22;
        ui.line(x, ty, x + w, ty, theme::border);
        ty += 4;
        auto deltas = compareRuns(base->r, cur->r);
        float rh = std::min(26.0f, (T.Y + T.Height - 44 - ty) / (float)deltas.size());
        for (size_t i = 0; i < deltas.size(); ++i) {
            const MetricDelta& d = deltas[i];
            bool head = i == 0;
            if (i % 2 == 1) ui.fillRound(RectF(x - 6, ty, w + 12, rh), 4, withAlpha(theme::cardHi, 90));
            ui.text(d.name, RectF(x, ty, c1, rh), 12.5f, head ? theme::text : theme::dim, Align::Left, head);
            ui.text(num(d.base, d.decimals) + " " + tr(d.unit.c_str()), RectF(x + c1, ty, c2, rh), 12.5f, theme::dim, Align::Right);
            ui.text(num(d.cur, d.decimals) + " " + tr(d.unit.c_str()), RectF(x + c1 + c2, ty, c3, rh), 12.5f, theme::text, Align::Right, head);
            std::string pct = std::fabs(d.base) < 1e-9 ? "n/a" : fmt(tr("%+.1f%%"), d.pct);
            ui.text(pct, RectF(x + c1 + c2 + c3, ty, c4, rh), 12.5f, pctColor(d.pct), Align::Right, true);
            ty += rh;
        }
        std::string note = fmt(tr("Baseline: %s, \"%s\"   |   Selected: %s, \"%s\""), base->when.c_str(), base->profile.c_str(), cur->when.c_str(), cur->profile.c_str());
        bool assistMismatch = std::fabs(base->aimAssist - cur->aimAssist) > 0.01;
        if (assistMismatch) note = fmt(tr("Warning: different trainer aim-assist strength (%.1fx vs %.1fx) - not a like-for-like comparison."), base->aimAssist, cur->aimAssist);
        else if (base->quick != cur->quick) note = "Warning: these runs used different lengths (Full vs Quick) - compare like with like.";
        else if (base->simulated || cur->simulated) note = "Contains simulated (demo mode) input - not a real measurement.";
        else if (cur->aimAssist > 0.0) note = fmt(tr("Both runs used %.1fx trainer aim assist (arena only - changes nothing in Warzone)."), cur->aimAssist);
        bool warnNote = assistMismatch || base->quick != cur->quick || base->simulated || cur->simulated;
        ui.text(note, RectF(x, T.Y + T.Height - 30, w, 18), 11.0f, warnNote ? theme::warn : theme::faint);
    }

    // Goal card
    RectF G(a.X + lw + gap, y, a.Width - lw - gap, topH);
    ui.card(G, "PROGRESS TO THE 2X GOAL");
    float gx = G.X + 18, gw = G.Width - 36, gy = G.Y + 40;
    if (base && cur) {
        double ratio = indexRatio(base->r, cur->r), pct = (ratio - 1) * 100;
        ui.text(fmt(tr("%.2fx"), ratio), RectF(gx, gy, gw, 50), 40.0f, pctColor(pct), Align::Left, true);
        gy += 52;
        ui.text(fmt(tr("%+.1f%% Aim Performance Index"), pct), RectF(gx, gy, gw, 20), 13.5f, pctColor(pct), Align::Left, true);
        gy += 34;
        drawGoalBar(ui, RectF(gx, gy, gw, 12), ratio);
        gy += 44;
        std::string verdict;
        if (ratio >= 2.0) verdict = "Goal reached: your measured index is at least double the baseline. Re-run on another day to confirm it holds.";
        else if (ratio >= 1.0) verdict = fmt(tr("You need an index of %.1f to hit 2x (currently %.1f). The biggest levers are in the Change column on the left - work on the weakest one."), base->r.index * 2, cur->r.index);
        else verdict = "This run scored below the baseline. New settings usually need a few sessions before they beat old muscle memory - or revert the last change.";
        gy += ui.textWrap(verdict, RectF(gx, gy, gw, 90), 12.0f, theme::dim) + 10;
    } else {
        ui.textWrap("The goal is twice your baseline Aim Performance Index. It is a target, not a promise - this page only ever reports what you measured.",
                    RectF(gx, gy, gw, 90), 12.5f, theme::dim);
        gy += 84;
    }
    // Trend chart of the index across runs
    RectF ch(gx, gy, gw, G.Y + G.Height - gy - 30);
    if (ch.Height > 60 && runs.size() >= 2) {
        ui.beginLtr(ch); // oldest run on the left, newest on the right
        ui.fillRound(ch, 6, theme::bg);
        double mx = 1;
        size_t first = runs.size() > 24 ? runs.size() - 24 : 0, n = runs.size() - first;
        for (size_t i = first; i < runs.size(); ++i) mx = std::max(mx, runs[i].r.index);
        if (base) {
            float byy = ch.Y + ch.Height - 8 - (float)(base->r.index / mx) * (ch.Height - 16);
            ui.line(ch.X + 4, byy, ch.X + ch.Width - 4, byy, withAlpha(theme::blue, 130));
            float gyy = ch.Y + ch.Height - 8 - (float)(base->r.index * 2 / mx) * (ch.Height - 16);
            if (base->r.index * 2 <= mx) ui.line(ch.X + 4, gyy, ch.X + ch.Width - 4, gyy, withAlpha(theme::good, 130));
        }
        std::vector<PointF> pts;
        for (size_t i = 0; i < n; ++i) {
            const RunRecord& r = runs[first + i];
            float px = ch.X + 12 + (ch.Width - 24) * (n > 1 ? (float)i / (float)(n - 1) : 0.5f);
            float py = ch.Y + ch.Height - 8 - (float)(r.r.index / mx) * (ch.Height - 16);
            pts.push_back(PointF(px, py));
        }
        ui.polyline(pts, withAlpha(theme::accent, 170), 1.6f);
        for (size_t i = 0; i < n; ++i) ui.circle(pts[i].X, pts[i].Y, 4, labelColor(runs[first + i].label));
        ui.endLtr();
        ui.text("Index per run (oldest to newest)", RectF(gx, ch.Y + ch.Height + 6, gw, 16), 11.0f, theme::faint);
    }

    // History
    y += topH + gap;
    RectF H(a.X, y, a.Width, a.Y + a.Height - y);
    ui.card(H, "RUN HISTORY");
    float hx = H.X + 18, hw = H.Width - 36, hy = H.Y + 38;
    const float cols[] = {0.00f, 0.14f, 0.33f, 0.50f, 0.57f, 0.64f, 0.71f, 0.78f, 0.90f};
    const char* heads[] = {"When", "Type", "Profile", "Index", "Score", "Accuracy", "Tracking", "Reaction", "Sens"};
    for (int i = 0; i < 9; ++i) ui.text(heads[i], RectF(hx + hw * cols[i], hy, hw * (i == 8 ? 0.10f : (cols[i + 1] - cols[i])) - 8, 18), 11.0f, theme::faint, Align::Left, true);
    hy += 22;
    float bottom = H.Y + H.Height - 50;
    int maxRows = std::max(1, (int)((bottom - hy) / 26));
    if (runs.empty()) ui.text("No runs recorded yet.", RectF(hx, hy, hw, 26), 12.5f, theme::faint);
    for (size_t k = 0; k < runs.size() && (int)k < maxRows; ++k) {
        const RunRecord& r = runs[runs.size() - 1 - k];
        RectF rr(hx - 6, hy, hw + 12, 25);
        bool sel = cur && r.id == cur->id;
        if (ui.row(rr, sel)) app.selectedRun = r.id;
        bool isBase = r.id == app.baselineId;
        std::string type = std::string(tr(r.label.c_str())) + (r.quick ? tr(" (quick)") : "") + (r.simulated ? tr(" [sim]") : "");
        if (isBase && r.label != "Baseline") type += tr(" = baseline");
        ui.text(r.when, RectF(hx + hw * cols[0], hy, hw * 0.15f, 25), 12.0f, theme::dim);
        ui.text(type, RectF(hx + hw * cols[1], hy, hw * 0.19f - 8, 25), 12.0f, isBase ? theme::blue : labelColor(r.label), Align::Left, true);
        ui.text(r.profile, RectF(hx + hw * cols[2], hy, hw * 0.17f - 8, 25), 12.0f, theme::dim);
        ui.text(fmt(tr("%.1f"), r.r.index), RectF(hx + hw * cols[3], hy, hw * 0.07f - 6, 25), 12.0f, theme::text, Align::Left, true);
        ui.text(fmt(tr("%.1f"), r.r.composite), RectF(hx + hw * cols[4], hy, hw * 0.07f - 6, 25), 12.0f, theme::dim);
        ui.text(fmt(tr("%.0f%%"), r.r.accuracy * 100), RectF(hx + hw * cols[5], hy, hw * 0.07f - 6, 25), 12.0f, theme::dim);
        ui.text(fmt(tr("%.0f%%"), r.r.trackOnTarget * 100), RectF(hx + hw * cols[6], hy, hw * 0.07f - 6, 25), 12.0f, theme::dim);
        ui.text(fmt(tr("%.0f ms"), r.r.medianReactionMs), RectF(hx + hw * cols[7], hy, hw * 0.12f - 8, 25), 12.0f, theme::dim);
        ui.text(fmt(tr("%d/%d x%.2f"), r.sensH, r.sensV, r.adsMult), RectF(hx + hw * cols[8], hy, hw * 0.10f, 25), 12.0f, theme::dim);
        hy += 26;
    }
    const RunRecord* selRun = app.history.find(app.selectedRun);
    float by = H.Y + H.Height - 42;
    if (ui.button("Set selected as baseline", RectF(hx, by, 200, 30), Btn::Secondary, selRun && selRun->id != app.baselineId)) {
        app.baselineId = selRun->id;
        app.saveSettings();
        app.notify(tr("Baseline changed to the run from ") + selRun->when);
    }
    if (ui.button("Delete selected run", RectF(hx + 212, by, 170, 30), Btn::Danger, selRun != nullptr)) {
        std::string id = selRun->id;
        if (id == app.baselineId) app.baselineId.clear();
        app.history.remove(id);
        app.history.save();
        app.selectedRun.clear();
        app.saveSettings();
        app.notify("Run deleted");
    }
    ui.text("Click a row to compare it with the baseline.", RectF(hx + 400, by, hw - 400, 30), 11.5f, theme::faint, Align::Right);
}

} // namespace wz
