#pragma once
#include "Benchmark.h"
#include <string>
#include <vector>

namespace wz {

struct RunRecord {
    std::string id;        // unique, sortable (timestamp based)
    std::string when;      // human readable local time
    std::string profile;
    std::string label;     // "Baseline", "Optimized", "Practice"
    bool simulated = false;
    bool quick = false;
    int sensH = 0, sensV = 0;
    double adsMult = 0, rsMin = 0;
    int curve = 0;
    BenchResult r;
};

struct MetricDelta {
    std::string name, unit;
    double base = 0, cur = 0;
    double pct = 0;        // positive = better
    bool higherBetter = true;
    int decimals = 1;
};

std::vector<MetricDelta> compareRuns(const BenchResult& base, const BenchResult& cur);
// cur.index / base.index (1.0 = unchanged, 2.0 = the 2x goal). 0 if no baseline.
double indexRatio(const BenchResult& base, const BenchResult& cur);

class HistoryStore {
public:
    void setPath(const std::string& p) { path_ = p; }
    bool load();
    bool save() const;
    void add(const RunRecord& r) { runs_.push_back(r); }
    bool remove(const std::string& id);
    const RunRecord* find(const std::string& id) const;
    const std::vector<RunRecord>& runs() const { return runs_; }
private:
    std::string path_;
    std::vector<RunRecord> runs_;
};

} // namespace wz
