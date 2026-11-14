#include "History.h"
#include "KeyValue.h"

namespace wz {

static double pctImprove(double base, double cur, bool higherBetter) {
    if (std::fabs(base) < 1e-9) return 0.0;
    return (higherBetter ? (cur - base) : (base - cur)) / std::fabs(base) * 100.0;
}

std::vector<MetricDelta> compareRuns(const BenchResult& b, const BenchResult& c) {
    std::vector<MetricDelta> v;
    auto add = [&](const char* name, const char* unit, double base, double cur, bool hb, int dec) {
        MetricDelta d;
        d.name = name; d.unit = unit; d.base = base; d.cur = cur; d.higherBetter = hb; d.decimals = dec;
        d.pct = pctImprove(base, cur, hb);
        v.push_back(d);
    };
    add("Aim Performance Index", "", b.index, c.index, true, 1);
    add("Composite score", "/100", b.composite, c.composite, true, 1);
    add("Shot accuracy", "%", b.accuracy * 100, c.accuracy * 100, true, 1);
    add("Tracking time on target", "%", b.trackOnTarget * 100, c.trackOnTarget * 100, true, 1);
    add("Tracking mean error", "deg", b.trackMeanErrDeg, c.trackMeanErrDeg, false, 2);
    add("Reaction time (median)", "ms", b.medianReactionMs, c.medianReactionMs, false, 0);
    add("Time to hit (median)", "ms", b.medianAcquireMs, c.medianAcquireMs, false, 0);
    add("Consistency score", "/100", b.scoreConsistency, c.scoreConsistency, true, 1);
    add("ADS accuracy", "%", b.adsAccuracy * 100, c.adsAccuracy * 100, true, 1);
    add("ADS time to hit (median)", "ms", b.adsMedianAcquireMs, c.adsMedianAcquireMs, false, 0);
    add("Overshoot rate", "%", b.overshootRate * 100, c.overshootRate * 100, false, 1);
    return v;
}

double indexRatio(const BenchResult& base, const BenchResult& cur) {
    if (!base.valid || base.index < 1e-9) return 0.0;
    return cur.index / base.index;
}

static KeyValue toKv(const RunRecord& x) {
    KeyValue k;
    k.set("id", x.id); k.set("when", x.when); k.set("profile", x.profile); k.set("label", x.label);
    k.setInt("simulated", x.simulated); k.setInt("quick", x.quick);
    k.setInt("sensH", x.sensH); k.setInt("sensV", x.sensV); k.setNum("adsMult", x.adsMult);
    k.setNum("rsMin", x.rsMin); k.setInt("curve", x.curve);
    const BenchResult& r = x.r;
    k.setInt("shots", r.shots); k.setInt("hits", r.hits); k.setInt("targets", r.targets); k.setInt("timeouts", r.timeouts);
    k.setNum("accuracy", r.accuracy); k.setNum("reactMs", r.medianReactionMs); k.setNum("acquireMs", r.medianAcquireMs);
    k.setNum("acquireCv", r.acquireCv); k.setNum("trackOn", r.trackOnTarget); k.setNum("trackErr", r.trackMeanErrDeg);
    k.setNum("trackStd", r.trackWindowStd); k.setNum("overshoot", r.overshootRate); k.setNum("saturation", r.saturation);
    k.setNum("strafe", r.strafeUptime); k.setNum("adsAcc", r.adsAccuracy); k.setNum("adsAcquireMs", r.adsMedianAcquireMs);
    k.setNum("sAcc", r.scoreAccuracy); k.setNum("sTrack", r.scoreTracking); k.setNum("sReact", r.scoreReaction);
    k.setNum("sCons", r.scoreConsistency); k.setNum("composite", r.composite); k.setNum("index", r.index);
    k.setNum("duration", r.durationSec);
    return k;
}

static RunRecord fromKv(const KeyValue& k) {
    RunRecord x;
    x.id = k.get("id"); x.when = k.get("when"); x.profile = k.get("profile"); x.label = k.get("label");
    x.simulated = k.getInt("simulated") != 0; x.quick = k.getInt("quick") != 0;
    x.sensH = (int)k.getInt("sensH"); x.sensV = (int)k.getInt("sensV"); x.adsMult = k.getNum("adsMult");
    x.rsMin = k.getNum("rsMin"); x.curve = (int)k.getInt("curve");
    BenchResult& r = x.r;
    r.valid = true;
    r.shots = (int)k.getInt("shots"); r.hits = (int)k.getInt("hits"); r.targets = (int)k.getInt("targets"); r.timeouts = (int)k.getInt("timeouts");
    r.accuracy = k.getNum("accuracy"); r.medianReactionMs = k.getNum("reactMs"); r.medianAcquireMs = k.getNum("acquireMs");
    r.acquireCv = k.getNum("acquireCv"); r.trackOnTarget = k.getNum("trackOn"); r.trackMeanErrDeg = k.getNum("trackErr");
    r.trackWindowStd = k.getNum("trackStd"); r.overshootRate = k.getNum("overshoot"); r.saturation = k.getNum("saturation");
    r.strafeUptime = k.getNum("strafe"); r.adsAccuracy = k.getNum("adsAcc"); r.adsMedianAcquireMs = k.getNum("adsAcquireMs");
    r.scoreAccuracy = k.getNum("sAcc"); r.scoreTracking = k.getNum("sTrack"); r.scoreReaction = k.getNum("sReact");
    r.scoreConsistency = k.getNum("sCons"); r.composite = k.getNum("composite"); r.index = k.getNum("index");
    r.durationSec = k.getNum("duration");
    return x;
}

bool HistoryStore::load() {
    runs_.clear();
    std::string text;
    if (!readFile(path_, text)) return false;
    for (const auto& k : KeyValue::parseRecords(text))
        if (!k.get("id").empty()) runs_.push_back(fromKv(k));
    return true;
}

bool HistoryStore::save() const {
    std::vector<KeyValue> recs;
    for (const auto& r : runs_) recs.push_back(toKv(r));
    return writeFile(path_, KeyValue::serializeRecords(recs));
}

bool HistoryStore::remove(const std::string& id) {
    for (size_t i = 0; i < runs_.size(); ++i)
        if (runs_[i].id == id) { runs_.erase(runs_.begin() + (long)i); return true; }
    return false;
}

const RunRecord* HistoryStore::find(const std::string& id) const {
    for (const auto& r : runs_) if (r.id == id) return &r;
    return nullptr;
}

} // namespace wz
