#include "StickAnalysis.h"
#include "KeyValue.h"

#include <cstdio>
#include <cstdlib>
#include <numeric>

namespace wz {

double mean(const std::vector<double>& v) {
    if (v.empty()) return 0.0;
    return std::accumulate(v.begin(), v.end(), 0.0) / (double)v.size();
}

double stddev(const std::vector<double>& v) {
    if (v.size() < 2) return 0.0;
    double m = mean(v), s = 0.0;
    for (double x : v) s += (x - m) * (x - m);
    return std::sqrt(s / (double)(v.size() - 1));
}

double percentile(std::vector<double> v, double p) {
    if (v.empty()) return 0.0;
    std::sort(v.begin(), v.end());
    double idx = clampd(p, 0.0, 1.0) * (double)(v.size() - 1);
    size_t lo = (size_t)std::floor(idx), hi = (size_t)std::ceil(idx);
    return lerpd(v[lo], v[hi], idx - (double)lo);
}

double median(std::vector<double> v) { return percentile(std::move(v), 0.5); }

const char* driftLevelName(DriftLevel l) {
    switch (l) {
        case DriftLevel::Excellent:  return "Excellent";
        case DriftLevel::Normal:     return "Normal";
        case DriftLevel::Noticeable: return "Noticeable drift";
        case DriftLevel::Severe:     return "Severe drift";
    }
    return "";
}

RestResult analyzeRest(const std::vector<Vec2>& s) {
    RestResult r;
    r.samples = (int)s.size();
    if (s.size() < 50) return r;
    Vec2 sum;
    for (const auto& v : s) sum = sum + v;
    r.offset = sum * (1.0 / (double)s.size());
    r.offsetRadius = r.offset.len();
    double var = 0.0;
    std::vector<double> radii;
    radii.reserve(s.size());
    for (const auto& v : s) {
        Vec2 d = v - r.offset;
        var += d.x * d.x + d.y * d.y;
        radii.push_back(v.len());
    }
    r.noise = std::sqrt(var / (double)s.size());
    r.maxRadius = *std::max_element(radii.begin(), radii.end());
    r.p999Radius = percentile(radii, 0.999);
    r.valid = true;
    return r;
}

ReleaseResult analyzeRelease(const std::vector<TimedVec>& s) {
    // A "settle" is the stick sitting still (within a 0.02 box for 250 ms)
    // near the centre after having been pushed past 60% deflection.
    ReleaseResult r;
    const double kWindow = 0.25, kBox = 0.02;
    bool deflected = false;
    double sumRadius = 0.0;
    for (size_t i = 0; i < s.size(); ++i) {
        double rad = s[i].v.len();
        if (rad > 0.6) { deflected = true; continue; }
        if (!deflected || rad > 0.3) continue;
        double minX = s[i].v.x, maxX = minX, minY = s[i].v.y, maxY = minY;
        Vec2 acc; int n = 0; bool full = false;
        for (size_t j = i + 1; j-- > 0;) {
            if (s[i].t - s[j].t > kWindow) { full = true; break; }
            minX = std::min(minX, s[j].v.x); maxX = std::max(maxX, s[j].v.x);
            minY = std::min(minY, s[j].v.y); maxY = std::max(maxY, s[j].v.y);
            acc = acc + s[j].v; ++n;
        }
        if (!full || n < 5 || maxX - minX > kBox || maxY - minY > kBox) continue;
        Vec2 p = acc * (1.0 / n);
        r.points.push_back(p);
        r.maxSettleRadius = std::max(r.maxSettleRadius, p.len());
        sumRadius += p.len();
        deflected = false;
    }
    r.settles = (int)r.points.size();
    if (r.settles > 0) r.meanSettleRadius = sumRadius / r.settles;
    r.valid = r.settles >= 4;
    return r;
}

RangeResult analyzeRange(const std::vector<Vec2>& s) {
    RangeResult r;
    for (const auto& v : s) {
        double rad = v.len();
        r.extent[0] = std::max(r.extent[0], v.x);
        r.extent[1] = std::max(r.extent[1], -v.x);
        r.extent[2] = std::max(r.extent[2], v.y);
        r.extent[3] = std::max(r.extent[3], -v.y);
        if (rad < 0.5) continue;
        double a = std::atan2(v.y, v.x);
        if (a < 0) a += 2.0 * kPi;
        int bin = (int)(a / (2.0 * kPi) * kAngleBins) % kAngleBins;
        r.bins[bin] = std::max(r.bins[bin], rad);
    }
    int covered = 0;
    double sum = 0.0, err = 0.0;
    r.minEdge = 1e9; r.maxEdge = 0.0;
    for (int i = 0; i < kAngleBins; ++i) {
        if (r.bins[i] <= 0.0) continue;
        ++covered;
        sum += r.bins[i];
        err += std::fabs(r.bins[i] - 1.0);
        r.minEdge = std::min(r.minEdge, r.bins[i]);
        r.maxEdge = std::max(r.maxEdge, r.bins[i]);
    }
    r.coverage = (double)covered / kAngleBins;
    if (covered > 0) {
        r.avgEdge = sum / covered;
        r.circularityErr = err / covered * 100.0;
    } else {
        r.minEdge = 0.0;
    }
    r.valid = r.coverage >= 0.9;
    return r;
}

TriggerResult analyzeTrigger(const std::vector<double>& s) {
    TriggerResult r;
    if (s.size() < 50) return r;
    r.pressMax = *std::max_element(s.begin(), s.end());
    // Released samples are the cluster near the minimum.
    std::vector<double> low;
    double mn = *std::min_element(s.begin(), s.end());
    for (double v : s) if (v <= mn + 0.15) low.push_back(v);
    r.restMax = percentile(low, 0.995);
    r.recDeadzone = r.restMax < 0.005 ? 0.0 : clampd(std::ceil((r.restMax + 0.02) * 100.0) / 100.0, 0.0, 0.5);
    r.valid = r.pressMax > 0.5;
    return r;
}

StickReport buildStickReport(const RestResult& rest, const ReleaseResult& rel, const RangeResult& range) {
    StickReport rep;
    rep.rest = rest; rep.release = rel; rep.range = range;
    double worst = 0.0;
    if (rest.valid) worst = std::max(worst, rest.p999Radius);
    if (rel.valid) worst = std::max(worst, rel.maxSettleRadius);
    rep.worstCentre = worst;

    if (worst < 0.03) rep.drift = DriftLevel::Excellent;
    else if (worst < 0.07) rep.drift = DriftLevel::Normal;
    else if (worst < 0.13) rep.drift = DriftLevel::Noticeable;
    else rep.drift = DriftLevel::Severe;

    // Smallest deadzone that still swallows every centre error we measured,
    // plus a safety margin, rounded up to the 0.01 step the game menu uses.
    double rec = std::ceil((worst + 0.015) * 100.0 - 1e-9) / 100.0;
    rep.recMin = clampd(rec, 0.02, 0.30);

    // Max deadzone: the stick must be able to reach "full" in every direction.
    if (range.valid) {
        double m = std::floor((range.minEdge - 0.01) * 100.0 + 1e-9) / 100.0;
        rep.recMax = clampd(m, 0.80, 0.99);
    } else {
        rep.recMax = 0.99;
    }
    return rep;
}

double estimateReportHz(const std::vector<double>& t) {
    std::vector<double> iv;
    for (size_t i = 1; i < t.size(); ++i) {
        double d = t[i] - t[i - 1];
        if (d > 0.0 && d < 0.05) iv.push_back(d);
    }
    if (iv.size() < 20) return 0.0;
    double m = median(iv);
    return m > 0.0 ? 1.0 / m : 0.0;
}

static void putStick(KeyValue& kv, const std::string& p, const StickReport& s) {
    kv.setInt(p + "restValid", s.rest.valid); kv.setNum(p + "offX", s.rest.offset.x);
    kv.setNum(p + "offY", s.rest.offset.y); kv.setNum(p + "noise", s.rest.noise);
    kv.setNum(p + "restMax", s.rest.maxRadius); kv.setNum(p + "restP999", s.rest.p999Radius);
    kv.setInt(p + "relValid", s.release.valid); kv.setInt(p + "settles", s.release.settles);
    kv.setNum(p + "settleMax", s.release.maxSettleRadius); kv.setNum(p + "settleMean", s.release.meanSettleRadius);
    kv.setInt(p + "rangeValid", s.range.valid); kv.setNum(p + "coverage", s.range.coverage);
    kv.setNum(p + "minEdge", s.range.minEdge); kv.setNum(p + "maxEdge", s.range.maxEdge);
    kv.setNum(p + "avgEdge", s.range.avgEdge); kv.setNum(p + "circ", s.range.circularityErr);
    for (int i = 0; i < 4; ++i) kv.setNum(p + "ext" + std::to_string(i), s.range.extent[i]);
    std::string bins;
    for (int i = 0; i < kAngleBins; ++i) { char b[16]; std::snprintf(b, sizeof(b), "%.3f,", s.range.bins[i]); bins += b; }
    kv.set(p + "bins", bins);
}

static StickReport getStick(const KeyValue& kv, const std::string& p) {
    RestResult rest; ReleaseResult rel; RangeResult range;
    rest.valid = kv.getInt(p + "restValid") != 0;
    rest.offset = {kv.getNum(p + "offX"), kv.getNum(p + "offY")};
    rest.offsetRadius = rest.offset.len();
    rest.noise = kv.getNum(p + "noise"); rest.maxRadius = kv.getNum(p + "restMax");
    rest.p999Radius = kv.getNum(p + "restP999");
    rel.valid = kv.getInt(p + "relValid") != 0; rel.settles = (int)kv.getInt(p + "settles");
    rel.maxSettleRadius = kv.getNum(p + "settleMax"); rel.meanSettleRadius = kv.getNum(p + "settleMean");
    range.valid = kv.getInt(p + "rangeValid") != 0; range.coverage = kv.getNum(p + "coverage");
    range.minEdge = kv.getNum(p + "minEdge"); range.maxEdge = kv.getNum(p + "maxEdge");
    range.avgEdge = kv.getNum(p + "avgEdge"); range.circularityErr = kv.getNum(p + "circ");
    for (int i = 0; i < 4; ++i) range.extent[i] = kv.getNum(p + "ext" + std::to_string(i));
    std::string bins = kv.get(p + "bins");
    size_t pos = 0;
    for (int i = 0; i < kAngleBins && pos < bins.size(); ++i) {
        size_t c = bins.find(',', pos);
        if (c == std::string::npos) break;
        range.bins[i] = std::atof(bins.substr(pos, c - pos).c_str());
        pos = c + 1;
    }
    return buildStickReport(rest, rel, range);
}

std::string CalibrationData::serialize() const {
    KeyValue kv;
    kv.set("format", "wzcal-1");
    kv.setInt("valid", valid);
    kv.set("when", when);
    kv.setNum("reportHz", reportHz);
    putStick(kv, "L.", left);
    putStick(kv, "R.", right);
    kv.setInt("lt.valid", lt.valid); kv.setNum("lt.rest", lt.restMax); kv.setNum("lt.press", lt.pressMax); kv.setNum("lt.rec", lt.recDeadzone);
    kv.setInt("rt.valid", rt.valid); kv.setNum("rt.rest", rt.restMax); kv.setNum("rt.press", rt.pressMax); kv.setNum("rt.rec", rt.recDeadzone);
    return kv.serialize();
}

CalibrationData CalibrationData::parse(const std::string& text) {
    KeyValue kv = KeyValue::parse(text);
    CalibrationData c;
    c.valid = kv.getInt("valid") != 0;
    c.when = kv.get("when");
    c.reportHz = kv.getNum("reportHz");
    c.left = getStick(kv, "L.");
    c.right = getStick(kv, "R.");
    c.lt.valid = kv.getInt("lt.valid") != 0; c.lt.restMax = kv.getNum("lt.rest"); c.lt.pressMax = kv.getNum("lt.press"); c.lt.recDeadzone = kv.getNum("lt.rec");
    c.rt.valid = kv.getInt("rt.valid") != 0; c.rt.restMax = kv.getNum("rt.rest"); c.rt.pressMax = kv.getNum("rt.press"); c.rt.recDeadzone = kv.getNum("rt.rec");
    return c;
}

} // namespace wz
