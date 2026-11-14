#include "Recommender.h"
#include "Lang.h"

#include <cstdarg>
#include <cstdio>

namespace wz {

static std::string fmt(const char* f, ...) {
    char b[512];
    va_list ap;
    va_start(ap, f);
    std::vsnprintf(b, sizeof(b), f, ap);
    va_end(ap);
    return b;
}

static void stickAdvice(Recommendation& out, const char* label, const StickReport& s, double& dzMin, double& dzMax) {
    if (s.rest.valid || s.release.valid) {
        dzMin = s.recMin;
        out.reasons.push_back(fmt(tr("%s Min deadzone %.2f: largest centre error measured was %.3f (rest %.3f, after release %.3f) plus a 0.015 safety margin."),
                                  label, s.recMin, s.worstCentre, s.rest.p999Radius, s.release.maxSettleRadius));
        if (s.drift == DriftLevel::Noticeable)
            out.warnings.push_back(fmt(tr("%s: noticeable drift (%.3f). The deadzone hides it, but it costs fine-aim range. Clean or recalibrate the stick module."), label, s.worstCentre));
        if (s.drift == DriftLevel::Severe)
            out.warnings.push_back(fmt(tr("%s: severe drift (%.3f). A deadzone this large will hurt micro-adjustments - repair or replace the stick module."), label, s.worstCentre));
    }
    if (s.range.valid) {
        dzMax = s.recMax;
        out.reasons.push_back(fmt(tr("%s Max deadzone %.2f: weakest edge direction reached %.3f, so full speed is reachable in every direction."),
                                  label, s.recMax, s.range.minEdge));
        if (s.range.minEdge < 0.90)
            out.warnings.push_back(fmt(tr("%s: only reaches %.0f%% deflection in its weakest direction (worn or obstructed stick)."), label, s.range.minEdge * 100));
    }
}

Recommendation recommend(const Profile& current, const CalibrationData* cal, const BenchResult* bench) {
    Recommendation out;
    Profile p = current;
    double bias = clampd(current.bias, -1.0, 1.0);

    // --- Deadzones: purely from measured hardware -------------------------
    if (cal && cal->valid) {
        stickAdvice(out, tr("Right stick"), cal->right, p.rsMin, p.rsMax);
        stickAdvice(out, tr("Left stick"), cal->left, p.lsMin, p.lsMax);
        if (cal->lt.valid) p.ltDz = cal->lt.recDeadzone;
        if (cal->rt.valid) p.rtDz = cal->rt.recDeadzone;
        if (cal->lt.valid || cal->rt.valid)
            out.reasons.push_back(fmt(tr("Trigger deadzones L2 %.2f / R2 %.2f: lowest values that ignore the resting trigger signal, for the fastest ADS and fire response."), p.ltDz, p.rtDz));
        if (cal->lt.valid && cal->lt.pressMax < 0.95) out.warnings.push_back(fmt(tr("Left trigger only reaches %.0f%% when fully pressed."), cal->lt.pressMax * 100));
        if (cal->rt.valid && cal->rt.pressMax < 0.95) out.warnings.push_back(fmt(tr("Right trigger only reaches %.0f%% when fully pressed."), cal->rt.pressMax * 100));
    } else {
        out.reasons.push_back(tr("Deadzones kept as they are: run Calibration so they can be set from your controller's measured drift."));
    }

    // --- Sensitivity ------------------------------------------------------
    bool haveBench = bench && bench->valid;
    if (haveBench) {
        int adj = 0;
        if (bench->overshootRate > 0.60) {
            adj = -2;
            out.reasons.push_back(fmt(tr("Sensitivity lowered by 2: you swung past %.0f%% of targets in the benchmark."), bench->overshootRate * 100));
        } else if (bench->overshootRate > 0.35) {
            adj = -1;
            out.reasons.push_back(fmt(tr("Sensitivity lowered by 1: you swung past %.0f%% of targets."), bench->overshootRate * 100));
        } else if (bench->saturation > 0.45 && bench->overshootRate < 0.20) {
            adj = 1;
            out.reasons.push_back(fmt(tr("Sensitivity raised by 1: the stick was pinned at full deflection %.0f%% of flick time with few overshoots, so turn speed is the limit."), bench->saturation * 100));
        } else {
            out.reasons.push_back(fmt(tr("Sensitivity kept: overshoot rate %.0f%% and stick saturation %.0f%% are both in a healthy range."), bench->overshootRate * 100, bench->saturation * 100));
        }
        if (bias > 0.6 && adj <= 0 && bench->overshootRate < 0.30) adj += 1;
        if (bias < -0.6 && adj >= 0) adj -= 1;
        p.sensH = (int)clampd(current.sensH + adj, 3, 12);
        p.sensV = (int)clampd(current.sensV + adj, 3, 12);
    } else {
        int s = (int)std::lround(6.0 + bias * 2.0);
        p.sensH = s;
        p.sensV = bias > 0.5 ? s - 1 : s;
        out.reasons.push_back(fmt(tr("Sensitivity %d / %d from your responsiveness preference. Run a benchmark so this can be tuned from your overshoot and saturation data."), p.sensH, p.sensV));
    }

    // --- ADS multiplier ---------------------------------------------------
    if (haveBench) {
        double m = current.adsMult;
        if (bench->adsAccuracy < 0.55) {
            m -= 0.10;
            out.reasons.push_back(fmt(tr("ADS multiplier lowered to %.2f: ADS-stage hit rate was only %.0f%%."), clampd(m, 0.70, 1.20), bench->adsAccuracy * 100));
        } else if (bench->adsAccuracy < 0.75) {
            m -= 0.05;
            out.reasons.push_back(fmt(tr("ADS multiplier lowered to %.2f: ADS-stage hit rate %.0f%% leaves room for steadier aim."), clampd(m, 0.70, 1.20), bench->adsAccuracy * 100));
        } else if (bench->adsAccuracy > 0.88 && bench->adsMedianAcquireMs > 1400) {
            m += 0.05;
            out.reasons.push_back(fmt(tr("ADS multiplier raised to %.2f: ADS accuracy is high (%.0f%%) but slow (%.0f ms per target)."), clampd(m, 0.70, 1.20), bench->adsAccuracy * 100, bench->adsMedianAcquireMs));
        } else {
            out.reasons.push_back(fmt(tr("ADS multiplier kept at %.2f: ADS accuracy %.0f%% at %.0f ms per target is balanced."), m, bench->adsAccuracy * 100, bench->adsMedianAcquireMs));
        }
        p.adsMult = clampd(m, 0.70, 1.20);
    } else {
        p.adsMult = bias < -0.33 ? 0.85 : (bias > 0.33 ? 1.00 : 0.95);
        out.reasons.push_back(fmt(tr("ADS multiplier %.2f from your preference (no benchmark data yet)."), p.adsMult));
    }
    p.adsMultHigh = clampd(p.adsMult - 0.05, 0.60, 1.20);

    // --- Response curve ---------------------------------------------------
    if (bias < -0.33) {
        p.curve = CurveType::Standard;
        out.reasons.push_back(tr("Curve Standard: the gentlest response near stick centre, best for precise micro-adjustments."));
    } else if (bias > 0.66 && haveBench && bench->overshootRate < 0.15 && bench->trackWindowStd < 0.2) {
        p.curve = CurveType::Linear;
        out.reasons.push_back(tr("Curve Linear: rawest 1:1 response. Suggested only because your overshoot rate and tracking variance are both low."));
    } else {
        p.curve = CurveType::Dynamic;
        out.reasons.push_back(tr("Curve Dynamic: quick initial response with a flatter mid-range, a strong match for tracking strafing targets."));
    }

    p.adsTransition = bias >= 0 ? 0 : 1;
    out.reasons.push_back(fmt(tr("ADS transition %s: %s."), tr(adsTransitionName(p.adsTransition)),
                              p.adsTransition == 0 ? tr("sensitivity changes the moment you press ADS, so muscle memory is consistent")
                                                   : tr("sensitivity eases in with the zoom for smoother snap-to-ADS")));
    p.aimAssist = true;
    p.aimAssistType = 0;
    out.reasons.push_back(tr("Aim Assist On / Default: keeps both slowdown and rotational assist available at all ranges."));

    // --- Technique tips ---------------------------------------------------
    if (haveBench) {
        if (bench->strafeUptime < 0.5)
            out.tips.push_back(fmt(tr("You moved the left stick during only %.0f%% of tracking. Warzone's rotational aim assist works while you are moving, so keep strafing while you track."), bench->strafeUptime * 100));
        if (bench->trackOnTarget < 0.5)
            out.tips.push_back(tr("Tracking is on target less than half the time: use the Practice benchmark daily and focus on matching target speed rather than chasing with corrections."));
        if (bench->medianReactionMs > 380)
            out.tips.push_back(fmt(tr("Median reaction %.0f ms. Rest your thumb lightly on the stick and pre-aim common angles to cut the first-move delay."), bench->medianReactionMs));
        if (bench->acquireCv > 0.6)
            out.tips.push_back(tr("Time-to-hit varies a lot between targets. Prioritise a repeatable motion (one flick, one micro-correction) over raw speed."));
        if (bench->accuracy < 0.6)
            out.tips.push_back(tr("More than 4 in 10 shots missed: settle on the target before pulling the trigger; speed follows accuracy."));
    }
    if (cal && cal->valid && cal->reportHz > 0 && cal->reportHz < 200)
        out.tips.push_back(fmt(tr("Controller reports at about %.0f Hz over USB. That is normal for standard Xbox pads; use a rear motherboard USB port (not a hub) for the steadiest timing."), cal->reportHz));

    p.sanitize();
    out.profile = p;
    return out;
}

} // namespace wz
