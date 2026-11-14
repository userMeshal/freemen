// Stick / trigger hardware analysis: drift, centring, range, circularity.
#pragma once
#include "Types.h"
#include <string>
#include <vector>

namespace wz {

constexpr int kAngleBins = 72; // 5 degree bins

struct RestResult {
    bool valid = false;
    int samples = 0;
    Vec2 offset;              // mean resting position
    double offsetRadius = 0;  // |offset|
    double noise = 0;         // RMS deviation around the mean
    double maxRadius = 0;     // furthest resting sample from true centre
    double p999Radius = 0;
};

struct ReleaseResult {
    bool valid = false;
    int settles = 0;          // number of flick-and-release events detected
    double maxSettleRadius = 0;
    double meanSettleRadius = 0;
    std::vector<Vec2> points; // where the stick came to rest each time
};

struct RangeResult {
    bool valid = false;
    double coverage = 0;      // fraction of angle bins swept at the edge
    double minEdge = 0, maxEdge = 0, avgEdge = 0;
    double circularityErr = 0; // mean |edge radius - 1| in percent
    double extent[4] = {0, 0, 0, 0}; // +X, -X, +Y, -Y
    double bins[kAngleBins] = {0};
};

struct TriggerResult {
    bool valid = false;
    double restMax = 0;       // highest value seen while released
    double pressMax = 0;      // highest value seen while pressed
    double recDeadzone = 0;
};

enum class DriftLevel { Excellent, Normal, Noticeable, Severe };
const char* driftLevelName(DriftLevel l);

struct StickReport {
    RestResult rest;
    ReleaseResult release;
    RangeResult range;
    DriftLevel drift = DriftLevel::Excellent;
    double worstCentre = 0;   // largest centre error from rest + release tests
    double recMin = 0.05;     // recommended Warzone Min deadzone
    double recMax = 0.99;     // recommended Warzone Max deadzone
};

struct CalibrationData {
    bool valid = false;
    StickReport left, right;
    TriggerResult lt, rt;
    double reportHz = 0;
    std::string when;

    std::string serialize() const;
    static CalibrationData parse(const std::string& text);
};

RestResult analyzeRest(const std::vector<Vec2>& samples);
ReleaseResult analyzeRelease(const std::vector<TimedVec>& samples);
RangeResult analyzeRange(const std::vector<Vec2>& samples);
TriggerResult analyzeTrigger(const std::vector<double>& samples);

// Combines the three stick tests into a verdict and deadzone recommendations.
StickReport buildStickReport(const RestResult& rest, const ReleaseResult& rel, const RangeResult& range);

// Estimates the controller report rate from timestamps at which the XInput
// packet number changed. Returns 0 if there is not enough data.
double estimateReportHz(const std::vector<double>& packetChangeTimes);

} // namespace wz
