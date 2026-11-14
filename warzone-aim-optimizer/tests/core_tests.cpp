// Headless tests for the portable core. Built natively on the dev machine and
// as a Windows console EXE (run on Windows or under Wine).
#include "../src/core/Benchmark.h"
#include "../src/core/History.h"
#include "../src/core/KeyValue.h"
#include "../src/core/Profile.h"
#include "../src/core/Recommender.h"
#include "../src/core/StickAnalysis.h"

#include <cstdio>
#include <filesystem>
#include <functional>

using namespace wz;

static int g_fail = 0, g_checks = 0;
#define CHECK(c) do { ++g_checks; if (!(c)) { ++g_fail; std::printf("    FAIL %s:%d  %s\n", __FILE__, __LINE__, #c); } } while (0)
#define NEAR(a, b, eps) CHECK(std::fabs((a) - (b)) <= (eps))

static void run(const char* name, const std::function<void()>& f) {
    int before = g_fail;
    f();
    std::printf("[%s] %s\n", g_fail == before ? " ok " : "FAIL", name);
}

// Simulated player used to drive the benchmark: proportional aim with a
// reaction delay, hand noise and a configurable firing discipline.
struct Bot {
    double gain, reaction, noise, fireAt; // fireAt: fraction of target radius
    bool strafe;
    Rng rng{99};
    double seenT = -1; bool had = false;
    BenchInput drive(const BenchmarkSession& s, double dt) {
        BenchInput in; in.dt = dt;
        const BenchTarget& t = s.target();
        if (!t.active) { had = false; return in; }
        if (!had) { had = true; seenT = s.time(); }
        if (s.stage() == Stage::Ads) in.lt = 1.0;
        if (strafe && s.stage() == Stage::Tracking) in.ls = {std::sin(s.time() * 2.0) > 0 ? 1.0 : -1.0, 0};
        if (s.time() - seenT < reaction) return in;
        Vec2 d(t.yaw - s.yaw(), t.pitch - s.pitch());
        double dist = d.len();
        Vec2 stick = d * gain;
        stick.x += rng.range(-noise, noise); stick.y += rng.range(-noise, noise);
        double m = stick.len();
        if (m > 1.0) stick = stick * (1.0 / m);
        in.rs = stick;
        if (s.stage() != Stage::Tracking && dist < t.radius * fireAt) {
            // pulse the trigger: press on alternating 60 ms slots
            in.rt = std::fmod(s.time(), 0.12) < 0.06 ? 1.0 : 0.0;
        }
        return in;
    }
};

static BenchResult playBot(Bot bot, const Profile& p, const BenchConfig& cfg) {
    BenchmarkSession s(p, cfg);
    int guard = 0;
    while (!s.finished() && guard++ < 2000000) s.step(bot.drive(s, 0.002));
    return s.result();
}

int main() {
    run("response curves are monotonic with fixed endpoints", [] {
        for (CurveType c : {CurveType::Standard, CurveType::Linear, CurveType::Dynamic}) {
            NEAR(applyCurve(c, 0.0), 0.0, 1e-9);
            NEAR(applyCurve(c, 1.0), 1.0, 1e-9);
            double prev = -1;
            for (int i = 0; i <= 100; ++i) { double y = applyCurve(c, i / 100.0); CHECK(y >= prev); prev = y; }
        }
        CHECK(applyCurve(CurveType::Standard, 0.3) < applyCurve(CurveType::Linear, 0.3));
        CHECK(applyCurve(CurveType::Dynamic, 0.15) > applyCurve(CurveType::Standard, 0.15));
    });

    run("deadzone and stick processing", [] {
        NEAR(applyDeadzone(0.04, 0.05, 0.99), 0.0, 1e-12);
        NEAR(applyDeadzone(0.99, 0.05, 0.99), 1.0, 1e-12);
        NEAR(applyDeadzone(0.52, 0.05, 0.99), 0.5, 1e-9);
        StickTuning t{0.10, 0.90, CurveType::Linear};
        Vec2 o = processStick({0.05, 0.05}, t);
        NEAR(o.len(), 0.0, 1e-12);
        o = processStick({0.5, 0.0}, t);
        NEAR(o.x, 0.5, 1e-9); NEAR(o.y, 0.0, 1e-12);
        o = processStick({0.0, -1.0}, t);
        NEAR(o.y, -1.0, 1e-9);
        NEAR(processTrigger(0.1, 0.1), 0.0, 1e-12);
        NEAR(processTrigger(1.0, 0.1), 1.0, 1e-12);
    });

    run("profile serialize / parse / sanitize", [] {
        Profile p; p.name = "My Profile"; p.sensH = 9; p.sensV = 7; p.adsMult = 0.85; p.curve = CurveType::Dynamic;
        p.rsMin = 0.07; p.rsMax = 0.95; p.notes = "line1\nline2 = x"; p.aimAssistType = 2; p.bias = -0.4;
        Profile q = Profile::parse(p.serialize());
        CHECK(q.name == p.name); CHECK(q.sensH == 9); CHECK(q.sensV == 7); NEAR(q.adsMult, 0.85, 1e-9);
        CHECK(q.curve == CurveType::Dynamic); NEAR(q.rsMin, 0.07, 1e-9); NEAR(q.rsMax, 0.95, 1e-9);
        CHECK(q.notes == p.notes); CHECK(q.aimAssistType == 2); NEAR(q.bias, -0.4, 1e-9);
        Profile bad = Profile::parse("sensH=999\nrsMin=7\ncurve=42\nadsMult=-3\n");
        CHECK(bad.sensH == 20); NEAR(bad.rsMin, 0.5, 1e-9); CHECK(bad.curve == CurveType::Standard); NEAR(bad.adsMult, 0.1, 1e-9);
        CHECK(builtinPresets().size() >= 4);
        CHECK(exportCheatSheet(p).find("Horizontal Stick Sensitivity ......... 9") != std::string::npos);
    });

    run("profile store save / list / load / delete", [] {
        auto dir = std::filesystem::temp_directory_path() / "wzaao_test_profiles";
        std::error_code ec; std::filesystem::remove_all(dir, ec);
        ProfileStore st(dir.u8string());
        CHECK(st.list().empty());
        Profile a; a.name = "Alpha"; a.sensH = 4;
        Profile b; b.name = "Bad:/Name?*"; b.sensH = 11;
        CHECK(st.save(a)); CHECK(st.save(b));
        auto names = st.list();
        CHECK(names.size() == 2);
        Profile l;
        CHECK(st.load("Alpha", l)); CHECK(l.sensH == 4);
        CHECK(st.load("Bad:/Name?*", l)); CHECK(l.sensH == 11);
        a.sensH = 5; CHECK(st.save(a)); CHECK(st.load("Alpha", l)); CHECK(l.sensH == 5);
        CHECK(st.remove("Alpha")); CHECK(!st.exists("Alpha")); CHECK(st.list().size() == 1);
        CHECK(!st.load("Missing", l));
        std::filesystem::remove_all(dir, ec);
    });

    run("rest analysis detects drift offset and noise", [] {
        Rng r(5);
        std::vector<Vec2> clean, drift;
        for (int i = 0; i < 4000; ++i) {
            clean.push_back({r.range(-0.004, 0.004), r.range(-0.004, 0.004)});
            drift.push_back({0.09 + r.range(-0.01, 0.01), -0.04 + r.range(-0.01, 0.01)});
        }
        RestResult c = analyzeRest(clean), d = analyzeRest(drift);
        CHECK(c.valid && d.valid);
        CHECK(c.offsetRadius < 0.002); CHECK(c.maxRadius < 0.006);
        NEAR(d.offset.x, 0.09, 0.002); NEAR(d.offset.y, -0.04, 0.002);
        NEAR(d.offsetRadius, std::sqrt(0.09 * 0.09 + 0.04 * 0.04), 0.003);
        CHECK(d.noise > 0.005 && d.noise < 0.012);
        CHECK(!analyzeRest({{0, 0}}).valid);
    });

    run("release analysis finds settle points", [] {
        std::vector<TimedVec> s;
        double t = 0;
        const Vec2 settle[6] = {{0.03, 0.0}, {-0.02, 0.01}, {0.0, 0.06}, {0.01, -0.01}, {-0.04, -0.03}, {0.02, 0.02}};
        for (int k = 0; k < 6; ++k) {
            double ang = k * 1.1;
            for (int i = 0; i < 300; ++i, t += 0.001) s.push_back({t, {std::cos(ang) * 0.95, std::sin(ang) * 0.95}});
            for (int i = 0; i < 60; ++i, t += 0.001) { // snap back with a bounce
                double f = 1.0 - i / 60.0;
                s.push_back({t, {std::cos(ang) * 0.95 * f * std::cos(i * 0.3), std::sin(ang) * 0.95 * f}});
            }
            for (int i = 0; i < 700; ++i, t += 0.001) s.push_back({t, settle[k]});
        }
        ReleaseResult r = analyzeRelease(s);
        CHECK(r.valid); CHECK(r.settles == 6);
        NEAR(r.maxSettleRadius, 0.06, 0.004);
        std::vector<TimedVec> still;
        for (int i = 0; i < 3000; ++i) still.push_back({i * 0.001, {0.01, 0.0}});
        CHECK(analyzeRelease(still).settles == 0); // never deflected -> no events
    });

    run("range analysis: coverage, weak edge, circularity", [] {
        std::vector<Vec2> full, weak, half;
        for (int i = 0; i < 3600; ++i) {
            double a = i * 2 * kPi / 3600;
            full.push_back({std::cos(a), std::sin(a)});
            double rad = (a > 1.0 && a < 1.6) ? 0.86 : 1.0; // worn sector
            weak.push_back({std::cos(a) * rad, std::sin(a) * rad});
            if (i < 1800) half.push_back({std::cos(a), std::sin(a)});
        }
        RangeResult f = analyzeRange(full), w = analyzeRange(weak), h = analyzeRange(half);
        CHECK(f.valid); NEAR(f.coverage, 1.0, 1e-9); NEAR(f.minEdge, 1.0, 1e-6); NEAR(f.circularityErr, 0.0, 1e-4);
        CHECK(w.valid); NEAR(w.minEdge, 0.86, 1e-6); CHECK(w.circularityErr > 0.5);
        CHECK(!h.valid); NEAR(h.coverage, 0.5, 0.03);
        NEAR(f.extent[0], 1.0, 1e-6); NEAR(f.extent[3], 1.0, 1e-6);
    });

    run("stick report: verdicts and deadzone recommendations", [] {
        RestResult rest; rest.valid = true; rest.p999Radius = 0.012;
        ReleaseResult rel; rel.valid = true; rel.maxSettleRadius = 0.041;
        RangeResult range; range.valid = true; range.minEdge = 0.953;
        StickReport s = buildStickReport(rest, rel, range);
        CHECK(s.drift == DriftLevel::Normal);
        NEAR(s.worstCentre, 0.041, 1e-9);
        NEAR(s.recMin, 0.06, 1e-9);   // ceil(0.041 + 0.015 -> 0.056) = 0.06
        NEAR(s.recMax, 0.94, 1e-9);   // floor(0.953 - 0.01) = 0.94
        rel.maxSettleRadius = 0.004; rest.p999Radius = 0.003;
        s = buildStickReport(rest, rel, range);
        CHECK(s.drift == DriftLevel::Excellent); NEAR(s.recMin, 0.02, 1e-9);
        rel.maxSettleRadius = 0.2;
        s = buildStickReport(rest, rel, range);
        CHECK(s.drift == DriftLevel::Severe); NEAR(s.recMin, 0.22, 1e-9);
        // The recommended deadzone must always swallow the measured error.
        for (double w = 0.0; w < 0.25; w += 0.0037) {
            rel.maxSettleRadius = w; rest.p999Radius = 0;
            CHECK(buildStickReport(rest, rel, range).recMin > w);
        }
    });

    run("trigger analysis and report-rate estimate", [] {
        std::vector<double> tr;
        for (int i = 0; i < 2000; ++i) tr.push_back(0.02);
        for (int i = 0; i < 500; ++i) tr.push_back(1.0);
        TriggerResult t = analyzeTrigger(tr);
        CHECK(t.valid); NEAR(t.restMax, 0.02, 1e-9); NEAR(t.recDeadzone, 0.04, 1e-9); NEAR(t.pressMax, 1.0, 1e-9);
        std::vector<double> clean(2000, 0.0); clean.push_back(1.0);
        NEAR(analyzeTrigger(clean).recDeadzone, 0.0, 1e-9);
        std::vector<double> times;
        for (int i = 0; i < 200; ++i) times.push_back(i * 0.008);
        NEAR(estimateReportHz(times), 125.0, 0.5);
        CHECK(estimateReportHz({0.0, 0.008}) == 0.0);
    });

    run("calibration data round-trips through its file format", [] {
        CalibrationData c; c.valid = true; c.when = "2026-01-01 10:00"; c.reportHz = 124.5;
        RestResult rest; rest.valid = true; rest.offset = {0.02, -0.01}; rest.p999Radius = 0.03; rest.noise = 0.004;
        ReleaseResult rel; rel.valid = true; rel.settles = 9; rel.maxSettleRadius = 0.05;
        RangeResult range; range.valid = true; range.minEdge = 0.97; range.coverage = 1.0; range.bins[3] = 0.98;
        c.right = buildStickReport(rest, rel, range); c.left = c.right;
        c.lt.valid = true; c.lt.pressMax = 1.0; c.rt.valid = true; c.rt.recDeadzone = 0.03;
        CalibrationData d = CalibrationData::parse(c.serialize());
        CHECK(d.valid); CHECK(d.when == c.when); NEAR(d.reportHz, 124.5, 1e-6);
        NEAR(d.right.recMin, c.right.recMin, 1e-9); NEAR(d.right.recMax, c.right.recMax, 1e-9);
        CHECK(d.right.drift == c.right.drift); CHECK(d.right.release.settles == 9);
        NEAR(d.right.range.bins[3], 0.98, 1e-6); NEAR(d.rt.recDeadzone, 0.03, 1e-9);
    });

    Profile prof; prof.curve = CurveType::Linear;
    BenchConfig cfg = BenchConfig::quick();
    Bot skilled{0.25, 0.20, 0.02, 0.6, true};
    Bot sloppy{0.10, 0.45, 0.25, 1.6, false};
    BenchResult good, poor;

    run("benchmark runs to completion and scores a skilled player higher", [&] {
        good = playBot(skilled, prof, cfg);
        poor = playBot(sloppy, prof, cfg);
        CHECK(good.valid && poor.valid);
        CHECK(good.targets == cfg.flickTargets + cfg.adsTargets);
        CHECK(good.accuracy > 0.9); CHECK(good.accuracy <= 1.0);
        CHECK(poor.accuracy < good.accuracy);
        CHECK(good.trackOnTarget > 0.8); CHECK(poor.trackOnTarget < good.trackOnTarget);
        CHECK(good.medianReactionMs > 200 && good.medianReactionMs < 450); // 200 ms bot delay + travel
        CHECK(poor.medianReactionMs > good.medianReactionMs);
        CHECK(good.medianAcquireMs < poor.medianAcquireMs);
        CHECK(good.composite > poor.composite); CHECK(good.index > poor.index);
        CHECK(good.composite <= 100.0 && poor.composite >= 0.0);
        CHECK(good.strafeUptime > 0.9); CHECK(poor.strafeUptime < 0.05);
        CHECK(good.adsAccuracy > 0.9);
        std::printf("    skilled: acc %.0f%% track %.0f%% react %.0f ms hit %.0f ms composite %.1f index %.1f\n",
                    good.accuracy * 100, good.trackOnTarget * 100, good.medianReactionMs, good.medianAcquireMs, good.composite, good.index);
        std::printf("    sloppy:  acc %.0f%% track %.0f%% react %.0f ms hit %.0f ms composite %.1f index %.1f\n",
                    poor.accuracy * 100, poor.trackOnTarget * 100, poor.medianReactionMs, poor.medianAcquireMs, poor.composite, poor.index);
    });

    run("benchmark is deterministic for a given seed", [&] {
        BenchResult again = playBot(skilled, prof, cfg);
        NEAR(again.index, good.index, 1e-9); CHECK(again.shots == good.shots);
        BenchConfig other = cfg; other.seed = 7;
        BenchResult diff = playBot(skilled, prof, other);
        CHECK(std::fabs(diff.medianAcquireMs - good.medianAcquireMs) > 1e-6);
    });

    run("benchmark with no input: everything times out, score is zero", [&] {
        BenchmarkSession s(prof, cfg);
        int guard = 0;
        BenchInput idle; idle.dt = 0.004;
        while (!s.finished() && guard++ < 1000000) s.step(idle);
        const BenchResult& r = s.result();
        CHECK(s.finished()); CHECK(r.hits == 0); CHECK(r.timeouts == cfg.flickTargets + cfg.adsTargets);
        NEAR(r.accuracy, 0.0, 1e-12); NEAR(r.index, 0.0, 1e-12); NEAR(r.scoreAccuracy, 0.0, 1e-12);
        NEAR(r.scoreConsistency, 0.0, 1e-9); // failing consistently earns nothing
        NEAR(r.scoreReaction, 0.0, 1e-9); CHECK(r.composite < 1.0);
    });

    run("benchmark: ADS stage requires holding ADS; deadzone blocks drift", [&] {
        Bot noAds = skilled;
        BenchmarkSession s(prof, cfg);
        int guard = 0;
        while (!s.finished() && guard++ < 2000000) {
            BenchInput in = noAds.drive(s, 0.002);
            in.lt = 0.0; // never aim down sights
            s.step(in);
        }
        CHECK(s.result().adsAccuracy == 0.0);
        // Stick drift inside the deadzone must not move the view.
        Profile dz = prof; dz.rsMin = 0.10;
        BenchmarkSession d(dz, cfg);
        BenchInput in; in.dt = 0.004; in.rs = {0.08, 0.02};
        for (int i = 0; i < 500; ++i) d.step(in);
        NEAR(d.yaw(), 0.0, 1e-12);
        dz.rsMin = 0.02;
        BenchmarkSession e(dz, cfg);
        for (int i = 0; i < 500; ++i) e.step(in);
        CHECK(e.yaw() > 0.1);
    });

    run("history store round-trip and before/after comparison", [&] {
        auto path = (std::filesystem::temp_directory_path() / "wzaao_test_history.txt").u8string();
        HistoryStore h; h.setPath(path);
        RunRecord a; a.id = "001"; a.label = "Baseline"; a.profile = "P1"; a.r = poor; a.sensH = 6;
        RunRecord b; b.id = "002"; b.label = "Optimized"; b.profile = "P2"; b.r = good; b.simulated = true;
        h.add(a); h.add(b);
        CHECK(h.save());
        HistoryStore g; g.setPath(path);
        CHECK(g.load()); CHECK(g.runs().size() == 2);
        CHECK(g.find("002") && g.find("002")->simulated && g.find("002")->label == "Optimized");
        NEAR(g.find("001")->r.index, poor.index, poor.index * 1e-5 + 1e-9);
        auto deltas = compareRuns(poor, good);
        CHECK(!deltas.empty()); CHECK(deltas[0].name == "Aim Performance Index");
        NEAR(deltas[0].pct, (good.index - poor.index) / poor.index * 100.0, 1e-6);
        for (const auto& d : deltas) if (d.name == "Time to hit (median)") CHECK(d.pct > 0); // faster = positive
        NEAR(indexRatio(poor, good), good.index / poor.index, 1e-9);
        BenchResult same = compareRuns(good, good)[0].pct == 0 ? good : poor;
        NEAR(indexRatio(same, same), 1.0, 1e-12);
        CHECK(indexRatio(BenchResult(), good) == 0.0);
        CHECK(g.remove("001")); CHECK(g.runs().size() == 1); CHECK(!g.remove("nope"));
        std::error_code ec; std::filesystem::remove(std::filesystem::u8path(path), ec);
    });

    run("recommender uses calibration and benchmark evidence", [&] {
        Profile cur; cur.sensH = 8; cur.sensV = 8; cur.adsMult = 1.0;
        CalibrationData cal; cal.valid = true;
        RestResult rest; rest.valid = true; rest.p999Radius = 0.02;
        ReleaseResult rel; rel.valid = true; rel.settles = 8; rel.maxSettleRadius = 0.072;
        RangeResult range; range.valid = true; range.minEdge = 0.99;
        cal.right = buildStickReport(rest, rel, range);
        rel.maxSettleRadius = 0.01; cal.left = buildStickReport(rest, rel, range);
        cal.lt.valid = cal.rt.valid = true; cal.lt.pressMax = cal.rt.pressMax = 1.0; cal.rt.recDeadzone = 0.03;
        BenchResult b; b.valid = true; b.overshootRate = 0.5; b.adsAccuracy = 0.4; b.strafeUptime = 0.1; b.accuracy = 0.5;
        Recommendation rec = recommend(cur, &cal, &b);
        NEAR(rec.profile.rsMin, 0.09, 1e-9); NEAR(rec.profile.lsMin, 0.04, 1e-9);
        NEAR(rec.profile.rsMax, 0.98, 1e-9); NEAR(rec.profile.rtDz, 0.03, 1e-9);
        CHECK(rec.profile.sensH == 7);            // overshooting -> slower
        NEAR(rec.profile.adsMult, 0.90, 1e-9);    // weak ADS accuracy -> slower ADS
        CHECK(!rec.reasons.empty()); CHECK(!rec.warnings.empty()); CHECK(!rec.tips.empty());
        b.overshootRate = 0.05; b.saturation = 0.7; b.adsAccuracy = 0.8;
        rec = recommend(cur, &cal, &b);
        CHECK(rec.profile.sensH == 9);            // pinned stick, no overshoot -> faster
        cur.bias = -0.8;
        rec = recommend(cur, nullptr, nullptr);
        CHECK(rec.profile.curve == CurveType::Standard); CHECK(rec.profile.sensH == 4);
        NEAR(rec.profile.rsMin, cur.rsMin, 1e-9); // no calibration -> deadzone untouched
        CHECK(rec.profile.aimAssist);
    });

    std::printf("\n%d checks, %d failed\n", g_checks, g_fail);
    return g_fail == 0 ? 0 : 1;
}
