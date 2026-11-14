#include "Benchmark.h"

namespace wz {

namespace {
constexpr double kCountdown = 3.0, kBreak = 3.5;
constexpr double kFlickRadius = 1.8, kAdsRadius = 0.85, kTrackRadius = 2.2;
constexpr double kStrafeSpeed = 4.5;       // metres per second at full left stick
constexpr double kFlickDistM = 18.0, kTrackDistM = 22.0, kAdsDistM = 45.0;
constexpr double kTrackGrace = 1.0;        // seconds before tracking is scored

double map01(double v, double best, double worst) {
    // 1 at 'best', 0 at 'worst', linear in between.
    return clampd((worst - v) / (worst - best), 0.0, 1.0);
}
} // namespace

double aimAssistRadius(double targetRadius) { return targetRadius * 3.0 + 6.0; }

Vec2 aimAssist(double strength, Vec2 toTarget, double radius, double moveMag, double dt, double& slowFactor) {
    slowFactor = 1.0;
    if (strength <= 0.0 || radius <= 0.0 || dt <= 0.0) return {};
    double dist = toTarget.len();
    if (dist >= radius || dist < 1e-9) return {};
    double fall = 1.0 - dist / radius;        // 1 at the centre, 0 at the edge
    // Slowdown: the closer the crosshair sits to the target, the more the
    // player's own aim is damped. Capped so very high strength never freezes.
    slowFactor = clampd(1.0 - 0.30 * strength * fall, 0.10, 1.0);
    // Rotational assist: while the player is moving (strafing), the view is
    // pulled toward the target. Never steps past the target.
    double pullRate = 22.0 * strength * fall * clampd(moveMag, 0.0, 1.0); // deg/s
    double step = std::min(pullRate * dt, dist);
    return toTarget * (step / dist);
}

const char* stageName(Stage s) {
    switch (s) {
        case Stage::Countdown: return "Get ready";
        case Stage::Flick:     return "Stage 1 - Flick & fire";
        case Stage::Break1:    return "Next: tracking";
        case Stage::Tracking:  return "Stage 2 - Tracking";
        case Stage::Break2:    return "Next: ADS precision";
        case Stage::Ads:       return "Stage 3 - ADS precision";
        case Stage::Done:      return "Complete";
    }
    return "";
}

BenchmarkSession::BenchmarkSession(const Profile& p, const BenchConfig& c)
    : prof_(p), cfg_(c), rng_(c.seed) {
    prof_.sanitize();
}

void BenchmarkSession::enter(Stage s) {
    stage_ = s;
    stageT_ = 0;
    target_.active = false;
    onTarget_ = false;
    done_ = 0;
    spawnDelay_ = 0.6;
    if (s == Stage::Tracking) {
        target_.active = true;
        target_.radius = kTrackRadius;
        target_.yaw = yaw_ + 9.0;
        trackBasePitch_ = clampd(pitch_, -10.0, 10.0);
        target_.pitch = trackBasePitch_;
        target_.spawnT = t_;
        trackVel_ = 0; trackWant_ = 18.0; trackChange_ = 1.0; trackPhase_ = 0;
    }
    if (s == Stage::Done) finalize();
}

double BenchmarkSession::stageProgress() const {
    switch (stage_) {
        case Stage::Countdown: return clampd(stageT_ / kCountdown, 0, 1);
        case Stage::Flick:     return cfg_.flickTargets > 0 ? (double)done_ / cfg_.flickTargets : 1.0;
        case Stage::Break1:
        case Stage::Break2:    return clampd(stageT_ / kBreak, 0, 1);
        case Stage::Tracking:  return clampd(stageT_ / cfg_.trackSeconds, 0, 1);
        case Stage::Ads:       return cfg_.adsTargets > 0 ? (double)done_ / cfg_.adsTargets : 1.0;
        case Stage::Done:      return 1.0;
    }
    return 0.0;
}

double BenchmarkSession::overallProgress() const {
    double p = stageProgress();
    switch (stage_) {
        case Stage::Countdown: return 0.0;
        case Stage::Flick:     return 0.40 * p;
        case Stage::Break1:    return 0.40;
        case Stage::Tracking:  return 0.40 + 0.35 * p;
        case Stage::Break2:    return 0.75;
        case Stage::Ads:       return 0.75 + 0.25 * p;
        case Stage::Done:      return 1.0;
    }
    return 0.0;
}

void BenchmarkSession::spawnGalleryTarget(bool ads) {
    double dist = ads ? rng_.range(3.0, 11.0) : rng_.range(10.0, 38.0);
    double ang = rng_.range(0.0, 2.0 * kPi);
    double dy = dist * std::cos(ang);
    double dp = dist * std::sin(ang) * 0.45; // mostly horizontal, like real fights
    double pitch = clampd(pitch_ + dp, -22.0, 22.0);
    target_.active = true;
    target_.yaw = yaw_ + dy;
    target_.pitch = pitch;
    target_.radius = ads ? kAdsRadius : kFlickRadius;
    target_.spawnT = t_;
    cur_ = TargetRec();
    cur_.ads = ads;
    Vec2 d(target_.yaw - yaw_, target_.pitch - pitch_);
    initDist_ = d.len();
    dir0_ = initDist_ > 1e-6 ? d * (1.0 / initDist_) : Vec2(1, 0);
}

void BenchmarkSession::stepGallery(const BenchInput& in, bool fired, bool ads, int count) {
    if (!target_.active) {
        onTarget_ = false;
        if (done_ >= count) { enter(ads ? Stage::Done : Stage::Break1); return; }
        spawnDelay_ -= in.dt;
        if (spawnDelay_ <= 0.0) spawnGalleryTarget(ads);
        return;
    }
    activeTime_ += in.dt;
    if (in.rs.len() >= 0.97) satTime_ += in.dt;

    Vec2 d(target_.yaw - yaw_, target_.pitch - pitch_);
    double dist = d.len();
    onTarget_ = dist <= target_.radius;

    if (!cur_.reacted && dist < initDist_ - std::max(1.0, 0.08 * initDist_)) {
        cur_.reacted = true;
        cur_.reactionMs = (t_ - target_.spawnT) * 1000.0;
    }
    double along = d.x * dir0_.x + d.y * dir0_.y;
    if (!cur_.overshot && along < -target_.radius * 1.5) cur_.overshot = true;

    bool finishedTarget = false;
    if (fired) {
        ++shots_;
        bool ok = onTarget_ && (!ads || zoomBlend_ > 0.5);
        lastShotT_ = t_;
        lastShotHit_ = ok;
        if (ok) {
            ++hits_;
            cur_.hit = true;
            cur_.acquireMs = (t_ - target_.spawnT) * 1000.0;
            if (!cur_.reacted) { cur_.reacted = true; cur_.reactionMs = cur_.acquireMs; }
            finishedTarget = true;
        }
    }
    if (!finishedTarget && t_ - target_.spawnT > cfg_.targetTimeout) {
        ++timeouts_;
        finishedTarget = true;
    }
    if (finishedTarget) {
        recs_.push_back(cur_);
        target_.active = false;
        ++done_;
        spawnDelay_ = rng_.range(0.45, 1.0); // unpredictable so reaction is honest
    }
}

void BenchmarkSession::stepTracking(const BenchInput& in, const Vec2& move) {
    double dt = in.dt;
    // Target strafes with randomized speed and direction changes.
    trackChange_ -= dt;
    if (trackChange_ <= 0.0) {
        double speed = rng_.range(12.0, 32.0);
        double dir = trackWant_ >= 0 ? 1.0 : -1.0;
        if (rng_.chance(0.6)) dir = -dir;
        trackWant_ = dir * speed;
        trackChange_ = rng_.range(0.5, 1.5);
    }
    trackVel_ += (trackWant_ - trackVel_) * clampd(6.0 * dt, 0.0, 1.0);
    trackPhase_ += dt;
    target_.yaw += trackVel_ * dt;
    target_.pitch = trackBasePitch_ + 3.0 * std::sin(trackPhase_ * 0.9);

    Vec2 d(target_.yaw - yaw_, target_.pitch - pitch_);
    double dist = d.len();
    onTarget_ = dist <= target_.radius;

    if (stageT_ >= kTrackGrace) {
        trackTime_ += dt;
        trackErrSum_ += dist * dt;
        if (onTarget_) trackOn_ += dt;
        if (move.len() > 0.2) strafeTime_ += dt;
        winTime_ += dt;
        if (onTarget_) winOn_ += dt;
        if (winTime_ >= 1.0) {
            windows_.push_back(winOn_ / winTime_);
            winTime_ = 0; winOn_ = 0;
        }
    }
    if (stageT_ >= cfg_.trackSeconds) enter(Stage::Break2);
}

void BenchmarkSession::step(const BenchInput& in) {
    if (stage_ == Stage::Done) return;
    double dt = clampd(in.dt, 0.0, 0.05);
    if (dt <= 0.0) return;
    BenchInput inp = in;
    inp.dt = dt;
    t_ += dt;
    stageT_ += dt;

    Vec2 aim = processStick(in.rs, prof_.rightTuning());
    Vec2 move = processStick(in.ls, prof_.leftTuning());
    double lt = processTrigger(in.lt, prof_.ltDz);
    double rt = processTrigger(in.rt, prof_.rtDz);

    // ADS: zoom eases in; when the sensitivity changes depends on the
    // "ADS Sensitivity Transition Timing" setting.
    bool wantAds = lt > 0.5;
    double zs = dt / 0.18;
    zoomBlend_ = clampd(zoomBlend_ + (wantAds ? zs : -zs), 0.0, 1.0);
    double sensBlend = zoomBlend_;
    if (prof_.adsTransition == 0) sensBlend = wantAds ? 1.0 : 0.0;
    else if (prof_.adsTransition == 2) sensBlend = zoomBlend_ >= 1.0 ? 1.0 : 0.0;
    double scale = lerpd(1.0, prof_.adsMult / kAdsZoom, sensBlend);

    double dYaw = aim.x * prof_.sensH * kDegPerSecPerSens * scale * dt;
    double dPitch = aim.y * prof_.sensV * kDegPerSecPerSens * scale * dt;
    // Trainer aim assist (arena only; never touches the game).
    if (cfg_.aimAssist > 0.0 && target_.active) {
        Vec2 toTarget(target_.yaw - yaw_, target_.pitch - pitch_);
        double slow = 1.0;
        Vec2 pull = aimAssist(cfg_.aimAssist, toTarget, aimAssistRadius(target_.radius), move.len(), dt, slow);
        dYaw = dYaw * slow + pull.x;
        dPitch = dPitch * slow + pull.y;
    }
    yaw_ += dYaw;
    pitch_ = clampd(pitch_ + dPitch, -70.0, 70.0);

    // Strafing shifts the target sideways in view (parallax).
    if (target_.active) {
        double distM = stage_ == Stage::Ads ? kAdsDistM : (stage_ == Stage::Tracking ? kTrackDistM : kFlickDistM);
        target_.yaw -= (move.x * kStrafeSpeed / distM) * (180.0 / kPi) * dt;
    }

    bool fired = false;
    if (triggerArmed_ && rt >= 0.5) { fired = true; triggerArmed_ = false; }
    else if (!triggerArmed_ && rt < 0.3) triggerArmed_ = true;

    switch (stage_) {
        case Stage::Countdown:
            if (stageT_ >= kCountdown) enter(Stage::Flick);
            break;
        case Stage::Flick:
            stepGallery(inp, fired, false, cfg_.flickTargets);
            break;
        case Stage::Break1:
            if (stageT_ >= kBreak) enter(Stage::Tracking);
            break;
        case Stage::Tracking:
            stepTracking(inp, move);
            break;
        case Stage::Break2:
            if (stageT_ >= kBreak) enter(Stage::Ads);
            break;
        case Stage::Ads:
            stepGallery(inp, fired, true, cfg_.adsTargets);
            break;
        case Stage::Done:
            break;
    }
}

void BenchmarkSession::finalize() {
    BenchResult r;
    r.valid = true;
    r.shots = shots_; r.hits = hits_; r.timeouts = timeouts_;
    r.targets = (int)recs_.size();
    r.durationSec = t_;
    int attempts = shots_ + timeouts_;
    r.accuracy = attempts > 0 ? (double)hits_ / attempts : 0.0;

    std::vector<double> react, acq, adsAcq;
    int overs = 0, adsHits = 0, adsTargets = 0;
    for (const auto& t : recs_) {
        if (t.overshot) ++overs;
        if (t.ads) ++adsTargets;
        if (t.reacted) react.push_back(t.reactionMs);
        if (t.hit) {
            acq.push_back(t.acquireMs);
            if (t.ads) { adsAcq.push_back(t.acquireMs); ++adsHits; }
        }
    }
    double timeoutMs = cfg_.targetTimeout * 1000.0;
    r.medianReactionMs = react.empty() ? timeoutMs : median(react);
    // Missed targets count as a full timeout so skipping hard targets cannot help.
    std::vector<double> acqAll = acq;
    for (int i = 0; i < timeouts_; ++i) acqAll.push_back(timeoutMs);
    r.medianAcquireMs = acqAll.empty() ? timeoutMs : median(acqAll);
    double m = mean(acqAll);
    r.acquireCv = (acqAll.size() >= 2 && m > 0) ? stddev(acqAll) / m : 1.0;
    r.overshootRate = recs_.empty() ? 0.0 : (double)overs / recs_.size();
    r.saturation = activeTime_ > 0 ? satTime_ / activeTime_ : 0.0;
    r.adsAccuracy = adsTargets > 0 ? (double)adsHits / adsTargets : 0.0;
    r.adsMedianAcquireMs = adsAcq.empty() ? timeoutMs : median(adsAcq);

    r.trackOnTarget = trackTime_ > 0 ? trackOn_ / trackTime_ : 0.0;
    r.trackMeanErrDeg = trackTime_ > 0 ? trackErrSum_ / trackTime_ : 99.0;
    r.trackWindowStd = windows_.size() >= 2 ? stddev(windows_) : 0.5;
    r.strafeUptime = trackTime_ > 0 ? strafeTime_ / trackTime_ : 0.0;

    double trackQuality = 0.7 * r.trackOnTarget + 0.3 * std::exp(-r.trackMeanErrDeg / 4.0);
    // Consistency is only earned on work actually done: failing every target
    // "consistently" must not score. Each half fades out below 50% success.
    double hitFrac = recs_.empty() ? 0.0 : (double)acq.size() / (double)recs_.size();
    double acqPart = (1.0 - std::min(r.acquireCv, 1.0)) * std::min(1.0, 2.0 * hitFrac);
    double trackPart = (1.0 - std::min(r.trackWindowStd / 0.4, 1.0)) * std::min(1.0, 2.0 * r.trackOnTarget);
    double consistency = clampd(0.5 * acqPart + 0.5 * trackPart, 0.0, 1.0);

    r.scoreAccuracy = 100.0 * r.accuracy;
    r.scoreTracking = 100.0 * trackQuality;
    r.scoreReaction = 50.0 * map01(r.medianReactionMs, 150.0, 650.0) + 50.0 * map01(r.medianAcquireMs, 500.0, 3000.0);
    r.scoreConsistency = 100.0 * consistency;
    r.composite = 0.30 * r.scoreAccuracy + 0.30 * r.scoreTracking + 0.20 * r.scoreReaction + 0.20 * r.scoreConsistency;

    // Aim Performance Index: accurate hits per second, weighted by tracking
    // quality and consistency. Unbounded, so "2x" is a meaningful target.
    double acqSec = std::max(0.2, r.medianAcquireMs / 1000.0);
    r.index = 100.0 * r.accuracy * trackQuality * (1.0 / acqSec) * (0.5 + 0.5 * consistency);
    result_ = r;
}

} // namespace wz
