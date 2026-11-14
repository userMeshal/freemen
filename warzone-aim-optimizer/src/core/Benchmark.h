// Built-in aim benchmark. Pure simulation: it is stepped with controller
// input and has no rendering, so it can be unit-tested headlessly.
#pragma once
#include "Profile.h"
#include "Rng.h"
#include <vector>

namespace wz {

constexpr double kAdsZoom = 1.5;          // trainer zoom factor while aiming down sights
constexpr double kDegPerSecPerSens = 30.0; // trainer model: sens 6 = 180 deg/s at full stick

enum class Stage { Countdown, Flick, Break1, Tracking, Break2, Ads, Done };
const char* stageName(Stage s);

struct BenchConfig {
    uint32_t seed = 20240917;
    int flickTargets = 16;
    double trackSeconds = 30.0;
    int adsTargets = 10;
    double targetTimeout = 4.0;
    static BenchConfig quick() { BenchConfig c; c.flickTargets = 8; c.trackSeconds = 15.0; c.adsTargets = 6; return c; }
};

struct BenchInput {
    double dt = 0.0;
    Vec2 ls, rs;       // raw sticks
    double lt = 0.0, rt = 0.0;
};

struct BenchResult {
    bool valid = false;
    int shots = 0, hits = 0, targets = 0, timeouts = 0;
    double accuracy = 0;            // hits / (shots + timeouts), 0..1
    double medianReactionMs = 0;    // target appears -> aim starts closing in
    double medianAcquireMs = 0;     // target appears -> hit
    double acquireCv = 0;           // coefficient of variation of acquire times
    double trackOnTarget = 0;       // fraction of tracking time on target
    double trackMeanErrDeg = 0;
    double trackWindowStd = 0;      // spread of per-second on-target fraction
    double overshootRate = 0;       // fraction of targets the crosshair swung past
    double saturation = 0;          // fraction of flick time with the stick pinned
    double strafeUptime = 0;        // fraction of tracking time with left stick active
    double adsAccuracy = 0;
    double adsMedianAcquireMs = 0;
    double scoreAccuracy = 0, scoreTracking = 0, scoreReaction = 0, scoreConsistency = 0;
    double composite = 0;           // 0..100 weighted score
    double index = 0;               // unbounded Aim Performance Index
    double durationSec = 0;
};

struct BenchTarget {
    bool active = false;
    double yaw = 0, pitch = 0, radius = 1.0;
    double spawnT = 0;
};

class BenchmarkSession {
public:
    BenchmarkSession(const Profile& p, const BenchConfig& c);

    void step(const BenchInput& in);

    Stage stage() const { return stage_; }
    bool finished() const { return stage_ == Stage::Done; }
    const BenchResult& result() const { return result_; }

    // View state for rendering.
    double yaw() const { return yaw_; }
    double pitch() const { return pitch_; }
    double zoomBlend() const { return zoomBlend_; }
    const BenchTarget& target() const { return target_; }
    bool onTarget() const { return onTarget_; }
    double time() const { return t_; }
    double stageTime() const { return stageT_; }
    double stageProgress() const;       // 0..1 within the current stage
    double overallProgress() const;     // 0..1 across the whole run
    int shots() const { return shots_; }
    int hits() const { return hits_; }
    double lastShotT() const { return lastShotT_; }
    bool lastShotHit() const { return lastShotHit_; }
    double liveTrackFraction() const { return trackTime_ > 0 ? trackOn_ / trackTime_ : 0.0; }

private:
    struct TargetRec {
        bool hit = false, reacted = false, overshot = false, ads = false;
        double reactionMs = 0, acquireMs = 0;
    };

    void enter(Stage s);
    void spawnGalleryTarget(bool ads);
    void stepGallery(const BenchInput& in, bool fired, bool ads, int count);
    void stepTracking(const BenchInput& in, const Vec2& move);
    void finalize();

    Profile prof_;
    BenchConfig cfg_;
    Rng rng_;
    Stage stage_ = Stage::Countdown;
    double t_ = 0, stageT_ = 0;
    double yaw_ = 0, pitch_ = 0, zoomBlend_ = 0;
    bool triggerArmed_ = true;

    BenchTarget target_;
    bool onTarget_ = false;
    double spawnDelay_ = 0.6;
    int done_ = 0;
    TargetRec cur_;
    double initDist_ = 0;
    Vec2 dir0_;
    std::vector<TargetRec> recs_;

    int shots_ = 0, hits_ = 0, timeouts_ = 0;
    double lastShotT_ = -10; bool lastShotHit_ = false;
    double activeTime_ = 0, satTime_ = 0;

    // tracking
    double trackVel_ = 0, trackWant_ = 0, trackChange_ = 0, trackPhase_ = 0, trackBasePitch_ = 0;
    double trackTime_ = 0, trackOn_ = 0, trackErrSum_ = 0, strafeTime_ = 0;
    double winTime_ = 0, winOn_ = 0;
    std::vector<double> windows_;

    BenchResult result_;
};

} // namespace wz
